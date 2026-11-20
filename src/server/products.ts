import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { z } from "zod";
import { db } from "@/db";
import { productItems, products, stores } from "@/db/schema";
import { InputError } from "./stores";

export type Product = typeof products.$inferSelect;
export type ProductItem = typeof productItems.$inferSelect;

const money = z.number().min(0).max(1_000_000);
const time = z.string().regex(/^\d{2}:\d{2}$/);

export const productInput = z
  .object({
    type: z.enum(["one_on_one", "live_course", "recorded_course", "digital"]),
    title: z.string().trim().min(1, "Give the product a title.").max(120),
    description: z.string().trim().max(5000),
    price: money,
    countryPrices: z
      .array(
        z.object({
          country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use 2-letter country codes such as GB."),
          amount: money,
          currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use 3-letter currency codes such as GBP."),
        }),
      )
      .max(100),
    status: z.enum(["draft", "published"]),
    durationMinutes: z.number().int().min(5).max(1440).nullable(),
    bufferMinutes: z.number().int().min(0).max(1440).nullable(),
    location: z.string().trim().max(500),
    availability: z.array(z.object({ day: z.number().int().min(0).max(6), start: time, end: time })).max(50),
    sessions: z.array(z.object({ startsAt: z.number().int(), durationMinutes: z.number().int().min(5).max(1440) })).max(100),
    capacity: z.number().int().min(1).max(100_000).nullable(),
  })
  .strict()
  .superRefine((p, ctx) => {
    if (p.type === "one_on_one" && !p.durationMinutes)
      ctx.addIssue({ code: "custom", message: "Set how long a session lasts.", path: ["durationMinutes"] });
    if (p.type === "live_course" && p.sessions.length === 0)
      ctx.addIssue({ code: "custom", message: "Add at least one session date.", path: ["sessions"] });
    const countries = p.countryPrices.map((c) => c.country);
    if (new Set(countries).size !== countries.length)
      ctx.addIssue({ code: "custom", message: "Each country can have one price.", path: ["countryPrices"] });
    for (const w of p.availability)
      if (w.start >= w.end) ctx.addIssue({ code: "custom", message: "Each window must end after it starts.", path: ["availability"] });
  });

export type ProductInput = z.infer<typeof productInput>;

async function storeIdOf(userId: string): Promise<string | null> {
  const row = await db.select({ id: stores.id }).from(stores).where(eq(stores.userId, userId)).get();
  return row?.id ?? null;
}

function toRow(input: ProductInput) {
  const isSession = input.type === "one_on_one";
  const isLive = input.type === "live_course";
  return {
    type: input.type,
    title: input.title,
    description: input.description,
    price: Math.round(input.price * 100),
    countryPrices: input.countryPrices.map((c) => ({ ...c, amount: Math.round(c.amount * 100) })),
    status: input.status,
    durationMinutes: isSession ? input.durationMinutes : null,
    bufferMinutes: isSession ? (input.bufferMinutes ?? 0) : null,
    location: isSession || isLive ? input.location : "",
    availability: isSession ? input.availability : [],
    sessions: isLive ? [...input.sessions].sort((a, b) => a.startsAt - b.startsAt) : [],
    capacity: isLive ? input.capacity : null,
  };
}

export async function listProducts(userId: string) {
  const storeId = await storeIdOf(userId);
  if (!storeId) return [];
  return db.select().from(products).where(eq(products.storeId, storeId)).orderBy(desc(products.createdAt));
}

/** The product with its lessons or files, or null when this user doesn't own it. */
export async function getOwnedProduct(userId: string, productId: string) {
  const storeId = await storeIdOf(userId);
  if (!storeId) return null;
  const product = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, storeId)))
    .get();
  if (!product) return null;
  const items = await listItems(product.id);
  return { product, items };
}

export function listItems(productId: string) {
  return db
    .select()
    .from(productItems)
    .where(eq(productItems.productId, productId))
    .orderBy(asc(productItems.position), asc(productItems.createdAt));
}

export async function createProduct(userId: string, input: ProductInput): Promise<string> {
  const storeId = await storeIdOf(userId);
  if (!storeId) throw new InputError("Open the dashboard first to set up your store.");
  const id = crypto.randomUUID();
  const now = Date.now();
  await db.insert(products).values({ id, storeId, ...toRow(input), createdAt: now, updatedAt: now });
  return id;
}

export async function updateProduct(userId: string, id: string, input: ProductInput): Promise<boolean> {
  const owned = await getOwnedProduct(userId, id);
  if (!owned) return false;
  const row = toRow({ ...input, type: owned.product.type });
  await db.update(products).set({ ...row, updatedAt: Date.now() }).where(eq(products.id, id));
  return true;
}

export async function setProductStatus(userId: string, id: string, status: "draft" | "published"): Promise<boolean> {
  const storeId = await storeIdOf(userId);
  if (!storeId) return false;
  const rows = await db
    .update(products)
    .set({ status, updatedAt: Date.now() })
    .where(and(eq(products.id, id), eq(products.storeId, storeId)))
    .returning({ id: products.id });
  return rows.length > 0;
}

export async function deleteProduct(userId: string, id: string): Promise<boolean> {
  const owned = await getOwnedProduct(userId, id);
  if (!owned) return false;
  const keys = owned.items.map((i) => i.fileKey).filter((k): k is string => !!k);
  if (keys.length) await env.files.delete(keys);
  await db.batch([
    db.delete(productItems).where(eq(productItems.productId, id)),
    db.delete(products).where(eq(products.id, id)),
  ]);
  return true;
}

async function nextPosition(productId: string): Promise<number> {
  const items = await listItems(productId);
  return items.length ? Math.max(...items.map((i) => i.position)) + 1 : 0;
}

export const lessonInput = z
  .object({
    productId: z.string().uuid(),
    title: z.string().trim().min(1, "Give the lesson a title.").max(200),
    videoUrl: z.string().trim().url("Enter a full video link starting with https://").max(1000),
  })
  .strict();

export async function addLesson(userId: string, input: z.infer<typeof lessonInput>): Promise<boolean> {
  const owned = await getOwnedProduct(userId, input.productId);
  if (!owned || owned.product.type !== "recorded_course") return false;
  await db.insert(productItems).values({
    id: crypto.randomUUID(),
    productId: owned.product.id,
    storeId: owned.product.storeId,
    kind: "lesson",
    position: await nextPosition(owned.product.id),
    title: input.title,
    videoUrl: input.videoUrl,
    createdAt: Date.now(),
  });
  return true;
}

export const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

export async function addFile(userId: string, productId: string, file: File, title: string | null): Promise<boolean> {
  const owned = await getOwnedProduct(userId, productId);
  if (!owned || !["recorded_course", "digital"].includes(owned.product.type)) return false;
  const id = crypto.randomUUID();
  const key = `${owned.product.storeId}/${owned.product.id}/${id}`;
  const contentType = file.type || "application/octet-stream";
  await env.files.put(key, file.stream(), { httpMetadata: { contentType } });
  await db.insert(productItems).values({
    id,
    productId: owned.product.id,
    storeId: owned.product.storeId,
    kind: owned.product.type === "digital" ? "file" : "lesson",
    position: await nextPosition(owned.product.id),
    title: title?.trim() || file.name,
    fileKey: key,
    fileName: file.name,
    fileSize: file.size,
    contentType,
    createdAt: Date.now(),
  });
  return true;
}

async function ownedItem(userId: string, itemId: string) {
  const storeId = await storeIdOf(userId);
  if (!storeId) return null;
  return (
    (await db
      .select()
      .from(productItems)
      .where(and(eq(productItems.id, itemId), eq(productItems.storeId, storeId)))
      .get()) ?? null
  );
}

export { ownedItem as getOwnedItem };

export async function deleteItem(userId: string, itemId: string): Promise<boolean> {
  const item = await ownedItem(userId, itemId);
  if (!item) return false;
  if (item.fileKey) await env.files.delete(item.fileKey);
  await db.delete(productItems).where(eq(productItems.id, item.id));
  return true;
}

/** Swaps an item with its neighbour. */
export async function moveItem(userId: string, itemId: string, direction: "up" | "down"): Promise<boolean> {
  const item = await ownedItem(userId, itemId);
  if (!item) return false;
  const items = await listItems(item.productId);
  const index = items.findIndex((i) => i.id === item.id);
  const other = items[direction === "up" ? index - 1 : index + 1];
  if (!other) return true;
  const ordered = items.map((i) => i.id);
  ordered[index] = other.id;
  ordered[items.indexOf(other)] = item.id;
  const [first, ...rest] = ordered.map((id, position) =>
    db.update(productItems).set({ position }).where(eq(productItems.id, id)),
  );
  if (first) await db.batch([first, ...rest]);
  return true;
}

export async function publishedProducts(storeId: string) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.storeId, storeId), eq(products.status, "published")))
    .orderBy(desc(products.createdAt));
}

export async function getPublishedProduct(storeId: string, productId: string) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.storeId, storeId), eq(products.status, "published")))
    .get();
}

export function productsByIds(ids: string[]) {
  if (!ids.length) return Promise.resolve([]);
  return db.select({ id: products.id, title: products.title, type: products.type }).from(products).where(inArray(products.id, ids));
}
