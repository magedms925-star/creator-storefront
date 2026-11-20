import { Link, createFileRoute } from "@tanstack/react-router";
import { ExternalLink } from "lucide-react";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StoreNav } from "@/client/components/StoreNav";
import { Button } from "@/client/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/client/components/ui/card";
import { formatMoney } from "@/lib/money";
import { getDashboardData } from "@/serverFunctions/store";

const PERIODS = [
  { id: "24h", label: "24 hours" },
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "3m", label: "3 months" },
  { id: "12m", label: "12 months" },
] as const;
type PeriodId = (typeof PERIODS)[number]["id"];

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { period?: PeriodId } => {
    const period = PERIODS.find((p) => p.id === search.period)?.id;
    return period ? { period } : {};
  },
  loaderDeps: ({ search }) => ({ period: search.period ?? "30d" }),
  loader: ({ deps }) => getDashboardData({ data: { period: deps.period } }),
  head: () => ({ meta: [{ title: "Dashboard · Creator Storefront" }] }),
  component: Dashboard,
});

function bucketLabel(start: number, bucket: string): string {
  const options: Intl.DateTimeFormatOptions =
    bucket === "hour"
      ? { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }
      : bucket === "month"
        ? { month: "short", year: "2-digit", timeZone: "UTC" }
        : { day: "numeric", month: "short", timeZone: "UTC" };
  return new Intl.DateTimeFormat("en-GB", options).format(start);
}

function Dashboard() {
  const data = Route.useLoaderData();
  const { period = "30d" } = Route.useSearch();
  const revenue = Object.entries(data.revenue).filter(([, v]) => v > 0);
  const max = Math.max(1, ...data.series.map((p) => p.amount));
  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader
        title={data.store.name}
        description={`/s/${data.store.slug}`}
        actions={
          <Button variant="outline" render={<a href={`/s/${data.store.slug}`} target="_blank" rel="noreferrer" />}>
            <ExternalLink aria-hidden />
            View store
          </Button>
        }
      />
      <div className="flex flex-wrap gap-1" role="group" aria-label="Period">
        {PERIODS.map((p) => (
          <Button
            key={p.id}
            size="sm"
            variant={p.id === period ? "secondary" : "ghost"}
            data-testid={`period-${p.id}`}
            render={<Link to="/" search={{ period: p.id }} />}
          >
            {p.label}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="dashboard-revenue">
            {revenue.length ? (
              revenue.map(([currency, amount]) => <div key={currency}>{formatMoney(amount, currency)}</div>)
            ) : (
              <div>{formatMoney(0, data.store.currency)}</div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid orders</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="dashboard-orders">
            {data.paidOrders}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-muted-foreground">Store visits</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold" data-testid="dashboard-visits">
            {data.visits}
          </CardContent>
        </Card>
      </div>
      <Card data-testid="revenue-chart">
        <CardHeader>
          <CardTitle>Revenue over time ({data.chartCurrency})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex h-40 items-end gap-1">
            {data.series.map((point) => (
              <div
                key={point.start}
                className="flex h-full flex-1 items-end"
                title={`${bucketLabel(point.start, data.bucket)}: ${formatMoney(point.amount, data.chartCurrency)}`}
              >
                <div
                  className={`w-full rounded-sm ${point.amount ? "bg-primary" : "bg-muted"}`}
                  style={{ height: `${point.amount ? Math.max(4, (point.amount / max) * 100) : 1}%` }}
                />
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{bucketLabel(data.series[0]!.start, data.bucket)}</span>
            <span>{bucketLabel(data.series[data.series.length - 1]!.start, data.bucket)}</span>
          </div>
        </CardContent>
      </Card>
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Recent sales</h2>
        {data.recent.length === 0 ? (
          <EmptyState title="No sales yet" description="Publish a product and share its link. Sales show up here." />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {data.recent.map((sale) => (
              <li key={sale.id} data-testid="recent-sale" className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="truncate font-medium">{sale.buyerName}</div>
                  <div className="truncate text-muted-foreground">{sale.productTitle ?? "Removed product"}</div>
                </div>
                <div className="shrink-0 font-medium">{sale.amount === 0 ? "Free" : formatMoney(sale.amount, sale.currency)}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </AppShell>
  );
}
