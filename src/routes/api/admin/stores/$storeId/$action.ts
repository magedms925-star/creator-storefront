import { createFileRoute } from "@tanstack/react-router";
import { isAdmin } from "@every-app/sdk/server";
import { memberOf } from "@/server/http";
import { setStoreDisabled } from "@/server/stores";

// Private and admin-only: turn a member's public store off or back on.
export const Route = createFileRoute("/api/admin/stores/$storeId/$action")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { storeId: string; action: string } }) => {
        const user = await memberOf(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        if (!isAdmin(user)) return Response.json({ error: "Admins only." }, { status: 403 });
        if (params.action !== "disable" && params.action !== "enable") return new Response("Not found", { status: 404 });
        const ok = await setStoreDisabled(params.storeId, params.action === "disable");
        return ok ? Response.json({ ok: true }) : Response.json({ error: "Store not found." }, { status: 404 });
      },
    },
  },
});
