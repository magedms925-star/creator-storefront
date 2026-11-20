import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { ExternalLink, Plus } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { CopyButton } from "@/client/components/CopyButton";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StoreNav } from "@/client/components/StoreNav";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { PRODUCT_TYPE_LABELS, formatMoney } from "@/lib/money";
import { getProducts, setProductStatus } from "@/serverFunctions/products";

export const Route = createFileRoute("/products/")({
  loader: () => getProducts(),
  head: () => ({ meta: [{ title: "Products · Creator Storefront" }] }),
  component: Products,
});

function Products() {
  const { origin, store, products } = Route.useLoaderData();
  const router = useRouter();

  async function toggle(id: string, status: "draft" | "published") {
    try {
      await setProductStatus({ data: { id, status } });
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't change it.");
    }
  }

  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader
        title="Products"
        actions={
          <Button render={<Link to="/products/new" />} data-testid="new-product">
            <Plus aria-hidden />
            New product
          </Button>
        }
      />
      {products.length === 0 ? (
        <EmptyState
          media="rows"
          title="No products yet"
          description="Create a session, course or download to sell."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Share</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((p) => {
                const path = `/s/${store.slug}/${p.id}`;
                const published = p.status === "published";
                return (
                  <TableRow key={p.id} data-testid="product-row">
                    <TableCell className="font-medium">
                      <Link to="/products/$productId" params={{ productId: p.id }} className="hover:underline">
                        {p.title}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{PRODUCT_TYPE_LABELS[p.type]}</TableCell>
                    <TableCell>{p.price === 0 ? "Free" : formatMoney(p.price, store.currency)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant={published ? "soft" : "outline"} data-testid="product-status-badge">
                          {published ? "Published" : "Draft"}
                        </Badge>
                        <Button
                          size="xs"
                          variant="ghost"
                          data-testid="toggle-publish"
                          onClick={() => void toggle(p.id, published ? "draft" : "published")}
                        >
                          {published ? "Unpublish" : "Publish"}
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell>
                      {published ? (
                        <div className="flex items-center justify-end gap-1">
                          <span data-testid="copy-link">
                            <CopyButton value={`${origin}${path}`} label="Copy link" successMessage="Link copied" />
                          </span>
                          <Button
                            size="icon-xs"
                            variant="ghost"
                            aria-label="Open product page"
                            data-testid="open-link"
                            render={<a href={path} target="_blank" rel="noreferrer" />}
                          >
                            <ExternalLink aria-hidden />
                          </Button>
                        </div>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
