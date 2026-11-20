// Authorization: private paths, public surface, per-member stores, admin-only actions, no own sign-in (X001).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { bindings, saveStore, createProduct, uploadFile, checkout, tokenOf, signedWebhook } from "./helpers.mjs";

const runtime = await startRuntime({ bindings });
const post = (path, role) => runtime.fetch(path, { role, method: "POST", headers: { "sec-fetch-site": "same-origin", "content-type": "application/json" }, body: "{}" });
try {
  await runtime.assertPrivateAccess(["/", "/products", "/products/new", "/orders", "/promos", "/settings"]);

  const owner = await (await runtime.context("owner")).newPage();
  await saveStore(owner, { slug: "north-studio", name: "North Studio" });
  const notesId = await createProduct(owner, { type: "digital", title: "Field notes", price: 0, published: true });
  await uploadFile(owner, "notes.txt", "private field notes");
  const itemId = await owner.getByTestId("item-row").first().getAttribute("data-item-id");
  const draftId = await createProduct(owner, { type: "digital", title: "Draft idea", price: 3, published: false });

  const member = await (await runtime.context("member")).newPage();
  await saveStore(member, { slug: "member-shop", name: "Member Shop" });
  await member.goto("/promos");
  await member.getByTestId("promo-code").fill("MEMBER50");
  await member.getByTestId("promo-value").fill("50");
  await member.getByTestId("promo-save").click();
  await expect(member.getByTestId("promo-row").filter({ hasText: "MEMBER50" })).toBeVisible();

  // Slugs stay unique across stores.
  await member.goto("/settings");
  await member.getByTestId("store-slug").fill("north-studio");
  await member.getByTestId("store-save").click();
  await expect(member.getByTestId("store-error")).toBeVisible();

  // One member never reads or changes another's products, files, orders or codes.
  await member.goto(`/products/${notesId}`);
  await expect(member.getByTestId("not-found")).toBeVisible();
  await expect(member.getByTestId("product-title")).toHaveCount(0);
  await member.goto("/products");
  await expect(member.getByText("Field notes")).toHaveCount(0);
  expect((await runtime.fetch(`/api/files/${itemId}`, { role: "member" })).status).toBe(404);
  expect((await runtime.fetch(`/api/files/${itemId}`, { role: "owner" })).status).toBe(200);
  expect([401, 403]).toContain((await runtime.fetch(`/api/files/${itemId}`)).status);

  const sale = await checkout(runtime, { productId: notesId, name: "Ines Costa", email: "ines@example.com", country: "PT" });
  expect(sale.status).toBe(200);
  const orderRow = await (await runtime.database()).prepare("SELECT id FROM orders WHERE buyer_email = ?").bind("ines@example.com").first();
  await member.goto("/orders");
  await expect(member.getByText("ines@example.com")).toHaveCount(0);
  expect((await post(`/api/orders/${orderRow.id}/cancel`, "member")).status).toBe(404);
  expect([401, 403]).toContain((await post(`/api/orders/${orderRow.id}/cancel`)).status);
  const still = await (await runtime.database()).prepare("SELECT status FROM orders WHERE id = ?").bind(orderRow.id).first();
  expect(still.status).toBe("paid");

  // Another store's promo code is refused.
  const foreign = await checkout(runtime, { productId: notesId, name: "Ines", email: "ines@example.com", country: "PT", promoCode: "MEMBER50" });
  expect(foreign.status).toBe(400);

  // Public routes show only what they should.
  const storeHtml = await (await runtime.fetch("/s/north-studio")).text();
  expect(storeHtml).toContain("Field notes");
  expect(storeHtml).not.toContain("Draft idea");
  expect(storeHtml).not.toContain("ines@example.com");
  expect(storeHtml).not.toContain("notes.txt");
  const productHtml = await (await runtime.fetch(`/s/north-studio/${notesId}`)).text();
  expect(productHtml).not.toContain("notes.txt");
  expect(productHtml).not.toContain(itemId);
  expect((await runtime.fetch(`/s/north-studio/${draftId}`)).status).toBe(404);
  expect((await runtime.fetch(`/s/member-shop/${notesId}`)).status).toBe(404);
  expect((await runtime.fetch(`/s/access/not-a-real-token-0123456789`)).status).toBe(404);
  expect((await runtime.fetch(`/s/access/${tokenOf(sale.data.accessUrl)}`, { role: "outsider" })).status).toBe(200);
  expect([403, 404]).toContain((await runtime.fetch(`/s/access/not-a-real-token-0123456789/files/${itemId}`)).status);
  const outsiderStore = await runtime.fetch("/s/north-studio", { role: "outsider" });
  expect(outsiderStore.status).toBe(200);
  const badHook = signedWebhook({ type: "checkout.session.completed", data: { object: { id: "cs_x" } } }, "whsec_forged");
  expect((await runtime.fetch("/hooks/payments", { method: "POST", headers: { "stripe-signature": badHook.signature }, body: badHook.body })).status).toBe(400);
  expect((await runtime.fetch("/hooks/payments", { method: "POST", body: "{}" })).status).toBe(400);

  // Owner cancels their own order: access ends.
  expect((await post(`/api/orders/${orderRow.id}/cancel`, "owner")).status).toBe(200);
  const fileUrl = `/s/access/${tokenOf(sale.data.accessUrl)}/files/${itemId}`;
  expect((await runtime.fetch(fileUrl)).status).toBe(403);

  // Admin-only: disabling a store.
  const memberStore = await (await runtime.database()).prepare("SELECT id FROM stores WHERE slug = 'member-shop'").first();
  expect((await post(`/api/admin/stores/${memberStore.id}/disable`, "member")).status).toBe(403);
  expect([401, 403]).toContain((await post(`/api/admin/stores/${memberStore.id}/disable`)).status);
  await member.goto("/admin");
  await expect(member.getByTestId("admin-only")).toBeVisible();
  await expect(member.getByTestId("admin-store-row")).toHaveCount(0);
  expect((await runtime.fetch("/s/member-shop")).status).toBe(200);
  await owner.goto("/admin");
  const row = owner.getByTestId("admin-store-row").filter({ hasText: "member-shop" });
  await row.getByTestId("store-toggle").click();
  await expect(row.getByTestId("store-state")).toHaveText(/Disabled/);
  expect((await runtime.fetch("/s/member-shop")).status).toBe(404);
  expect((await post(`/api/admin/stores/${memberStore.id}/enable`, "owner")).status).toBe(200);
  expect((await runtime.fetch("/s/member-shop")).status).toBe(200);

  // X001: the app serves no sign-in of its own.
  for (const path of ["/login", "/signin", "/sign-in", "/signup", "/register", "/logout", "/auth/login"]) {
    const res = await runtime.fetch(path, { role: "member" });
    expect(res.status).toBe(404);
    expect((await res.text()).toLowerCase()).not.toContain('type="password"');
  }
  console.log("authorization: ok");
} finally {
  await runtime.close();
}
