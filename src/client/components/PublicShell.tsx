import type { ReactNode } from "react";
import { ThemePreferenceRadio } from "@/client/components/ThemePreferenceMenuItems";

/** The frame of the pages visitors see: no way into the workspace, one column. */
export function PublicShell({ store, children }: { store?: { name: string; slug: string }; children: ReactNode }) {
  return (
    <div className="flex h-dvh flex-col">
      <header className="shrink-0 border-b border-border">
        <div className="mx-auto flex h-12 w-full max-w-3xl items-center justify-between gap-3 px-4 md:px-10">
          {store ? (
            <a href={`/s/${store.slug}`} className="truncate text-sm font-medium hover:underline">
              {store.name}
            </a>
          ) : (
            <span />
          )}
          <ThemePreferenceRadio />
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <main className="mx-auto w-full max-w-3xl space-y-8 px-4 pt-8 pb-24 md:px-10 md:pt-10">{children}</main>
      </div>
    </div>
  );
}
