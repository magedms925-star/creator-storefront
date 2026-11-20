import { createFileRoute } from "@tanstack/react-router";
import { waitUntil } from "cloudflare:workers";
import { checkout, checkoutInput } from "@/server/orders";

// Public: visitors check out without an account.
export const Route = createFileRoute("/s/api/checkout")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const parsed = checkoutInput.safeParse(await request.json().catch(() => null));
        if (!parsed.success)
          return Response.json({ error: parsed.error.issues[0]?.message ?? "Check the form." }, { status: 400 });
        const result = await checkout(parsed.data, new URL(request.url).origin, waitUntil);
        return Response.json(result.body, { status: result.status });
      },
    },
  },
});
