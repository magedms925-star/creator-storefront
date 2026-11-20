import { createFileRoute } from "@tanstack/react-router";
import { env, waitUntil } from "cloudflare:workers";
import { markPaid } from "@/server/orders";
import { verifyStripeSignature } from "@/server/payments";

// Public: Stripe reports completed checkouts here. Only signed requests count.
export const Route = createFileRoute("/hooks/payments")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const secret = env.STRIPE_WEBHOOK_SECRET;
        if (!secret) return new Response("Not found", { status: 404 });
        const body = await request.text();
        if (!(await verifyStripeSignature(secret, request.headers.get("stripe-signature"), body)))
          return Response.json({ error: "bad signature" }, { status: 400 });
        const event = JSON.parse(body) as { type?: string; data?: { object?: { id?: string; payment_status?: string } } };
        const session = event.data?.object;
        if (
          (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") &&
          session?.id &&
          session.payment_status !== "unpaid"
        ) {
          await markPaid(session.id, new URL(request.url).origin, waitUntil);
        }
        return Response.json({ received: true });
      },
    },
  },
});
