// Behavior: every frozen feature's main path (F001-F007).
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { bindings, saveStore, createProduct, uploadFile, checkout, tokenOf, signedWebhook } from "./helpers.mjs";

const runtime = await startRuntime({ bindings });
try {
  const ownerCtx = await runtime.context("owner");
  const page = await ownerCtx.newPage();

  // F001: the store is created on first visit, then edited.
  await page.goto("/");
  await runtime.assertBackLink(page);
  await expect(page.getByTestId("dashboard-revenue")).toBeVisible();
  await saveStore(page, {
    slug: "maya-studio",
    name: "Maya Lin Photography",
    headline: "Editing lessons and portfolio reviews",
    bio: "Wedding and street photographer based in Lisbon.",
    currency: "USD",
  });

  // F002: four product types, local pricing, drafts.
  const reviewId = await createProduct(page, {
    type: "one_on_one", title: "Portfolio review call", description: "A 45 minute look at twenty of your photos.",
    price: 40, duration: 45, buffer: 15, location: "https://meet.example.com/maya-review", allDays: true,
    countryPrices: [{ country: "GB", amount: 30, currency: "GBP" }], published: true,
  });
  const workshopId = await createProduct(page, {
    type: "live_course", title: "Street photography workshop", description: "Two evenings shooting and editing together.",
    price: 25, location: "https://meet.example.com/maya-workshop", capacity: 1,
    sessions: [{ start: "2031-05-10T17:00", duration: 120 }, { start: "2031-05-17T17:00", duration: 120 }], published: true,
  });
  const lessonsId = await createProduct(page, {
    type: "recorded_course", title: "Editing fundamentals", description: "Six short lessons on color and contrast.",
    price: 0, published: true,
  });
  await page.getByTestId("lesson-title").fill("Importing and culling");
  await page.getByTestId("lesson-video").fill("https://video.example.com/importing");
  await page.getByTestId("add-lesson").click();
  await expect(page.getByTestId("item-row").filter({ hasText: "Importing and culling" })).toBeVisible();
  const sheetId = await createProduct(page, {
    type: "digital", title: "Color grading cheat sheet", description: "A one-page reference.", price: 0, published: true,
  });
  await uploadFile(page, "cheat-sheet.txt", "Lift shadows before you warm the highlights.");
  const presetsId = await createProduct(page, {
    type: "digital", title: "Lightroom preset pack", description: "Twelve presets for film looks.", price: 12, published: true,
  });
  await uploadFile(page, "presets.txt", "preset pack contents");
  const draftId = await createProduct(page, { type: "digital", title: "Unreleased guide", price: 5, published: false });

  // Owner's list: share link on the app's host, publish toggle.
  await page.goto("/products");
  const reviewRow = page.getByTestId("product-row").filter({ hasText: "Portfolio review call" });
  await expect(reviewRow.getByTestId("copy-link")).toBeVisible();
  const href = await reviewRow.getByTestId("open-link").getAttribute("href");
  expect(new URL(href, `http://${runtime.hostname}`).hostname).toBe(runtime.hostname);
  expect(new URL(href, "http://x").pathname).toBe(`/s/maya-studio/${reviewId}`);
  const draftRow = page.getByTestId("product-row").filter({ hasText: "Unreleased guide" });
  await expect(draftRow.getByTestId("product-status-badge")).toHaveText(/Draft/);

  // F006: promo codes.
  async function createPromo({ code, kind = "percent", value, product, expires, max }) {
    await page.goto("/promos");
    await page.getByTestId("promo-code").fill(code);
    await page.getByTestId("promo-kind").selectOption(kind);
    await page.getByTestId("promo-value").fill(String(value));
    if (product) await page.getByTestId("promo-product").selectOption({ label: product });
    if (expires) await page.getByTestId("promo-expires").fill(expires);
    if (max) await page.getByTestId("promo-max").fill(String(max));
    await page.getByTestId("promo-save").click();
    await expect(page.getByTestId("promo-row").filter({ hasText: code.toUpperCase() })).toBeVisible();
  }
  await createPromo({ code: "friend100", value: 100 });
  await createPromo({ code: "REVIEW5", kind: "fixed", value: 5, product: "Portfolio review call" });
  await createPromo({ code: "OLDCODE", value: 20, expires: "2020-01-01" });
  await createPromo({ code: "ONCEONLY", value: 100, max: 1 });
  await createPromo({ code: "PAUSED", value: 50 });
  const pausedRow = page.getByTestId("promo-row").filter({ hasText: "PAUSED" });
  await pausedRow.getByTestId("promo-toggle").click();
  await expect(pausedRow.getByTestId("promo-active")).toHaveText(/Off/);

  // F001: public store page, visitor's country price, drafts hidden, unknown slug 404.
  const visitor = await (await runtime.context(null)).newPage();
  await visitor.goto("/s/maya-studio?country=GB");
  await expect(visitor.getByRole("heading", { name: "Maya Lin Photography" })).toBeVisible();
  const reviewCard = visitor.getByTestId("store-product").filter({ hasText: "Portfolio review call" });
  await expect(reviewCard).toContainText("£30.00");
  await expect(reviewCard).toContainText("45 min");
  await expect(visitor.getByTestId("store-product").filter({ hasText: "Lightroom preset pack" })).toContainText("$12.00");
  await expect(visitor.getByText("Unreleased guide")).toHaveCount(0);
  expect((await runtime.fetch("/s/no-such-store")).status).toBe(404);
  expect((await runtime.fetch(`/s/maya-studio/${draftId}`)).status).toBe(404);

  // F004 + F003 + F005: book a session through the page with a 100% code.
  await reviewCard.getByRole("link").first().click();
  await expect(visitor.getByRole("heading", { name: "Portfolio review call" })).toBeVisible();
  const slot = visitor.getByTestId("slot").first();
  const slotStart = Number(await slot.getAttribute("data-start"));
  expect(slotStart).toBeGreaterThan(Date.now());
  await slot.click();
  await visitor.getByTestId("buyer-name").fill("Priya Raman");
  await visitor.getByTestId("buyer-email").fill("priya@example.com");
  await visitor.getByTestId("buyer-country").fill("GB");
  await visitor.getByTestId("promo-input").fill("FRIEND100");
  await Promise.all([visitor.waitForURL(/\/s\/access\/[A-Za-z0-9_-]{20,}$/), visitor.getByTestId("checkout-submit").click()]);
  await expect(visitor.getByTestId("access-status")).toHaveText(/Paid/);
  await expect(visitor.getByTestId("booking-time")).toBeVisible();
  await expect(visitor.getByTestId("meeting-link")).toHaveAttribute("href", "https://meet.example.com/maya-review");
  const bookingToken = tokenOf(visitor.url());

  // F004: the held slot is gone and can't be taken twice.
  const taken = await checkout(runtime, { productId: reviewId, name: "Leo", email: "leo@example.com", country: "PT", promoCode: "friend100", slotStart });
  expect(taken.status).toBe(409);
  const reload = await runtime.fetch(`/s/maya-studio/${reviewId}`);
  expect(await reload.text()).not.toContain(`data-start="${slotStart}"`);

  // F003: paid products without card checkout configured.
  await visitor.goto(`/s/maya-studio/${presetsId}`);
  await expect(visitor.getByTestId("checkout-unavailable")).toBeVisible();
  const unpaid = await checkout(runtime, { productId: presetsId, name: "Sam", email: "sam@example.com", country: "US" });
  expect(unpaid.status).toBe(503);
  expect(unpaid.data.error).toBeTruthy();

  // F006: refusals with messages, fixed amount, product restriction, max redemptions.
  for (const code of ["OLDCODE", "PAUSED", "NOPE"]) {
    const r = await checkout(runtime, { productId: sheetId, name: "Sam", email: "sam@example.com", country: "US", promoCode: code });
    expect(r.status).toBe(400);
    expect(r.data.error).toMatch(/code/i);
  }
  const wrongProduct = await checkout(runtime, { productId: presetsId, name: "Sam", email: "sam@example.com", country: "US", promoCode: "REVIEW5" });
  expect(wrongProduct.status).toBe(400);
  const once = await checkout(runtime, { productId: workshopId, name: "Noor Haddad", email: "noor@example.com", country: "FR", promoCode: "onceonly" });
  expect(once.status).toBe(200);
  // F004: the workshop held one seat and is now full.
  const full = await checkout(runtime, { productId: workshopId, name: "Eli", email: "eli@example.com", country: "FR", promoCode: "FRIEND100" });
  expect(full.status).toBe(409);
  const exhausted = await checkout(runtime, { productId: lessonsId, name: "Eli", email: "eli@example.com", country: "FR", promoCode: "ONCEONLY" });
  expect(exhausted.status).toBe(400);

  // F005: free digital order, file streamed only for that paid order.
  const free = await checkout(runtime, { productId: sheetId, name: "Ana Souza", email: "ana@example.com", country: "BR" });
  expect(free.status).toBe(200);
  expect(new URL(free.data.accessUrl, `http://${runtime.hostname}`).hostname).toBe(runtime.hostname);
  const sheetToken = tokenOf(free.data.accessUrl);
  await visitor.goto(`/s/access/${sheetToken}`);
  const fileLink = visitor.getByTestId("access-file").filter({ hasText: "cheat-sheet.txt" });
  await expect(fileLink).toBeVisible();
  const fileHref = await fileLink.getAttribute("href");
  const download = await runtime.fetch(fileHref);
  expect(download.status).toBe(200);
  expect(await download.text()).toBe("Lift shadows before you warm the highlights.");
  const course = await checkout(runtime, { productId: lessonsId, name: "Ana Souza", email: "ana@example.com", country: "BR" });
  await visitor.goto(new URL(course.data.accessUrl, "http://x").pathname);
  await expect(visitor.getByTestId("access-lesson").filter({ hasText: "Importing and culling" })).toBeVisible();
  await visitor.goto(new URL(once.data.accessUrl, "http://x").pathname);
  await expect(visitor.getByTestId("live-session")).toHaveCount(2);
  await expect(visitor.getByTestId("meeting-link")).toHaveAttribute("href", "https://meet.example.com/maya-workshop");

  // F003: the signed webhook pays a pending order exactly once.
  const db = await runtime.database();
  const store = await db.prepare("SELECT id FROM stores WHERE slug = ?").bind("maya-studio").first();
  const buyers = [["Ana Souza", "ana@example.com", "BR"], ["Tom Becker", "tom@example.com", "DE"], ["Lucia Gomez", "lucia@example.com", "ES"]];
  const now = Date.now();
  for (const [i, [name, email, country]] of buyers.entries()) {
    await db.prepare(`INSERT INTO orders (id, store_id, product_id, buyer_name, buyer_email, buyer_country, amount, currency, discount, status, access_token, provider_session_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 1200, 'USD', 0, 'pending', ?, ?, ?)`)
      .bind(`order-check-${i}`, store.id, presetsId, name, email, country, `tok_check_pending_${i}_abcdefghijkl`, `cs_check_${i}`, now - 1000).run();
  }
  const pendingPage = await runtime.fetch("/s/access/tok_check_pending_1_abcdefghijkl");
  const pendingHtml = await pendingPage.text();
  expect(pendingHtml).toContain("Awaiting payment");
  expect(pendingHtml).not.toContain("presets.txt");
  const bad = signedWebhook({ type: "checkout.session.completed", data: { object: { id: "cs_check_0" } } }, "whsec_wrong");
  expect((await runtime.fetch("/hooks/payments", { method: "POST", headers: { "stripe-signature": bad.signature, "content-type": "application/json" }, body: bad.body })).status).toBe(400);
  for (const i of [0, 1, 2, 0]) {
    const ok = signedWebhook({ id: `evt_${i}`, type: "checkout.session.completed", data: { object: { id: `cs_check_${i}`, payment_status: "paid", client_reference_id: `order-check-${i}` } } });
    const res = await runtime.fetch("/hooks/payments", { method: "POST", headers: { "stripe-signature": ok.signature, "content-type": "application/json" }, body: ok.body });
    expect(res.status).toBe(200);
  }
  const paidRows = await db.prepare("SELECT status, paid_at FROM orders WHERE provider_session_id = 'cs_check_0'").all();
  expect(paidRows.results.length).toBe(1);
  expect(paidRows.results[0].status).toBe("paid");
  const paidAccess = await (await runtime.fetch("/s/access/tok_check_pending_1_abcdefghijkl")).text();
  expect(paidAccess).toContain("presets.txt");

  // F003 + F004: owner's orders, customers and bookings; cancelling frees the slot.
  await page.goto("/orders");
  await expect(page.getByTestId("booking-row").filter({ hasText: "Priya Raman" })).toBeVisible();
  await expect(page.getByTestId("order-row").filter({ hasText: "tom@example.com" })).toBeVisible();
  await page.getByTestId("tab-customers").click();
  const ana = page.getByTestId("customer-row").filter({ hasText: "ana@example.com" });
  await expect(ana).toHaveCount(1);
  await expect(ana).toContainText("$12.00");
  await page.getByTestId("tab-orders").click();
  const priyaOrder = page.getByTestId("order-row").filter({ hasText: "priya@example.com" });
  await priyaOrder.getByTestId("order-cancel").click();
  await page.getByRole("button", { name: "Cancel order" }).click();
  await expect(priyaOrder.getByTestId("order-status")).toHaveText(/Cancelled/);
  const cancelledAccess = await (await runtime.fetch(`/s/access/${bookingToken}`)).text();
  expect(cancelledAccess).toContain("Cancelled");
  expect(cancelledAccess).not.toContain("meet.example.com/maya-review");
  const rebook = await checkout(runtime, { productId: reviewId, name: "Leo Martin", email: "leo@example.com", country: "PT", promoCode: "FRIEND100", slotStart });
  expect(rebook.status).toBe(200);

  // F007: dashboard totals, chart and recent sales for the owner's store only.
  await page.goto("/");
  await page.getByTestId("period-30d").click();
  await expect(page.getByTestId("dashboard-revenue")).toContainText("$36.00");
  await expect(page.getByTestId("dashboard-orders")).toHaveText(/\d+/);
  expect(Number(await page.getByTestId("dashboard-orders").textContent())).toBeGreaterThanOrEqual(6);
  expect(Number(await page.getByTestId("dashboard-visits").textContent())).toBeGreaterThanOrEqual(3);
  await expect(page.getByTestId("revenue-chart")).toBeVisible();
  await expect(page.getByTestId("recent-sale").filter({ hasText: "Lucia Gomez" })).toBeVisible();
  await runtime.screenshot(page);

  // Phone-sized smoke.
  const phone = await (await runtime.context(null, { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phone.goto("/s/maya-studio");
  await expect(phone.getByRole("heading", { name: "Maya Lin Photography" })).toBeVisible();
  await expect(phone.getByTestId("store-product").first()).toBeVisible();
  const phoneOwner = await (await runtime.context("owner", { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await phoneOwner.goto("/products");
  await expect(phoneOwner.getByTestId("product-row").first()).toBeVisible();
  console.log("behavior: ok");
} finally {
  await runtime.close();
}
