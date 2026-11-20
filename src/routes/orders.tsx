import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StoreNav } from "@/client/components/StoreNav";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/client/components/ui/tabs";
import { formatDateTime, formatMoney } from "@/lib/money";
import { getOrders } from "@/serverFunctions/orders";

export const Route = createFileRoute("/orders")({
  loader: () => getOrders(),
  head: () => ({ meta: [{ title: "Orders · Creator Storefront" }] }),
  component: Orders,
});

const STATUS = {
  paid: { label: "Paid", variant: "soft" },
  pending: { label: "Awaiting payment", variant: "outline" },
  cancelled: { label: "Cancelled", variant: "destructive" },
} as const;

const date = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(ms);

function Orders() {
  const { orders, customers, bookings } = Route.useLoaderData();
  const router = useRouter();
  const [cancelling, setCancelling] = useState<{ id: string; title: string } | null>(null);
  const [pending, setPending] = useState(false);

  async function cancel() {
    if (!cancelling) return;
    setPending(true);
    try {
      const res = await fetch(`/api/orders/${cancelling.id}/cancel`, { method: "POST" });
      if (!res.ok) throw new Error("Couldn't cancel the order.");
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't cancel the order.");
    } finally {
      setPending(false);
      setCancelling(null);
    }
  }

  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader title="Orders" />
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Upcoming bookings</h2>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">No sessions booked.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border bg-card">
            {bookings.map((b) => (
              <li key={b.id} data-testid="booking-row" className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{formatDateTime(b.startsAt)}</div>
                  <div className="text-muted-foreground">
                    {b.productTitle} · {b.buyerName} ({b.buyerEmail})
                  </div>
                </div>
                {b.status === "pending" ? <Badge variant="outline">Awaiting payment</Badge> : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <Tabs defaultValue="orders" className="space-y-4">
        <TabsList>
          <TabsTrigger value="orders" data-testid="tab-orders">
            Orders
          </TabsTrigger>
          <TabsTrigger value="customers" data-testid="tab-customers">
            Customers
          </TabsTrigger>
        </TabsList>
        <TabsContent value="orders">
          {orders.length === 0 ? (
            <EmptyState media="rows" title="No orders yet" description="Orders appear here when someone checks out from your store." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Buyer</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((o) => (
                    <TableRow key={o.id} data-testid="order-row">
                      <TableCell className="whitespace-nowrap text-muted-foreground">{date(o.createdAt)}</TableCell>
                      <TableCell>
                        <div className="font-medium">{o.buyerName}</div>
                        <div className="text-xs text-muted-foreground">
                          {o.buyerEmail} · {o.buyerCountry}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div>{o.productTitle ?? "Removed product"}</div>
                        {o.slotStart ? <div className="text-xs text-muted-foreground">{formatDateTime(o.slotStart)}</div> : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">
                        {formatMoney(o.amount, o.currency)}
                        {o.promoCode ? <div className="font-mono text-xs text-muted-foreground">{o.promoCode}</div> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS[o.status].variant} data-testid="order-status">
                          {STATUS[o.status].label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {o.status !== "cancelled" ? (
                          <Button size="xs" variant="ghost" data-testid="order-cancel" onClick={() => setCancelling({ id: o.id, title: o.productTitle ?? "" })}>
                            Cancel
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
        <TabsContent value="customers">
          {customers.length === 0 ? (
            <EmptyState title="No customers yet" description="Everyone who completes an order is listed here." />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Customer</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Spent</TableHead>
                    <TableHead>Last order</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => (
                    <TableRow key={c.email} data-testid="customer-row">
                      <TableCell>
                        <div className="font-medium">{c.name}</div>
                        <div className="text-xs text-muted-foreground">{c.email}</div>
                      </TableCell>
                      <TableCell>{c.orders}</TableCell>
                      <TableCell>
                        {Object.entries(c.totals)
                          .map(([currency, amount]) => formatMoney(amount, currency))
                          .join(", ")}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{date(c.lastAt)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      </Tabs>
      {cancelling ? (
        <ConfirmDialog
          title={`Cancel this order for ${cancelling.title}?`}
          confirmLabel="Cancel order"
          destructive
          pending={pending}
          onConfirm={() => void cancel()}
          onClose={() => setCancelling(null)}
        >
          The buyer loses access, and a booked time opens up again. No refund is sent.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}
