import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { productItems } from "@/db/schema";
import { recordVisit } from "./dashboard";
import { liveHolds, seatsTaken } from "./orders";
import { paymentsReady } from "./payments";
import { generateSlots, priceFor } from "./pricing";
import { getPublishedProduct, publishedProducts } from "./products";
import { getPublicStore } from "./stores";

export async function storePage(slug: string, country: string | null) {
  const store = await getPublicStore(slug);
  if (!store) return null;
  const list = await publishedProducts(store.id);
  await recordVisit(store.id, null);
  return {
    store: { slug: store.slug, name: store.name, headline: store.headline, bio: store.bio },
    products: list.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      price: priceFor(p, store.currency, country),
      durationMinutes: p.durationMinutes,
      nextSession: p.sessions.find((s) => s.startsAt > Date.now())?.startsAt ?? null,
    })),
  };
}

export async function productPage(slug: string, productId: string) {
  const store = await getPublicStore(slug);
  if (!store) return null;
  const product = await getPublishedProduct(store.id, productId);
  if (!product) return null;
  await recordVisit(store.id, product.id);
  const now = Date.now();
  const items = await db
    .select({ n: count() })
    .from(productItems)
    .where(eq(productItems.productId, product.id))
    .get();
  const slots =
    product.type === "one_on_one"
      ? generateSlots({
          availability: product.availability,
          durationMinutes: product.durationMinutes ?? 0,
          bufferMinutes: product.bufferMinutes ?? 0,
          now,
          held: await liveHolds(store.id, now),
        })
      : [];
  const seatsLeft =
    product.type === "live_course" && product.capacity !== null
      ? Math.max(0, product.capacity - (await seatsTaken(product.id, now)))
      : null;
  return {
    store: { slug: store.slug, name: store.name, currency: store.currency },
    product: {
      id: product.id,
      type: product.type,
      title: product.title,
      description: product.description,
      price: product.price,
      countryPrices: product.countryPrices,
      durationMinutes: product.durationMinutes,
      sessions: product.sessions,
      itemCount: items?.n ?? 0,
    },
    slots,
    seatsLeft,
    paymentsReady: paymentsReady(),
  };
}
