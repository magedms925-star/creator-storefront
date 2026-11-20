import { createFileRoute } from "@tanstack/react-router";
import { Download, PlayCircle } from "lucide-react";
import { PageHeader } from "@/client/components/PageHeader";
import { PublicShell } from "@/client/components/PublicShell";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { formatDateTime, formatMoney } from "@/lib/money";
import { getAccessPage } from "@/serverFunctions/public";

export const Route = createFileRoute("/s/access/$token")({
  loader: ({ params }) => getAccessPage({ data: { token: params.token } }),
  head: ({ loaderData }) => ({ meta: [{ title: loaderData?.productTitle ?? "Your order" }, { name: "robots", content: "noindex" }] }),
  component: AccessPage,
});

const STATUS = { paid: "Paid", pending: "Awaiting payment", cancelled: "Cancelled" } as const;

function isWebLink(value: string) {
  return /^https?:\/\//i.test(value);
}

function AccessPage() {
  const access = Route.useLoaderData();
  const { token } = Route.useParams();
  const content = access.content;
  return (
    <PublicShell>
      <PageHeader
        title={access.productTitle}
        description={`${access.storeName} · ${access.amount === 0 ? "Free" : formatMoney(access.amount, access.currency)}`}
        actions={
          <Badge variant={access.status === "paid" ? "soft" : access.status === "cancelled" ? "destructive" : "outline"} data-testid="access-status">
            {STATUS[access.status]}
          </Badge>
        }
      />
      {access.status === "pending" ? (
        <Alert>
          <AlertDescription>Your payment hasn't come through yet. Reload this page in a minute.</AlertDescription>
        </Alert>
      ) : null}
      {access.status === "cancelled" ? (
        <Alert variant="destructive">
          <AlertDescription>The seller cancelled this order.</AlertDescription>
        </Alert>
      ) : null}
      {content ? (
        <>
          {content.type === "one_on_one" && content.slotStart ? (
            <section className="space-y-2 rounded-lg border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">Your session</h2>
              <p data-testid="booking-time">
                {formatDateTime(content.slotStart)} · {content.durationMinutes} min
              </p>
              <Meeting location={content.location} />
            </section>
          ) : null}
          {content.type === "live_course" ? (
            <section className="space-y-2 rounded-lg border border-border bg-card p-4">
              <h2 className="text-lg font-semibold">Sessions</h2>
              <ul className="space-y-1 text-sm">
                {content.sessions.map((s) => (
                  <li key={s.startsAt} data-testid="live-session">
                    {formatDateTime(s.startsAt)} · {s.durationMinutes} min
                  </li>
                ))}
              </ul>
              <Meeting location={content.location} />
            </section>
          ) : null}
          {content.items.length ? (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold">{content.type === "recorded_course" ? "Lessons" : "Files"}</h2>
              <ol className="divide-y divide-border rounded-lg border border-border bg-card">
                {content.items.map((item, i) => (
                  <li key={item.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm" data-testid={item.kind === "lesson" ? "access-lesson" : undefined}>
                    <span className="min-w-0 truncate">
                      {content.type === "recorded_course" ? `${i + 1}. ` : ""}
                      {item.title}
                    </span>
                    {item.videoUrl ? (
                      <Button size="sm" variant="outline" render={<a href={item.videoUrl} target="_blank" rel="noreferrer" />}>
                        <PlayCircle aria-hidden />
                        Watch
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" data-testid="access-file" render={<a href={`/s/access/${token}/files/${item.id}`} />}>
                        <Download aria-hidden />
                        {item.fileName}
                      </Button>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          ) : null}
        </>
      ) : null}
    </PublicShell>
  );
}

function Meeting({ location }: { location: string }) {
  if (!location) return null;
  return isWebLink(location) ? (
    <a href={location} target="_blank" rel="noreferrer" className="text-sm text-primary underline" data-testid="meeting-link">
      {location}
    </a>
  ) : (
    <p className="text-sm" data-testid="meeting-link">
      {location}
    </p>
  );
}
