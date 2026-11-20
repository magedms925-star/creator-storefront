import { createFileRoute } from "@tanstack/react-router";
import { memberOf } from "@/server/http";
import { cancelOrder } from "@/server/orders";

// Private: an owner cancels one of their store's orders.
export const Route = createFileRoute("/api/orders/$orderId/cancel")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { orderId: string } }) => {
        const user = await memberOf(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        if (!(await cancelOrder(user.id, params.orderId))) return Response.json({ error: "Order not found." }, { status: 404 });
        return Response.json({ ok: true });
      },
    },
  },
});
