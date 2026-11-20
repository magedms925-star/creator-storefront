// Persistence: stores, products, files and orders survive a restart.
import { startRuntime, expect } from "/home/user/oss-new/control/runtime/index.mjs";
import { bindings, saveStore, createProduct, uploadFile, checkout, tokenOf } from "./helpers.mjs";

const runtime = await startRuntime({ bindings });
try {
  const owner = await (await runtime.context("owner")).newPage();
  await saveStore(owner, { slug: "kept-store", name: "Kept Store", headline: "Prints and guides" });
  const id = await createProduct(owner, { type: "digital", title: "Darkroom guide", price: 0, published: true });
  await uploadFile(owner, "darkroom.txt", "stop bath after developer");
  const sale = await checkout(runtime, { productId: id, name: "Kim Park", email: "kim@example.com", country: "KR" });
  expect(sale.status).toBe(200);

  await runtime.restart();

  const store = await (await runtime.fetch("/s/kept-store")).text();
  expect(store).toContain("Kept Store");
  expect(store).toContain("Darkroom guide");
  const access = await (await runtime.fetch(`/s/access/${tokenOf(sale.data.accessUrl)}`)).text();
  expect(access).toContain("Paid");
  expect(access).toContain("darkroom.txt");
  const page = await (await runtime.context("owner")).newPage();
  await page.goto("/orders");
  await expect(page.getByTestId("order-row").filter({ hasText: "kim@example.com" })).toBeVisible();
  await page.goto(`/products/${id}`);
  await expect(page.getByTestId("item-row").filter({ hasText: "darkroom.txt" })).toBeVisible();
  console.log("persistence: ok");
} finally {
  await runtime.close();
}
