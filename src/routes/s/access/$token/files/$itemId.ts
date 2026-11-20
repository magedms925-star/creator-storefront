import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { buyerFile } from "@/server/orders";
import { fileResponse } from "@/server/http";

// Public: the access token is the buyer's key. Only paid orders get the file.
export const Route = createFileRoute("/s/access/$token/files/$itemId")({
  server: {
    handlers: {
      GET: async ({ params }: { params: { token: string; itemId: string } }) => {
        const result = await buyerFile(params.token, params.itemId);
        if (result.status !== 200) return new Response(result.status === 403 ? "Not available" : "Not found", { status: result.status });
        return fileResponse(env.files, result.item);
      },
    },
  },
});
