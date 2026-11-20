import { createServerFn } from "@tanstack/react-start";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { listOrders } from "@/server/orders";
import { getOrCreateStore } from "@/server/stores";

export const getOrders = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    const store = await getOrCreateStore(user);
    return { currency: store.currency, ...(await listOrders(user.id)) };
  });
