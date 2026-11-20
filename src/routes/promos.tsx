import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { FormField } from "@/client/components/FormField";
import { PageHeader } from "@/client/components/PageHeader";
import { StoreNav } from "@/client/components/StoreNav";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/client/components/ui/native-select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { formatMoney } from "@/lib/money";
import { createPromo, deletePromo, getPromos, setPromoActive } from "@/serverFunctions/promos";

export const Route = createFileRoute("/promos")({
  loader: () => getPromos(),
  head: () => ({ meta: [{ title: "Promo codes · Creator Storefront" }] }),
  component: Promos,
});

const EMPTY = { code: "", kind: "percent" as "percent" | "fixed", value: "", productId: "", expiresOn: "", max: "" };

function Promos() {
  const { currency, promos, products } = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createPromo({
        data: {
          code: form.code,
          kind: form.kind,
          value: Number(form.value),
          productId: form.productId || null,
          expiresOn: form.expiresOn || null,
          maxRedemptions: form.max ? Number(form.max) : null,
        },
      });
      setForm(EMPTY);
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't add the code.");
    } finally {
      setPending(false);
    }
  }

  async function change(work: () => Promise<unknown>) {
    try {
      await work();
      await router.invalidate();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "That didn't work.");
    }
  }

  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader title="Promo codes" />
      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <FormField label="Code" htmlFor="code">
            <Input id="code" data-testid="promo-code" className="uppercase" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </FormField>
          <FormField label="Discount" htmlFor="kind">
            <NativeSelect id="kind" className="w-full" data-testid="promo-kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as "percent" | "fixed" })}>
              <NativeSelectOption value="percent">Percent off</NativeSelectOption>
              <NativeSelectOption value="fixed">Amount off ({currency})</NativeSelectOption>
            </NativeSelect>
          </FormField>
          <FormField label={form.kind === "percent" ? "Percent" : `Amount (${currency})`} htmlFor="value">
            <Input id="value" type="number" min="0" step={form.kind === "percent" ? "1" : "0.01"} data-testid="promo-value" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} required />
          </FormField>
          <FormField label="Product" htmlFor="product">
            <NativeSelect id="product" className="w-full" data-testid="promo-product" value={form.productId} onChange={(e) => setForm({ ...form, productId: e.target.value })}>
              <NativeSelectOption value="">All products</NativeSelectOption>
              {products.map((p) => (
                <NativeSelectOption key={p.id} value={p.id}>
                  {p.title}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </FormField>
          <FormField label="Last day" htmlFor="expires">
            <Input id="expires" type="date" data-testid="promo-expires" value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
          </FormField>
          <FormField label="Uses" htmlFor="max" hint="Empty for unlimited">
            <Input id="max" type="number" min="1" data-testid="promo-max" value={form.max} onChange={(e) => setForm({ ...form, max: e.target.value })} />
          </FormField>
        </div>
        {error ? (
          <Alert variant="destructive" data-testid="promo-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" data-testid="promo-save" disabled={pending}>
          Add code
        </Button>
      </form>
      {promos.length === 0 ? (
        <EmptyState title="No promo codes yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Applies to</TableHead>
                <TableHead>Last day</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {promos.map((p) => (
                <TableRow key={p.id} data-testid="promo-row">
                  <TableCell className="font-mono font-medium">{p.code}</TableCell>
                  <TableCell>{p.kind === "percent" ? `${p.value}%` : formatMoney(p.value, currency)}</TableCell>
                  <TableCell className="text-muted-foreground">{p.productTitle ?? "All products"}</TableCell>
                  <TableCell className="text-muted-foreground">{p.expiresOn ?? "—"}</TableCell>
                  <TableCell>
                    {p.redeemed}
                    {p.maxRedemptions ? ` / ${p.maxRedemptions}` : ""}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? "soft" : "outline"} data-testid="promo-active">
                      {p.active ? "On" : "Off"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-1">
                      <Button size="xs" variant="ghost" data-testid="promo-toggle" onClick={() => void change(() => setPromoActive({ data: { id: p.id, active: !p.active } }))}>
                        {p.active ? "Turn off" : "Turn on"}
                      </Button>
                      <Button size="icon-xs" variant="ghost" aria-label={`Delete ${p.code}`} onClick={() => void change(() => deletePromo({ data: { id: p.id } }))}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </AppShell>
  );
}
