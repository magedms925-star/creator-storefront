import { createHmac } from "node:crypto";
import { expect } from "/home/user/oss-new/control/runtime/index.mjs";

export const WEBHOOK_SECRET = "whsec_local_check_value";

/** The optional Payments feature: no card key (checkout off), a local webhook secret. */
export const bindings = {
  STRIPE_SECRET_KEY: { type: "text", value: "" },
  STRIPE_WEBHOOK_SECRET: { type: "text", value: WEBHOOK_SECRET },
};

export async function saveStore(page, { slug, name, headline = "", bio = "", currency = "USD" }) {
  await page.goto("/settings");
  await page.getByTestId("store-slug").fill(slug);
  await page.getByTestId("store-name").fill(name);
  await page.getByTestId("store-headline").fill(headline);
  await page.getByTestId("store-bio").fill(bio);
  await page.getByTestId("store-currency").fill(currency);
  await page.getByTestId("store-save").click();
  await expect(page.getByTestId("store-saved")).toBeVisible();
}

/** Creates a product through the form and returns its id. */
export async function createProduct(page, p) {
  await page.goto("/products/new");
  await page.getByTestId(`type-${p.type}`).click();
  await page.getByTestId("product-title").fill(p.title);
  await page.getByTestId("product-description").fill(p.description ?? "");
  await page.getByTestId("product-price").fill(String(p.price ?? 0));
  if (p.duration) await page.getByTestId("product-duration").fill(String(p.duration));
  if (p.buffer !== undefined) await page.getByTestId("product-buffer").fill(String(p.buffer));
  if (p.location) await page.getByTestId("product-location").fill(p.location);
  if (p.capacity) await page.getByTestId("product-capacity").fill(String(p.capacity));
  if (p.allDays) {
    for (const day of [0, 6]) {
      await page.getByTestId(`avail-${day}-start`).fill("09:00");
      await page.getByTestId(`avail-${day}-end`).fill("17:00");
    }
  }
  for (const [i, s] of (p.sessions ?? []).entries()) {
    await page.getByTestId("add-session").click();
    await page.getByTestId(`session-start-${i}`).fill(s.start);
    await page.getByTestId(`session-duration-${i}`).fill(String(s.duration));
  }
  for (const [i, c] of (p.countryPrices ?? []).entries()) {
    await page.getByTestId("add-country-price").click();
    await page.getByTestId(`price-country-${i}`).fill(c.country);
    await page.getByTestId(`price-amount-${i}`).fill(String(c.amount));
    await page.getByTestId(`price-currency-${i}`).fill(c.currency);
  }
  await page.getByTestId("product-status").selectOption(p.published ? "published" : "draft");
  await Promise.all([
    page.waitForURL(/\/products\/[0-9a-f-]{36}$/),
    page.getByTestId("product-save").click(),
  ]);
  await expect(page.getByTestId("product-title")).toHaveValue(p.title);
  return new URL(page.url()).pathname.split("/").pop();
}

/** On a product's edit page: uploads one file and waits for its row. */
export async function uploadFile(page, name, text) {
  await page.getByTestId("file-input").setInputFiles({ name, mimeType: "text/plain", buffer: Buffer.from(text) });
  await expect(page.getByTestId("item-row").filter({ hasText: name })).toBeVisible();
}

export async function checkout(runtime, body) {
  const res = await runtime.fetch("/s/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

export function tokenOf(accessUrl) {
  return new URL(accessUrl, "http://x").pathname.split("/").pop();
}

export function signedWebhook(payload, secret = WEBHOOK_SECRET) {
  const body = JSON.stringify(payload);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");
  return { body, signature: `t=${t},v1=${v1}` };
}
