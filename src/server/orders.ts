import { and, desc, eq, gte, isNotNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { orders, productItems, products, slotHolds, stores } from "@/db/schema";
import { listItems } from "./products";
import { notifySale } from "./notify";
import { createCheckoutSession, paymentsReady } from "./payments";
import { HOLD_MINUTES, discountFor, generateSlots, priceFor, promoRefusal } from "./pricing";
import { findPromo, redemptions } from "./promos";

export const checkoutInput = z
  .object({
    productId: z.string().uuid(),
    name: z.string().trim().min(1, "Enter your name.").max(100),
    email: z.string().trim().toLowerCase().email("Enter a valid email address.").max(200),
    country: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Enter a 2-letter country code such as US."),
    promoCode: z.string().trim().max(40).optional(),
    slotStart: z.number().int().optional(),
  })
  .strict();

type CheckoutResult =
  | { status: 200; body: { accessUrl: string } | { checkoutUrl: string } }
  | { status: 400 | 404 | 409 | 502 | 503; body: { error: string } };

const fail = (status: 400 | 404 | 409 | 502 | 503, error: string): CheckoutResult => ({ status, body: { error } });

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Pending holds that lapsed: freed so others can book. */
function expiredHolds(storeId: string, now: number) {
  return db.delete(slotHolds).where(and(eq(slotHolds.storeId, storeId), isNotNull(slotHolds.expiresAt), lt(slotHolds.expiresAt, now)));
}

export async function liveHolds(storeId: string, now: number) {
  return db
    .select({ startsAt: slotHolds.startsAt, endsAt: slotHolds.endsAt })
    .from(slotHolds)
    .where(
      and(
        eq(slotHolds.storeId, storeId),
        or(sql`${slotHolds.expiresAt} IS NULL`, gte(slotHolds.expiresAt, now)),
        gte(slotHolds.endsAt, now),
      ),
    );
}

/** Seats held by paid orders and unexpired pending ones. */
export async function seatsTaken(productId: string, now: number): Promise<number> {
  const row = await db
    .select({ n: sql<number>`count(*)` })
    .from(orders)
    .where(
      and(
        eq(orders.productId, productId),
        or(eq(orders.status, "paid"), and(eq(orders.status, "pending"), gte(orders.createdAt, now - HOLD_MINUTES * 60_000))),
      ),
    )
    .get();
  return row?.n ?? 0;
}

type Defer = (work: Promise<unknown>) => void;

export async function checkout(
  input: z.infer<typeof checkoutInput>,
  origin: string,
  defer: Defer,
): Promise<CheckoutResult> {
  const now = Date.now();
  const product = await db
    .select()
    .from(products)
    .where(and(eq(products.id, input.productId), eq(products.status, "published")))
    .get();
  const store = product
    ? await db.select().from(stores).where(and(eq(stores.id, product.storeId), eq(stores.disabled, false))).get()
    : undefined;
  if (!product || !store) return fail(404, "This product isn't available.");

  const price = priceFor(product, store.currency, input.country);
  let discount = 0;
  let promo: Awaited<ReturnType<typeof findPromo>>;
  if (input.promoCode) {
    promo = await findPromo(store.id, input.promoCode);
    const refusal = promoRefusal(promo, {
      storeId: store.id,
      productId: product.id,
      now,
      redeemed: promo ? await redemptions(promo.id) : 0,
    });
    if (refusal || !promo) return fail(400, refusal ?? "That code doesn't exist.");
    discount = discountFor(promo, price.amount);
  }
  const total = price.amount - discount;
  if (total > 0 && !paymentsReady()) return fail(503, "Card payment isn't available for this product yet.");

  let slotStart: number | null = null;
  let slotEnd = 0;
  if (product.type === "one_on_one") {
    if (input.slotStart === undefined) return fail(400, "Pick a time.");
    const slots = generateSlots({
      availability: product.availability,
      durationMinutes: product.durationMinutes ?? 0,
      bufferMinutes: product.bufferMinutes ?? 0,
      now,
      held: await liveHolds(store.id, now),
    });
    if (!slots.includes(input.slotStart)) return fail(409, "That time is no longer available. Pick another.");
    slotStart = input.slotStart;
    slotEnd = slotStart + ((product.durationMinutes ?? 0) + (product.bufferMinutes ?? 0)) * 60_000;
  }
  if (product.type === "live_course" && product.capacity !== null) {
    if ((await seatsTaken(product.id, now)) >= product.capacity) return fail(409, "This course is full.");
  }

  const id = crypto.randomUUID();
  const token = newToken();
  const paid = total === 0;
  const order = {
    id,
    storeId: store.id,
    productId: product.id,
    buyerName: input.name,
    buyerEmail: input.email,
    buyerCountry: input.country,
    amount: total,
    currency: price.currency,
    promoId: promo?.id ?? null,
    promoCode: promo?.code ?? null,
    discount,
    status: paid ? ("paid" as const) : ("pending" as const),
    slotStart,
    accessToken: token,
    createdAt: now,
    paidAt: paid ? now : null,
  };
  try {
    if (slotStart !== null) {
      await db.batch([
        expiredHolds(store.id, now),
        db.insert(orders).values(order),
        db.insert(slotHolds).values({
          storeId: store.id,
          startsAt: slotStart,
          endsAt: slotEnd,
          orderId: id,
          expiresAt: paid ? null : now + HOLD_MINUTES * 60_000,
        }),
      ]);
    } else {
      await db.insert(orders).values(order);
    }
  } catch {
    return fail(409, "That time is no longer available. Pick another.");
  }
  // Seats: a race can oversell by a few; undo this order if it went over.
  if (product.type === "live_course" && product.capacity !== null && (await seatsTaken(product.id, now)) > product.capacity) {
    await db.delete(orders).where(eq(orders.id, id));
    return fail(409, "This course is full.");
  }

  const accessUrl = `${origin}/s/access/${token}`;
  if (paid) {
    defer(notifySale({
      storeName: store.name,
      ownerEmail: store.ownerEmail,
      productTitle: product.title,
      buyerName: input.name,
      buyerEmail: input.email,
      amount: total,
      currency: price.currency,
      accessUrl,
      slotStart,
    }));
    return { status: 200, body: { accessUrl } };
  }
  try {
    const session = await createCheckoutSession({
      orderId: id,
      title: product.title,
      amount: total,
      currency: price.currency,
      email: input.email,
      successUrl: accessUrl,
      cancelUrl: `${origin}/s/${store.slug}/${product.id}`,
    });
    await db.update(orders).set({ providerSessionId: session.id }).where(eq(orders.id, id));
    return { status: 200, body: { checkoutUrl: session.url } };
  } catch {
    await db.batch([
      db.update(orders).set({ status: "cancelled", cancelledAt: Date.now() }).where(eq(orders.id, id)),
      db.delete(slotHolds).where(eq(slotHolds.orderId, id)),
    ]);
    return fail(502, "Card checkout couldn't start. Try again in a moment.");
  }
}

/** Marks the order behind a completed checkout paid. Repeats change nothing. */
export async function markPaid(sessionId: string, origin: string, defer: Defer): Promise<void> {
  const now = Date.now();
  const [order] = await db
    .update(orders)
    .set({ status: "paid", paidAt: now })
    .where(and(eq(orders.providerSessionId, sessionId), eq(orders.status, "pending")))
    .returning();
  if (!order) return;
  if (order.slotStart !== null) {
    const product = await db.select().from(products).where(eq(products.id, order.productId)).get();
    const end = order.slotStart + ((product?.durationMinutes ?? 0) + (product?.bufferMinutes ?? 0)) * 60_000;
    await db.batch([
      db.update(slotHolds).set({ expiresAt: null }).where(eq(slotHolds.orderId, order.id)),
      db
        .insert(slotHolds)
        .values({ storeId: order.storeId, startsAt: order.slotStart, endsAt: end, orderId: order.id, expiresAt: null })
        .onConflictDoNothing(),
    ]);
  }
  const store = await db.select().from(stores).where(eq(stores.id, order.storeId)).get();
  const product = await db.select({ title: products.title }).from(products).where(eq(products.id, order.productId)).get();
  if (store)
    defer(notifySale({
      storeName: store.name,
      ownerEmail: store.ownerEmail,
      productTitle: product?.title ?? "",
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      amount: order.amount,
      currency: order.currency,
      accessUrl: `${origin}/s/access/${order.accessToken}`,
      slotStart: order.slotStart,
    }));
}

async function storeIdOf(userId: string) {
  return (await db.select({ id: stores.id }).from(stores).where(eq(stores.userId, userId)).get())?.id ?? null;
}

/** Cancels one of the owner's orders: access ends and a booked time frees up. */
export async function cancelOrder(userId: string, orderId: string): Promise<boolean> {
  const storeId = await storeIdOf(userId);
  if (!storeId) return false;
  const order = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.storeId, storeId)))
    .get();
  if (!order) return false;
  await db.batch([
    db
      .update(orders)
      .set({ status: "cancelled", cancelledAt: Date.now() })
      .where(and(eq(orders.id, order.id), sql`${orders.status} != 'cancelled'`)),
    db.delete(slotHolds).where(eq(slotHolds.orderId, order.id)),
  ]);
  return true;
}

export async function listOrders(userId: string) {
  const storeId = await storeIdOf(userId);
  if (!storeId) return { orders: [], customers: [], bookings: [] };
  const rows = await db
    .select({
      id: orders.id,
      productTitle: products.title,
      productType: products.type,
      buyerName: orders.buyerName,
      buyerEmail: orders.buyerEmail,
      buyerCountry: orders.buyerCountry,
      amount: orders.amount,
      currency: orders.currency,
      promoCode: orders.promoCode,
      status: orders.status,
      slotStart: orders.slotStart,
      createdAt: orders.createdAt,
    })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .where(eq(orders.storeId, storeId))
    .orderBy(desc(orders.createdAt))
    .limit(1000);

  const byEmail = new Map<string, { email: string; name: string; orders: number; totals: Record<string, number>; lastAt: number }>();
  for (const o of rows) {
    if (o.status !== "paid") continue;
    const c = byEmail.get(o.buyerEmail) ?? { email: o.buyerEmail, name: o.buyerName, orders: 0, totals: {}, lastAt: o.createdAt };
    c.orders += 1;
    c.totals[o.currency] = (c.totals[o.currency] ?? 0) + o.amount;
    c.lastAt = Math.max(c.lastAt, o.createdAt);
    byEmail.set(o.buyerEmail, c);
  }
  const now = Date.now();
  const holds = await db
    .select({ orderId: slotHolds.orderId, startsAt: slotHolds.startsAt, expiresAt: slotHolds.expiresAt })
    .from(slotHolds)
    .where(and(eq(slotHolds.storeId, storeId), gte(slotHolds.startsAt, now)));
  const live = new Map(
    holds.filter((h) => h.expiresAt === null || h.expiresAt >= now).map((h) => [h.orderId, h.startsAt]),
  );
  const bookings = rows
    .filter((o) => live.has(o.id))
    .map((o) => ({ ...o, startsAt: live.get(o.id)! }))
    .sort((a, b) => a.startsAt - b.startsAt);
  return { orders: rows, customers: [...byEmail.values()].sort((a, b) => b.lastAt - a.lastAt), bookings };
}

/** What a buyer's access link shows. Content only for paid orders. */
export async function getAccess(token: string) {
  const order = await db.select().from(orders).where(eq(orders.accessToken, token)).get();
  if (!order) return null;
  const product = await db.select().from(products).where(eq(products.id, order.productId)).get();
  const store = await db.select({ name: stores.name, slug: stores.slug }).from(stores).where(eq(stores.id, order.storeId)).get();
  const base = {
    status: order.status,
    buyerName: order.buyerName,
    amount: order.amount,
    currency: order.currency,
    productTitle: product?.title ?? "Removed product",
    storeName: store?.name ?? "",
    createdAt: order.createdAt,
  };
  if (order.status !== "paid" || !product) return { ...base, content: null };
  const items = await listItems(product.id);
  return {
    ...base,
    content: {
      type: product.type,
      location: product.location,
      slotStart: order.slotStart,
      durationMinutes: product.durationMinutes,
      sessions: product.sessions,
      items: items.map((i) => ({
        id: i.id,
        kind: i.kind,
        title: i.title,
        videoUrl: i.videoUrl,
        fileName: i.fileName,
        fileSize: i.fileSize,
      })),
    },
  };
}

/** The R2 object a buyer may download, or why not. */
export async function buyerFile(token: string, itemId: string) {
  const order = await db.select().from(orders).where(eq(orders.accessToken, token)).get();
  if (!order) return { status: 404 as const };
  const item = await db
    .select()
    .from(productItems)
    .where(and(eq(productItems.id, itemId), eq(productItems.productId, order.productId)))
    .get();
  if (!item?.fileKey) return { status: 404 as const };
  if (order.status !== "paid") return { status: 403 as const };
  return { status: 200 as const, item };
}
