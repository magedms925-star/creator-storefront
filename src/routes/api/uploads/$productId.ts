import { createFileRoute } from "@tanstack/react-router";
import { memberOf } from "@/server/http";
import { addFile, MAX_UPLOAD_BYTES } from "@/server/products";

// Private: an owner uploads a file to one of their products.
export const Route = createFileRoute("/api/uploads/$productId")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { productId: string } }) => {
        const user = await memberOf(request);
        if (!user) return new Response("Unauthorized", { status: 401 });
        const form = await request.formData().catch(() => null);
        const file = form?.get("file");
        if (!(file instanceof File) || file.size === 0) return Response.json({ error: "Choose a file." }, { status: 400 });
        if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "Files can be up to 100 MB." }, { status: 413 });
        const title = form?.get("title");
        const ok = await addFile(user.id, params.productId, file, typeof title === "string" ? title : null);
        if (!ok) return Response.json({ error: "Product not found." }, { status: 404 });
        return Response.json({ ok: true }, { status: 201 });
      },
    },
  },
});
