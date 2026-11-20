import { Plus, X } from "lucide-react";
import { useState } from "react";
import { FormField } from "@/client/components/FormField";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/client/components/ui/native-select";
import { Textarea } from "@/client/components/ui/textarea";
import type { AvailabilityWindow, CountryPrice, LiveSession, ProductType } from "@/db/schema";
import { PRODUCT_TYPE_LABELS } from "@/lib/money";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ProductValues {
  type: ProductType;
  title: string;
  description: string;
  price: number;
  countryPrices: CountryPrice[];
  status: "draft" | "published";
  durationMinutes: number | null;
  bufferMinutes: number | null;
  location: string;
  availability: AvailabilityWindow[];
  sessions: LiveSession[];
  capacity: number | null;
}

export const EMPTY_PRODUCT: ProductValues = {
  type: "one_on_one",
  title: "",
  description: "",
  price: 0,
  countryPrices: [],
  status: "draft",
  durationMinutes: 60,
  bufferMinutes: 0,
  location: "",
  availability: [1, 2, 3, 4, 5].map((day) => ({ day, start: "09:00", end: "17:00" })),
  sessions: [],
  capacity: null,
};

const toLocal = (ms: number) => new Date(ms).toISOString().slice(0, 16);
const fromLocal = (value: string) => Date.parse(`${value}:00Z`);
const major = (minor: number) => String(minor / 100);

/** Values from the database (minor units) as form state (strings). */
function toState(v: ProductValues) {
  return {
    type: v.type,
    title: v.title,
    description: v.description,
    price: major(v.price),
    countryPrices: v.countryPrices.map((c) => ({ country: c.country, amount: major(c.amount), currency: c.currency })),
    status: v.status,
    duration: String(v.durationMinutes ?? 60),
    buffer: String(v.bufferMinutes ?? 0),
    location: v.location,
    days: DAYS.map((_, day) => {
      const w = v.availability.find((a) => a.day === day);
      return { start: w?.start ?? "", end: w?.end ?? "" };
    }),
    sessions: v.sessions.map((s) => ({ start: toLocal(s.startsAt), duration: String(s.durationMinutes) })),
    capacity: v.capacity ? String(v.capacity) : "",
  };
}

const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

export function ProductForm({
  initial,
  currency,
  typeLocked,
  submitLabel,
  onSubmit,
}: {
  initial: ProductValues;
  currency: string;
  typeLocked: boolean;
  submitLabel: string;
  onSubmit: (input: Record<string, unknown>) => Promise<void>;
}) {
  const [s, setS] = useState(() => toState(initial));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const patch = (change: Partial<typeof s>) => setS((prev) => ({ ...prev, ...change }));

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const price = num(s.price);
    if (Number.isNaN(price)) return setError("Enter a price, or 0 for free.");
    const input = {
      type: s.type,
      title: s.title,
      description: s.description,
      price,
      countryPrices: s.countryPrices.map((c) => ({ country: c.country, amount: num(c.amount) || 0, currency: c.currency })),
      status: s.status,
      durationMinutes: s.type === "one_on_one" ? num(s.duration) || null : null,
      bufferMinutes: s.type === "one_on_one" ? num(s.buffer) || 0 : null,
      location: s.location,
      availability: s.days
        .map((d, day) => ({ day, start: d.start, end: d.end }))
        .filter((d) => d.start && d.end),
      sessions: s.sessions
        .filter((x) => x.start)
        .map((x) => ({ startsAt: fromLocal(x.start), durationMinutes: num(x.duration) || 60 })),
      capacity: s.capacity ? num(s.capacity) : null,
    };
    setPending(true);
    try {
      await onSubmit(input);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="max-w-2xl space-y-6">
      {!typeLocked ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="group" aria-label="Type">
          {(Object.keys(PRODUCT_TYPE_LABELS) as ProductType[]).map((t) => (
            <Button
              key={t}
              type="button"
              variant={s.type === t ? "default" : "outline"}
              data-testid={`type-${t}`}
              aria-pressed={s.type === t}
              onClick={() => patch({ type: t })}
            >
              {PRODUCT_TYPE_LABELS[t]}
            </Button>
          ))}
        </div>
      ) : null}
      <FormField label="Title" htmlFor="title">
        <Input id="title" data-testid="product-title" value={s.title} onChange={(e) => patch({ title: e.target.value })} required />
      </FormField>
      <FormField label="Description" htmlFor="description">
        <Textarea id="description" data-testid="product-description" rows={4} value={s.description} onChange={(e) => patch({ description: e.target.value })} />
      </FormField>
      <FormField label={`Price (${currency})`} htmlFor="price" hint="0 makes it free">
        <Input id="price" data-testid="product-price" type="number" min="0" step="0.01" className="w-40" value={s.price} onChange={(e) => patch({ price: e.target.value })} required />
      </FormField>

      <section className="space-y-3">
        <h2 className="text-sm font-medium">Prices by country</h2>
        {s.countryPrices.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input aria-label="Country code" placeholder="GB" maxLength={2} className="w-20 uppercase" data-testid={`price-country-${i}`} value={c.country}
              onChange={(e) => patch({ countryPrices: s.countryPrices.map((x, j) => (j === i ? { ...x, country: e.target.value } : x)) })} />
            <Input aria-label="Amount" type="number" min="0" step="0.01" className="w-32" data-testid={`price-amount-${i}`} value={c.amount}
              onChange={(e) => patch({ countryPrices: s.countryPrices.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)) })} />
            <Input aria-label="Currency code" placeholder="GBP" maxLength={3} className="w-24 uppercase" data-testid={`price-currency-${i}`} value={c.currency}
              onChange={(e) => patch({ countryPrices: s.countryPrices.map((x, j) => (j === i ? { ...x, currency: e.target.value } : x)) })} />
            <Button type="button" variant="ghost" size="icon" aria-label="Remove price"
              onClick={() => patch({ countryPrices: s.countryPrices.filter((_, j) => j !== i) })}>
              <X aria-hidden />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" data-testid="add-country-price"
          onClick={() => patch({ countryPrices: [...s.countryPrices, { country: "", amount: "", currency }] })}>
          <Plus aria-hidden />
          Add country price
        </Button>
      </section>

      {s.type === "one_on_one" ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Length (minutes)" htmlFor="duration">
              <Input id="duration" type="number" min="5" data-testid="product-duration" value={s.duration} onChange={(e) => patch({ duration: e.target.value })} />
            </FormField>
            <FormField label="Break after each session (minutes)" htmlFor="buffer">
              <Input id="buffer" type="number" min="0" data-testid="product-buffer" value={s.buffer} onChange={(e) => patch({ buffer: e.target.value })} />
            </FormField>
          </div>
          <FormField label="Meeting link or place" htmlFor="location" hint="Buyers see it after paying">
            <Input id="location" data-testid="product-location" value={s.location} onChange={(e) => patch({ location: e.target.value })} />
          </FormField>
          <section className="space-y-3">
            <div>
              <h2 className="text-sm font-medium">Weekly hours (UTC)</h2>
              <p className="text-xs text-muted-foreground">Leave a day empty to close it.</p>
            </div>
            {DAYS.map((name, day) => (
              <div key={name} className="flex items-center gap-2">
                <span className="w-24 text-sm">{name}</span>
                <Input type="time" aria-label={`${name} from`} className="w-32" data-testid={`avail-${day}-start`} value={s.days[day]!.start}
                  onChange={(e) => patch({ days: s.days.map((d, j) => (j === day ? { ...d, start: e.target.value } : d)) })} />
                <span className="text-sm text-muted-foreground">to</span>
                <Input type="time" aria-label={`${name} until`} className="w-32" data-testid={`avail-${day}-end`} value={s.days[day]!.end}
                  onChange={(e) => patch({ days: s.days.map((d, j) => (j === day ? { ...d, end: e.target.value } : d)) })} />
              </div>
            ))}
          </section>
        </>
      ) : null}

      {s.type === "live_course" ? (
        <>
          <FormField label="Meeting link" htmlFor="location" hint="Buyers see it after paying">
            <Input id="location" data-testid="product-location" value={s.location} onChange={(e) => patch({ location: e.target.value })} />
          </FormField>
          <FormField label="Seats" htmlFor="capacity" hint="Empty for no limit">
            <Input id="capacity" type="number" min="1" className="w-32" data-testid="product-capacity" value={s.capacity} onChange={(e) => patch({ capacity: e.target.value })} />
          </FormField>
          <section className="space-y-3">
            <h2 className="text-sm font-medium">Sessions (UTC)</h2>
            {s.sessions.map((x, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input type="datetime-local" aria-label="Starts" className="w-56" data-testid={`session-start-${i}`} value={x.start}
                  onChange={(e) => patch({ sessions: s.sessions.map((y, j) => (j === i ? { ...y, start: e.target.value } : y)) })} />
                <Input type="number" min="5" aria-label="Minutes" className="w-24" data-testid={`session-duration-${i}`} value={x.duration}
                  onChange={(e) => patch({ sessions: s.sessions.map((y, j) => (j === i ? { ...y, duration: e.target.value } : y)) })} />
                <span className="text-sm text-muted-foreground">min</span>
                <Button type="button" variant="ghost" size="icon" aria-label="Remove session"
                  onClick={() => patch({ sessions: s.sessions.filter((_, j) => j !== i) })}>
                  <X aria-hidden />
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" size="sm" data-testid="add-session"
              onClick={() => patch({ sessions: [...s.sessions, { start: "", duration: "60" }] })}>
              <Plus aria-hidden />
              Add session
            </Button>
          </section>
        </>
      ) : null}

      <FormField label="Status" htmlFor="status">
        <NativeSelect id="status" data-testid="product-status" value={s.status} onChange={(e) => patch({ status: e.target.value as "draft" | "published" })}>
          <NativeSelectOption value="draft">Draft</NativeSelectOption>
          <NativeSelectOption value="published">Published</NativeSelectOption>
        </NativeSelect>
      </FormField>
      {error ? (
        <Alert variant="destructive" data-testid="product-error">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" data-testid="product-save" disabled={pending}>
        {submitLabel}
      </Button>
    </form>
  );
}
