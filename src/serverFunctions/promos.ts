import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { z } from "zod";
import * as promos from "@/server/promos";
import { listProducts } from "@/server/products";
import { getOrCreateStore } from "@/server/stores";
import { parse } from "./validate";

export const getPromos = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    await getOrCreateStore(user);
    const [list, products] = await Promise.all([promos.listPromos(user.id), listProducts(user.id)]);
    return { ...list, products: products.map((p) => ({ id: p.id, title: p.title })) };
  });

export const createPromo = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(promos.promoInput, data))
  .handler(({ data, context: { user } }) => promos.createPromo(user.id, data));

export const setPromoActive = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(z.object({ id: z.string().uuid(), active: z.boolean() }).strict(), data))
  .handler(async ({ data, context: { user } }) => {
    if (!(await promos.setPromoActive(user.id, data.id, data.active))) throw new Error("Code not found.");
  });

export const deletePromo = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(z.object({ id: z.string().uuid() }).strict(), data))
  .handler(async ({ data, context: { user } }) => {
    if (!(await promos.deletePromo(user.id, data.id))) throw new Error("Code not found.");
  });
