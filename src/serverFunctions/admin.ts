import { createServerFn } from "@tanstack/react-start";
import { isAdmin } from "@every-app/sdk/server";
import { ensureUserMiddleware } from "@every-app/sdk/tanstack-start";
import { listAllStores } from "@/server/stores";

export const getAdminStores = createServerFn()
  .middleware([ensureUserMiddleware])
  .handler(async ({ context: { user } }) => {
    if (!isAdmin(user)) return { admin: false as const, stores: [] };
    return { admin: true as const, stores: await listAllStores() };
  });
