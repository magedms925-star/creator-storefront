import { env } from "cloudflare:workers";
import { getEveryAppUser } from "@every-app/sdk/server";
import type { ProductItem } from "./products";

/** The signed-in member behind a private server route. */
export async function memberOf(request: Request) {
  return getEveryAppUser(request, env).catch(() => null);
}

export async function fileResponse(bucket: R2Bucket, item: ProductItem): Promise<Response> {
  const object = item.fileKey ? await bucket.get(item.fileKey) : null;
  if (!object) return new Response("Not found", { status: 404 });
  const name = (item.fileName ?? "file").replace(/["\\\r\n]/g, "_");
  return new Response(object.body, {
    headers: {
      "content-type": item.contentType ?? "application/octet-stream",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "private, no-store",
    },
  });
}
