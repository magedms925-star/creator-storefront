import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { FormField } from "@/client/components/FormField";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicShell } from "@/client/components/PublicShell";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { PRODUCT_TYPE_LABELS, formatDateTime, formatMoney } from "@/lib/money";
import { getProductPage } from "@/serverFunctions/public";

export const Route = createFileRoute("/s/$slug/$productId")({
  validateSearch: (search: Record<string, unknown>): { country?: string } =>
    typeof search.country === "string" ? { country: search.country } : {},
  loaderDeps: ({ search }) => ({ country: search.country }),
  loader: ({ params, deps }) =>
    getProductPage({ data: { slug: params.slug, productId: params.productId, country: deps.country } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `${loaderData.product.title} · ${loaderData.store.name}` }] : [] }),
  component: ProductPage,
});

const dayLabel = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(ms);
const timeLabel = (ms: number) =>
  new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" }).format(ms);

function ProductPage() {
  const { store, product, slots, seatsLeft, paymentsReady, country: visitorCountry } = Route.useLoaderData();
  const [slot, setSlot] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState(visitorCountry);
  const [promo, setPromo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const price = useMemo(() => {
    const code = country.trim().toUpperCase();
    const override = product.countryPrices.find((p) => p.country === code);
    return override ?? { amount: product.price, currency: store.currency };
  }, [country, product, store.currency]);
  const days = useMemo(() => {
    const groups = new Map<string, number[]>();
    for (const s of slots) groups.set(dayLabel(s), [...(groups.get(dayLabel(s)) ?? []), s]);
    return [...groups];
  }, [slots]);

  const full = seatsLeft === 0;
  const cardNeeded = price.amount > 0 && !paymentsReady;
  const blocked = full || (cardNeeded && !promo.trim()) || (product.type === "one_on_one" && slot === null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/s/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          name,
          email,
          country,
          ...(promo.trim() ? { promoCode: promo.trim() } : {}),
          ...(slot !== null ? { slotStart: slot } : {}),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { accessUrl?: string; checkoutUrl?: string; error?: string };
      const next = body.accessUrl ?? body.checkoutUrl;
      if (!res.ok || !next) throw new Error(body.error ?? "Checkout failed. Try again.");
      window.location.assign(next);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Checkout failed. Try again.");
      setPending(false);
    }
  }

  return (
    <PublicShell store={store}>
      <PageHeader
        title={product.title}
        description={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{PRODUCT_TYPE_LABELS[product.type]}</Badge>
            {product.durationMinutes ? <span>{product.durationMinutes} min</span> : null}
            {product.type === "recorded_course" ? <span>{product.itemCount} lessons</span> : null}
            {product.type === "digital" ? <span>{product.itemCount} {product.itemCount === 1 ? "file" : "files"}</span> : null}
          </div>
        }
        actions={
          <div className="text-2xl font-semibold" data-testid="product-price-display">
            {price.amount === 0 ? "Free" : formatMoney(price.amount, price.currency)}
          </div>
        }
      />
      {product.description ? <p className="whitespace-pre-line text-sm">{product.description}</p> : null}

      {product.type === "live_course" ? (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <ul className="space-y-1 text-sm">
            {product.sessions.map((s) => (
              <li key={s.startsAt}>
                {formatDateTime(s.startsAt)} · {s.durationMinutes} min
              </li>
            ))}
          </ul>
          {seatsLeft !== null ? (
            <p className="text-sm text-muted-foreground">{full ? "This course is full." : `${seatsLeft} seats left`}</p>
          ) : null}
        </section>
      ) : null}

      {product.type === "one_on_one" ? (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Pick a time (UTC)</h2>
          {days.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open times in the next two weeks.</p>
          ) : (
            days.map(([day, times]) => (
              <div key={day} className="space-y-2">
                <div className="text-sm font-medium">{day}</div>
                <div className="flex flex-wrap gap-2">
                  {times.map((t) => (
                    <Button
                      key={t}
                      type="button"
                      size="sm"
                      variant={slot === t ? "default" : "outline"}
                      aria-pressed={slot === t}
                      data-testid="slot"
                      data-start={t}
                      onClick={() => setSlot(t)}
                    >
                      {timeLabel(t)}
                    </Button>
                  ))}
                </div>
              </div>
            ))
          )}
        </section>
      ) : null}

      <form onSubmit={submit} className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField label="Name" htmlFor="buyer-name">
            <Input id="buyer-name" data-testid="buyer-name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} required />
          </FormField>
          <FormField label="Email" htmlFor="buyer-email">
            <Input id="buyer-email" type="email" data-testid="buyer-email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </FormField>
          <FormField label="Country code" htmlFor="buyer-country">
            <Input id="buyer-country" data-testid="buyer-country" placeholder="US" maxLength={2} className="w-20 uppercase" value={country} onChange={(e) => setCountry(e.target.value)} required />
          </FormField>
          <FormField label="Promo code" htmlFor="promo-input">
            <Input id="promo-input" data-testid="promo-input" className="uppercase" value={promo} onChange={(e) => setPromo(e.target.value)} />
          </FormField>
        </div>
        {cardNeeded ? (
          <Alert data-testid="checkout-unavailable">
            <AlertDescription>Card payment isn't available for this product yet.</AlertDescription>
          </Alert>
        ) : null}
        {error ? (
          <Alert variant="destructive" data-testid="checkout-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" size="lg" className="w-full sm:w-auto" data-testid="checkout-submit" disabled={pending || blocked}>
          {price.amount === 0 ? "Get it" : paymentsReady ? "Continue to payment" : "Check out"}
        </Button>
      </form>
    </PublicShell>
  );
}
