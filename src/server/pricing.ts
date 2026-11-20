import type { AvailabilityWindow, CountryPrice } from "@/db/schema";

export const HOLD_MINUTES = 30;
export const BOOKING_DAYS = 14;

/** The price a buyer from `country` sees: their override, else the base price. */
export function priceFor(
  product: { price: number; countryPrices: CountryPrice[] },
  storeCurrency: string,
  country: string | null | undefined,
): { amount: number; currency: string } {
  const code = country?.trim().toUpperCase();
  const override = code ? product.countryPrices.find((p) => p.country === code) : undefined;
  return override
    ? { amount: override.amount, currency: override.currency }
    : { amount: product.price, currency: storeCurrency };
}

export interface PromoRule {
  storeId: string;
  kind: "percent" | "fixed";
  value: number;
  productId: string | null;
  expiresOn: string | null;
  maxRedemptions: number | null;
  active: boolean;
}

/** Why a code can't be used, or null when it can. */
export function promoRefusal(
  promo: PromoRule | undefined,
  ctx: { storeId: string; productId: string; now: number; redeemed: number },
): string | null {
  if (!promo || promo.storeId !== ctx.storeId) return "That code doesn't exist.";
  if (!promo.active) return "That code is no longer active.";
  if (promo.expiresOn && Date.parse(`${promo.expiresOn}T23:59:59.999Z`) < ctx.now) return "That code has expired.";
  if (promo.productId && promo.productId !== ctx.productId) return "That code doesn't apply to this product.";
  if (promo.maxRedemptions !== null && ctx.redeemed >= promo.maxRedemptions) return "That code has been used up.";
  return null;
}

/** Amount off, never more than the price. Fixed amounts are in minor units. */
export function discountFor(promo: Pick<PromoRule, "kind" | "value">, amount: number): number {
  const off = promo.kind === "percent" ? Math.round((amount * promo.value) / 100) : promo.value;
  return Math.max(0, Math.min(amount, off));
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** Start times (ms, UTC) from weekly windows, skipping past times and held intervals. */
export function generateSlots(opts: {
  availability: AvailabilityWindow[];
  durationMinutes: number;
  bufferMinutes: number;
  now: number;
  held: { startsAt: number; endsAt: number }[];
  days?: number;
}): number[] {
  const { availability, durationMinutes, bufferMinutes, now, held } = opts;
  if (durationMinutes <= 0) return [];
  const step = (durationMinutes + bufferMinutes) * 60_000;
  const length = durationMinutes * 60_000;
  const today = new Date(now);
  const day0 = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const out: number[] = [];
  for (let d = 0; d <= (opts.days ?? BOOKING_DAYS); d++) {
    const dayStart = day0 + d * 86_400_000;
    const weekday = new Date(dayStart).getUTCDay();
    for (const w of availability.filter((w) => w.day === weekday)) {
      const end = dayStart + minutes(w.end) * 60_000;
      for (let s = dayStart + minutes(w.start) * 60_000; s + length <= end; s += step) {
        if (s <= now) continue;
        const e = s + step;
        if (held.some((h) => s < h.endsAt && h.startsAt < e)) continue;
        out.push(s);
      }
    }
  }
  return [...new Set(out)].sort((a, b) => a - b);
}
