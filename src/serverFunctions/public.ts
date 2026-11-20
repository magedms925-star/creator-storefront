import { createServerFn } from "@tanstack/react-start";
import { notFound } from "@tanstack/react-router";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { getAccess } from "@/server/orders";
import { productPage, storePage } from "@/server/storefront";

// Public pages: no member needed, and each returns only what a visitor may see.

/** The visitor's country: ?country=, else the one Cloudflare saw. */
function visitorCountry(given: string | undefined): string | null {
  if (given && /^[A-Za-z]{2}$/.test(given)) return given.toUpperCase();
  const request = getRequest();
  const cf = (request as Request & { cf?: { country?: string } }).cf;
  return cf?.country ?? request.headers.get("cf-ipcountry");
}

export const getStorePage = createServerFn()
  .validator((data: unknown) => z.object({ slug: z.string().max(60), country: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    const country = visitorCountry(data.country);
    const page = await storePage(data.slug, country);
    if (!page) throw notFound();
    return page;
  });

export const getProductPage = createServerFn()
  .validator((data: unknown) => z.object({ slug: z.string().max(60), productId: z.string().max(60), country: z.string().optional() }).parse(data))
  .handler(async ({ data }) => {
    if (!z.string().uuid().safeParse(data.productId).success) throw notFound();
    const page = await productPage(data.slug, data.productId);
    if (!page) throw notFound();
    return { ...page, country: visitorCountry(data.country) ?? "" };
  });

export const getAccessPage = createServerFn()
  .validator((data: unknown) => z.object({ token: z.string().max(100) }).parse(data))
  .handler(async ({ data }) => {
    const access = await getAccess(data.token);
    if (!access) throw notFound();
    return access;
  });
