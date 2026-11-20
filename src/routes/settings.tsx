import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/client/components/AppShell";
import { FormField } from "@/client/components/FormField";
import { PageHeader } from "@/client/components/PageHeader";
import { StoreNav } from "@/client/components/StoreNav";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { Textarea } from "@/client/components/ui/textarea";
import { getMyStore, saveStore } from "@/serverFunctions/store";

export const Route = createFileRoute("/settings")({
  loader: () => getMyStore(),
  head: () => ({ meta: [{ title: "Store · Creator Storefront" }] }),
  component: Settings,
});

function Settings() {
  const store = Route.useLoaderData();
  const router = useRouter();
  const [form, setForm] = useState({
    slug: store.slug,
    name: store.name,
    headline: store.headline,
    bio: store.bio,
    currency: store.currency,
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setSaved(false);
    setForm({ ...form, [key]: e.target.value });
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await saveStore({ data: form });
      setSaved(true);
      await router.invalidate();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Couldn't save.");
    } finally {
      setPending(false);
    }
  }

  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader title="Store" />
      {store.disabled ? (
        <Alert variant="destructive">
          <AlertDescription>A workspace admin turned this store off. Its public pages are offline.</AlertDescription>
        </Alert>
      ) : null}
      <form onSubmit={submit} className="max-w-xl space-y-5">
        <FormField label="Store address" htmlFor="slug" hint={`/s/${form.slug || "…"}`}>
          <Input id="slug" data-testid="store-slug" value={form.slug} onChange={set("slug")} required />
        </FormField>
        <FormField label="Name" htmlFor="name">
          <Input id="name" data-testid="store-name" value={form.name} onChange={set("name")} required />
        </FormField>
        <FormField label="Headline" htmlFor="headline">
          <Input id="headline" data-testid="store-headline" value={form.headline} onChange={set("headline")} />
        </FormField>
        <FormField label="Bio" htmlFor="bio">
          <Textarea id="bio" data-testid="store-bio" value={form.bio} onChange={set("bio")} rows={4} />
        </FormField>
        <FormField label="Currency" htmlFor="currency" hint="3-letter code, such as USD or EUR">
          <Input id="currency" data-testid="store-currency" value={form.currency} onChange={set("currency")} maxLength={3} className="w-28 uppercase" required />
        </FormField>
        {error ? (
          <Alert variant="destructive" data-testid="store-error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <div className="flex items-center gap-3">
          <Button type="submit" data-testid="store-save" disabled={pending}>
            Save
          </Button>
          {saved ? (
            <span className="text-sm text-muted-foreground" data-testid="store-saved">
              Saved
            </span>
          ) : null}
        </div>
      </form>
    </AppShell>
  );
}
