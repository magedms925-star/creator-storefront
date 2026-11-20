import { createFileRoute } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicShell } from "@/client/components/PublicShell";
import { Badge } from "@/client/components/ui/badge";
import { PRODUCT_TYPE_LABELS, formatDateTime, formatMoney } from "@/lib/money";
import { getStorePage } from "@/serverFunctions/public";

export const Route = createFileRoute("/s/$slug/")({
  validateSearch: (search: Record<string, unknown>): { country?: string } =>
    typeof search.country === "string" ? { country: search.country } : {},
  loaderDeps: ({ search }) => ({ country: search.country }),
  loader: ({ params, deps }) => getStorePage({ data: { slug: params.slug, country: deps.country } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: loaderData.store.name }] : [] }),
  component: StorePage,
});

function StorePage() {
  const { store, products } = Route.useLoaderData();
  return (
    <PublicShell>
      <PageHeader title={store.name} description={store.headline || undefined} />
      {store.bio ? <p className="whitespace-pre-line text-sm">{store.bio}</p> : null}
      {products.length === 0 ? (
        <EmptyState title="Nothing for sale yet" />
      ) : (
        <ul className="grid gap-3">
          {products.map((p) => (
            <li key={p.id} data-testid="store-product">
              <a
                href={`/s/${store.slug}/${p.id}`}
                className="flex items-center gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:bg-foreground/5"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="font-medium">{p.title}</div>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                    <Badge variant="outline">{PRODUCT_TYPE_LABELS[p.type]}</Badge>
                    {p.durationMinutes ? <span>{p.durationMinutes} min</span> : null}
                    {p.nextSession ? <span>Starts {formatDateTime(p.nextSession)}</span> : null}
                  </div>
                </div>
                <div className="shrink-0 font-semibold">{p.price.amount === 0 ? "Free" : formatMoney(p.price.amount, p.price.currency)}</div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}
