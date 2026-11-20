import { and, count, desc, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { orders, products, stores, visits } from "@/db/schema";

export const PERIODS = {
  "24h": { ms: 86_400_000, bucket: "hour", buckets: 24 },
  "7d": { ms: 7 * 86_400_000, bucket: "day", buckets: 7 },
  "30d": { ms: 30 * 86_400_000, bucket: "day", buckets: 30 },
  "3m": { ms: 91 * 86_400_000, bucket: "week", buckets: 13 },
  "12m": { ms: 365 * 86_400_000, bucket: "month", buckets: 12 },
} as const;
export type Period = keyof typeof PERIODS;

function bucketStart(ms: number, bucket: string): number {
  const d = new Date(ms);
  if (bucket === "hour") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours());
  if (bucket === "month") return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const day = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  if (bucket === "week") return day - ((d.getUTCDay() + 6) % 7) * 86_400_000;
  return day;
}

function previous(ms: number, bucket: string): number {
  if (bucket === "hour") return ms - 3_600_000;
  if (bucket === "day") return ms - 86_400_000;
  if (bucket === "week") return ms - 7 * 86_400_000;
  const d = new Date(ms);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
}

export async function getDashboard(userId: string, period: Period) {
  const store = await db.select().from(stores).where(eq(stores.userId, userId)).get();
  if (!store) return null;
  const now = Date.now();
  const { ms, bucket, buckets } = PERIODS[period];
  const since = now - ms;
  const paid = await db
    .select({ amount: orders.amount, currency: orders.currency, paidAt: orders.paidAt })
    .from(orders)
    .where(and(eq(orders.storeId, store.id), eq(orders.status, "paid"), gte(orders.paidAt, since)));
  const revenue: Record<string, number> = {};
  for (const o of paid) revenue[o.currency] = (revenue[o.currency] ?? 0) + o.amount;
  const visitRow = await db
    .select({ n: count() })
    .from(visits)
    .where(and(eq(visits.storeId, store.id), gte(visits.createdAt, since)))
    .get();

  // The chart shows the currency with the most revenue, or the store's.
  const chartCurrency =
    Object.entries(revenue).sort((a, b) => b[1] - a[1]).find(([, v]) => v > 0)?.[0] ?? store.currency;
  const starts: number[] = [];
  let cursor = bucketStart(now, bucket);
  for (let i = 0; i < buckets; i++) {
    starts.unshift(cursor);
    cursor = previous(cursor, bucket);
  }
  const series = starts.map((start) => ({ start, amount: 0 }));
  for (const o of paid) {
    if (o.currency !== chartCurrency || o.paidAt === null) continue;
    const b = bucketStart(o.paidAt, bucket);
    const point = series.find((p) => p.start === b);
    if (point) point.amount += o.amount;
  }
  const recent = await db
    .select({
      id: orders.id,
      buyerName: orders.buyerName,
      buyerEmail: orders.buyerEmail,
      productTitle: products.title,
      amount: orders.amount,
      currency: orders.currency,
      paidAt: orders.paidAt,
    })
    .from(orders)
    .leftJoin(products, eq(products.id, orders.productId))
    .where(and(eq(orders.storeId, store.id), eq(orders.status, "paid")))
    .orderBy(desc(orders.paidAt))
    .limit(8);
  return {
    store: { name: store.name, slug: store.slug, currency: store.currency },
    revenue,
    paidOrders: paid.length,
    visits: visitRow?.n ?? 0,
    bucket,
    chartCurrency,
    series,
    recent,
  };
}

export async function recordVisit(storeId: string, productId: string | null): Promise<void> {
  await db.insert(visits).values({ id: crypto.randomUUID(), storeId, productId, createdAt: Date.now() });
}
