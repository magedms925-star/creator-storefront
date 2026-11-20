import { describe, expect, it } from "vitest";
import { discountFor, generateSlots, priceFor, promoRefusal } from "./pricing";

const promo = { storeId: "s1", kind: "percent" as const, value: 10, productId: null, expiresOn: null, maxRedemptions: null, active: true };
const ctx = { storeId: "s1", productId: "p1", now: Date.parse("2030-01-01T00:00:00Z"), redeemed: 0 };

describe("pricing", () => {
  it("uses the country override when there is one", () => {
    const p = { price: 4000, countryPrices: [{ country: "GB", amount: 3000, currency: "GBP" }] };
    expect(priceFor(p, "USD", "gb")).toEqual({ amount: 3000, currency: "GBP" });
    expect(priceFor(p, "USD", "FR")).toEqual({ amount: 4000, currency: "USD" });
  });
  it("never discounts below zero", () => {
    expect(discountFor({ kind: "fixed", value: 900 }, 500)).toBe(500);
    expect(discountFor({ kind: "percent", value: 25 }, 1000)).toBe(250);
  });
  it("refuses codes that can't be used", () => {
    expect(promoRefusal(promo, ctx)).toBeNull();
    expect(promoRefusal(undefined, ctx)).toMatch(/exist/);
    expect(promoRefusal({ ...promo, storeId: "s2" }, ctx)).toMatch(/exist/);
    expect(promoRefusal({ ...promo, active: false }, ctx)).toMatch(/active/);
    expect(promoRefusal({ ...promo, expiresOn: "2029-12-31" }, ctx)).toMatch(/expired/);
    expect(promoRefusal({ ...promo, productId: "p2" }, ctx)).toMatch(/product/);
    expect(promoRefusal({ ...promo, maxRedemptions: 1 }, { ...ctx, redeemed: 1 })).toMatch(/used up/);
  });
});

describe("slots", () => {
  const base = { availability: [{ day: 1, start: "09:00", end: "12:00" }], durationMinutes: 45, bufferMinutes: 15, days: 0 };
  it("steps by duration plus buffer and skips past times", () => {
    const now = Date.parse("2030-01-07T10:10:00Z"); // a Monday
    expect(generateSlots({ ...base, now, held: [] }).map((s) => new Date(s).toISOString())).toEqual([
      "2030-01-07T11:00:00.000Z",
    ]);
  });
  it("skips held times", () => {
    const early = Date.parse("2030-01-07T08:00:00Z");
    const held = [{ startsAt: Date.parse("2030-01-07T10:00:00Z"), endsAt: Date.parse("2030-01-07T11:00:00Z") }];
    expect(generateSlots({ ...base, now: early, held }).map((s) => new Date(s).toISOString())).toEqual([
      "2030-01-07T09:00:00.000Z",
      "2030-01-07T11:00:00.000Z",
    ]);
  });
});
