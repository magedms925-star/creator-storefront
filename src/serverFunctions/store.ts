import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { getDashboard, PERIODS, type Period } from "@/server/dashboard";
import { getOrCreateStore, storeInput, updateStore } from "@/server/stores";
import { parse } from "./validate";

export const getMyStore = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    const s = await getOrCreateStore(user);
    return { slug: s.slug, name: s.name, headline: s.headline, bio: s.bio, currency: s.currency, disabled: s.disabled };
  });

export const saveStore = createServerFn({ method: "POST" })
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => parse(storeInput, data))
  .handler(async ({ data, context: { user } }) => {
    await getOrCreateStore(user);
    const s = await updateStore(user.id, data);
    return { slug: s.slug };
  });

export const getDashboardData = createServerFn()
  .middleware([ensureUserMiddleware])
  .validator((data: unknown) => {
    const period = (data as { period?: string })?.period;
    return { period: (period && period in PERIODS ? period : "30d") as Period };
  })
  .handler(async ({ data, context: { user } }) => {
    await getOrCreateStore(user);
    return (await getDashboard(user.id, data.period))!;
  });
