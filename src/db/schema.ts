import { integer, sqliteTable, text, uniqueIndex, index } from "drizzle-orm/sqlite-core";

/** One store per member, keyed by the Gateway's user id. */
export const stores = sqliteTable("stores", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  ownerEmail: text("owner_email").notNull(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  headline: text("headline").notNull().default(""),
  bio: text("bio").notNull().default(""),
  currency: text("currency").notNull().default("USD"),
  disabled: integer("disabled", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at").notNull(),
});

export type ProductType = "one_on_one" | "live_course" | "recorded_course" | "digital";
export type CountryPrice = { country: string; amount: number; currency: string };
export type AvailabilityWindow = { day: number; start: string; end: string };
export type LiveSession = { startsAt: number; durationMinutes: number };

export const products = sqliteTable(
  "products",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    type: text("type").$type<ProductType>().notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    /** Minor units (cents) in the store currency. */
    price: integer("price").notNull().default(0),
    countryPrices: text("country_prices", { mode: "json" }).$type<CountryPrice[]>().notNull().default([]),
    status: text("status").$type<"draft" | "published">().notNull().default("draft"),
    durationMinutes: integer("duration_minutes"),
    bufferMinutes: integer("buffer_minutes"),
    location: text("location").notNull().default(""),
    availability: text("availability", { mode: "json" }).$type<AvailabilityWindow[]>().notNull().default([]),
    sessions: text("sessions", { mode: "json" }).$type<LiveSession[]>().notNull().default([]),
    capacity: integer("capacity"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [index("products_store_idx").on(t.storeId)],
);

/** Lessons of a recorded course and files of a digital product. */
export const productItems = sqliteTable(
  "product_items",
  {
    id: text("id").primaryKey(),
    productId: text("product_id").notNull(),
    storeId: text("store_id").notNull(),
    kind: text("kind").$type<"lesson" | "file">().notNull(),
    position: integer("position").notNull(),
    title: text("title").notNull(),
    videoUrl: text("video_url"),
    fileKey: text("file_key"),
    fileName: text("file_name"),
    fileSize: integer("file_size"),
    contentType: text("content_type"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("items_product_idx").on(t.productId)],
);

export const orders = sqliteTable(
  "orders",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    productId: text("product_id").notNull(),
    buyerName: text("buyer_name").notNull(),
    buyerEmail: text("buyer_email").notNull(),
    buyerCountry: text("buyer_country").notNull(),
    /** Minor units charged, after discount. */
    amount: integer("amount").notNull(),
    currency: text("currency").notNull(),
    promoId: text("promo_id"),
    promoCode: text("promo_code"),
    discount: integer("discount").notNull().default(0),
    status: text("status").$type<"pending" | "paid" | "cancelled">().notNull(),
    slotStart: integer("slot_start"),
    accessToken: text("access_token").notNull().unique(),
    providerSessionId: text("provider_session_id").unique(),
    createdAt: integer("created_at").notNull(),
    paidAt: integer("paid_at"),
    cancelledAt: integer("cancelled_at"),
  },
  (t) => [index("orders_store_idx").on(t.storeId, t.createdAt), index("orders_product_idx").on(t.productId)],
);

/** One row per booked session time: a store's time can be held by one order only. */
export const slotHolds = sqliteTable(
  "slot_holds",
  {
    storeId: text("store_id").notNull(),
    startsAt: integer("starts_at").notNull(),
    endsAt: integer("ends_at").notNull(),
    orderId: text("order_id").notNull(),
    /** Null once the order is paid; a pending hold lapses at this time. */
    expiresAt: integer("expires_at"),
  },
  (t) => [uniqueIndex("slot_holds_store_start").on(t.storeId, t.startsAt)],
);

export const promos = sqliteTable(
  "promos",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    /** Stored uppercase; matched case-insensitively. */
    code: text("code").notNull(),
    kind: text("kind").$type<"percent" | "fixed">().notNull(),
    /** Percent 1-100, or minor units in the store currency. */
    value: integer("value").notNull(),
    productId: text("product_id"),
    expiresOn: text("expires_on"),
    maxRedemptions: integer("max_redemptions"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("promos_store_code").on(t.storeId, t.code)],
);

export const visits = sqliteTable(
  "visits",
  {
    id: text("id").primaryKey(),
    storeId: text("store_id").notNull(),
    productId: text("product_id"),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("visits_store_idx").on(t.storeId, t.createdAt)],
);
