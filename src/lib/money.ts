/** Formats minor units (cents) in an ISO currency. */
export function formatMoney(minor: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(minor / 100);
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

/** "12.5" as 1250. */
export function toMinor(amount: number): number {
  return Math.round(amount * 100);
}

export const PRODUCT_TYPE_LABELS = {
  one_on_one: "1:1 session",
  live_course: "Live course",
  recorded_course: "Recorded course",
  digital: "Digital download",
} as const;

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", timeZone: "UTC",
  }).format(ms) + " UTC";
}
