import { env } from "cloudflare:workers";

/** Card checkout needs the owner's Stripe secret key. */
export function paymentsReady(): boolean {
  return !!env.STRIPE_SECRET_KEY;
}

export async function createCheckoutSession(opts: {
  orderId: string;
  title: string;
  amount: number;
  currency: string;
  email: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ id: string; url: string }> {
  const body = new URLSearchParams({
    mode: "payment",
    success_url: opts.successUrl,
    cancel_url: opts.cancelUrl,
    customer_email: opts.email,
    client_reference_id: opts.orderId,
    "metadata[order_id]": opts.orderId,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": opts.currency.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(opts.amount),
    "line_items[0][price_data][product_data][name]": opts.title,
  });
  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });
  if (!res.ok) throw new Error(`Stripe answered ${res.status}`);
  const data = (await res.json()) as { id: string; url: string };
  return { id: data.id, url: data.url };
}

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function equal(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Checks a Stripe-Signature header (t=…,v1=…) over the raw body, within five minutes. */
export async function verifyStripeSignature(secret: string, header: string | null, body: string, now = Date.now()) {
  if (!header) return false;
  const parts = header.split(",").map((p) => p.trim().split("="));
  const t = parts.find(([k]) => k === "t")?.[1];
  const signatures = parts.filter(([k]) => k === "v1").map(([, v]) => v ?? "");
  if (!t || !signatures.length || Math.abs(now / 1000 - Number(t)) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = hex(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`)));
  return signatures.some((s) => equal(s, expected));
}
