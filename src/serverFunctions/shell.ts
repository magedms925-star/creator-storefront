import { env } from "cloudflare:workers";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ConfigurationError, getEveryAppUser, gatewayUrl, isAdmin } from "@every-app/sdk/server";

/**
 * The way back to the Gateway for members, and whether they're an admin.
 * Public pages call it too, so it answers nulls to anonymous visitors.
 */
export const getShell = createServerFn().handler(async () => {
  const user = await getEveryAppUser(getRequest(), env).catch(() => null);
  if (!user) return { gatewayUrl: null, admin: false };
  try {
    return { gatewayUrl: new URL(gatewayUrl(env)).origin, admin: isAdmin(user) };
  } catch (error) {
    if (!(error instanceof ConfigurationError)) throw error;
    return { gatewayUrl: null, admin: isAdmin(user) };
  }
});
