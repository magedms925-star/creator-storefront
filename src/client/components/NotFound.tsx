import { EmptyState } from "@/client/components/EmptyState";

export function NotFound() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-16" data-testid="not-found">
      <EmptyState kind="filtered" title="Page not found" description="The link may be wrong, or the page was removed." />
    </main>
  );
}
