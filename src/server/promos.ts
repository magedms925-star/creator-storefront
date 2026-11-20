import { and, count, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders, products, promos, stores } from "@/db/schema";
import { InputError } from "./stores";

export const promoInput = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{2,32}$/, "Use 2-32 letters, numbers, dashes or underscores."),
    kind: z.enum(["percent", "fixed"]),
    value: z.number().positive("Enter an amount off."),
    productId: z.string().uuid().nullable(),
    expiresOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
    maxRedemptions: z.number().int().min(1).nullable(),
  })
  .strict()
  .refine((p) => p.kind !== "percent" || (Number.isInteger(p.value) && p.value <= 100), {
    message: "A percentage is a whole number from 1 to 100.",
    path: ["value"],
  });

async function storeOf(userId: string) {
  return db.select({ id: stores.id, currency: stores.currency }).from(stores).where(eq(stores.userId, userId)).get();
}

/** Paid orders that used each code. */
export async function redemptions(promoId: string): Promise<number> {
  const row = await db
    .select({ n: count() })
    .from(orders)
    .where(and(eq(orders.promoId, promoId), eq(orders.status, "paid")))
    .get();
  return row?.n ?? 0;
}

export async function listPromos(userId: string) {
  const store = await storeOf(userId);
  if (!store) return { currency: "USD", promos: [] };
  const rows = await db
    .select({
      id: promos.id,
      code: promos.code,
      kind: promos.kind,
      value: promos.value,
      productId: promos.productId,
      productTitle: products.title,
      expiresOn: promos.expiresOn,
      maxRedemptions: promos.maxRedemptions,
      active: promos.active,
    })
    .from(promos)
    .leftJoin(products, eq(products.id, promos.productId))
    .where(eq(promos.storeId, store.id))
    .orderBy(desc(promos.createdAt));
  const withCounts = await Promise.all(rows.map(async (p) => ({ ...p, redeemed: await redemptions(p.id) })));
  return { currency: store.currency, promos: withCounts };
}

export async function createPromo(userId: string, input: z.infer<typeof promoInput>): Promise<void> {
  const store = await storeOf(userId);
  if (!store) throw new InputError("Open the dashboard first to set up your store.");
  if (input.productId) {
    const own = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.storeId, store.id)))
      .get();
    if (!own) throw new InputError("Pick one of your products.");
  }
  const exists = await db
    .select({ id: promos.id })
    .from(promos)
    .where(and(eq(promos.storeId, store.id), eq(promos.code, input.code)))
    .get();
  if (exists) throw new InputError("You already have a code with that name.");
  await db.insert(promos).values({
    id: crypto.randomUUID(),
    storeId: store.id,
    code: input.code,
    kind: input.kind,
    value: input.kind === "percent" ? input.value : Math.round(input.value * 100),
    productId: input.productId,
    expiresOn: input.expiresOn,
    maxRedemptions: input.maxRedemptions,
    active: true,
    createdAt: Date.now(),
  });
}

export async function setPromoActive(userId: string, id: string, active: boolean): Promise<boolean> {
  const store = await storeOf(userId);
  if (!store) return false;
  const rows = await db
    .update(promos)
    .set({ active })
    .where(and(eq(promos.id, id), eq(promos.storeId, store.id)))
    .returning({ id: promos.id });
  return rows.length > 0;
}

export async function deletePromo(userId: string, id: string): Promise<boolean> {
  const store = await storeOf(userId);
  if (!store) return false;
  const rows = await db
    .delete(promos)
    .where(and(eq(promos.id, id), eq(promos.storeId, store.id)))
    .returning({ id: promos.id });
  return rows.length > 0;
}

export function findPromo(storeId: string, code: string) {
  return db
    .select()
    .from(promos)
    .where(and(eq(promos.storeId, storeId), eq(promos.code, code.trim().toUpperCase())))
    .get();
}
