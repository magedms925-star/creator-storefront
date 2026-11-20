import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { fileResponse, memberOf } from "@/server/http";
import { getOwnedItem } from "@/server/products";

// Private: an owner downloads their own upload.
export const Route = createFileRoute("/api/files/$itemId")({
  server: {
    handlers: {
      GET: async ({ request, params }: { request: Request; params: { itemId: string } }) => {
        const user = await memberOf(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const item = await getOwnedItem(user.id, params.itemId);
        if (!item) return new Response("Not found", { status: 404 });
        return fileResponse(env.files, item);
      },
    },
  },
});
