import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { stores } from "@/db/schema";

export type Store = typeof stores.$inferSelect;

const RESERVED = new Set(["access", "api"]);

export const storeInput = z
  .object({
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .min(2, "Use at least 2 characters.")
      .max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes.")
      .refine((s) => !RESERVED.has(s), "That address is reserved."),
    name: z.string().trim().min(1, "Give the store a name.").max(80),
    headline: z.string().trim().max(140),
    bio: z.string().trim().max(2000),
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Use a 3-letter currency code such as USD."),
  })
  .strict();

function slugFrom(email: string): string {
  const base = (email.split("@")[0] ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30);
  return base.length >= 2 && !RESERVED.has(base) ? base : "store";
}

/** The member's store, made on first sight. */
export async function getOrCreateStore(user: { id: string; email: string }): Promise<Store> {
  const existing = await db.select().from(stores).where(eq(stores.userId, user.id)).get();
  if (existing) return existing;
  let slug = slugFrom(user.email);
  for (let attempt = 0; attempt < 5; attempt++) {
    const taken = await db.select({ id: stores.id }).from(stores).where(eq(stores.slug, slug)).get();
    if (!taken) break;
    slug = `${slugFrom(user.email)}-${crypto.randomUUID().slice(0, 4)}`;
  }
  await db
    .insert(stores)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      ownerEmail: user.email,
      slug,
      name: user.email.split("@")[0] ?? "My store",
      createdAt: Date.now(),
    })
    .onConflictDoNothing();
  return (await db.select().from(stores).where(eq(stores.userId, user.id)).get())!;
}

export class InputError extends Error {}

export async function updateStore(userId: string, input: z.infer<typeof storeInput>): Promise<Store> {
  const clash = await db
    .select({ id: stores.id })
    .from(stores)
    .where(and(eq(stores.slug, input.slug), ne(stores.userId, userId)))
    .get();
  if (clash) throw new InputError("That address is taken by another store.");
  try {
    const [row] = await db.update(stores).set(input).where(eq(stores.userId, userId)).returning();
    return row!;
  } catch {
    throw new InputError("That address is taken by another store.");
  }
}

export function getPublicStore(slug: string): Promise<Store | undefined> {
  return db
    .select()
    .from(stores)
    .where(and(eq(stores.slug, slug.toLowerCase()), eq(stores.disabled, false)))
    .get();
}

export function listAllStores() {
  return db
    .select({ id: stores.id, slug: stores.slug, name: stores.name, ownerEmail: stores.ownerEmail, disabled: stores.disabled })
    .from(stores)
    .orderBy(stores.createdAt);
}

export async function setStoreDisabled(storeId: string, disabled: boolean): Promise<boolean> {
  const rows = await db.update(stores).set({ disabled }).where(eq(stores.id, storeId)).returning({ id: stores.id });
  return rows.length > 0;
}
