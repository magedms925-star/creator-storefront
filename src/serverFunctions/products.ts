import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as products from "@/server/products";
import { getOrCreateStore } from "@/server/stores";
import { parse } from "./validate";

const idInput = z.object({ id: z.string().uuid() }).strict();

export const getProducts = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    const store = await getOrCreateStore(user);
    const list = await products.listProducts(user.id);
    return {
      origin: new URL(getRequest().url).origin,
      store: { slug: store.slug, currency: store.currency },
      products: list.map((p) => ({ id: p.id, type: p.type, title: p.title, price: p.price, status: p.status })),
    };
  });

export const getProduct = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(z.object({ id: z.string() }).strict(), data))
  .handler(async ({ data, context: { user } }) => {
    const store = await getOrCreateStore(user);
    const owned = z.string().uuid().safeParse(data.id).success ? await products.getOwnedProduct(user.id, data.id) : null;
    if (!owned) throw notFound();
    return { store: { slug: store.slug, currency: store.currency }, ...owned };
  });

export const getNewProductContext = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    const store = await getOrCreateStore(user);
    return { currency: store.currency };
  });

export const createProduct = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(products.productInput, data))
  .handler(async ({ data, context: { user } }) => {
    await getOrCreateStore(user);
    return { id: await products.createProduct(user.id, data) };
  });

export const updateProduct = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => {
    const { id, ...rest } = data as { id: unknown };
    return { id: parse(z.string().uuid(), id), input: parse(products.productInput, rest) };
  })
  .handler(async ({ data, context: { user } }) => {
    if (!(await products.updateProduct(user.id, data.id, data.input))) throw new Error("Product not found.");
  });

export const setProductStatus = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    parse(z.object({ id: z.string().uuid(), status: z.enum(["draft", "published"]) }).strict(), data),
  )
  .handler(async ({ data, context: { user } }) => {
    if (!(await products.setProductStatus(user.id, data.id, data.status))) throw new Error("Product not found.");
  });

export const deleteProduct = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(idInput, data))
  .handler(async ({ data, context: { user } }) => {
    if (!(await products.deleteProduct(user.id, data.id))) throw new Error("Product not found.");
  });

export const addLesson = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(products.lessonInput, data))
  .handler(async ({ data, context: { user } }) => {
    if (!(await products.addLesson(user.id, data))) throw new Error("Product not found.");
  });

export const deleteItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(idInput, data))
  .handler(async ({ data, context: { user } }) => {
    if (!(await products.deleteItem(user.id, data.id))) throw new Error("Not found.");
  });

export const moveItem = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) =>
    parse(z.object({ id: z.string().uuid(), direction: z.enum(["up", "down"]) }).strict(), data),
  )
  .handler(async ({ data, context: { user } }) => {
    if (!(await products.moveItem(user.id, data.id, data.direction))) throw new Error("Not found.");
  });
