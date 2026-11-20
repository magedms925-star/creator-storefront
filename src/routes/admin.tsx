import { createFileRoute, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { EmptyState } from "@/client/components/EmptyState";
import { PageHeader } from "@/client/components/PageHeader";
import { StoreNav } from "@/client/components/StoreNav";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/client/components/ui/table";
import { getAdminStores } from "@/serverFunctions/admin";

export const Route = createFileRoute("/admin")({
  loader: () => getAdminStores(),
  head: () => ({ meta: [{ title: "Admin · Creator Storefront" }] }),
  component: Admin,
});

function Admin() {
  const data = Route.useLoaderData();
  const router = useRouter();

  async function toggle(id: string, disabled: boolean) {
    const res = await fetch(`/api/admin/stores/${id}/${disabled ? "enable" : "disable"}`, { method: "POST" });
    if (!res.ok) toast.error("Couldn't change the store.");
    await router.invalidate();
  }

  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader title="Stores" />
      {!data.admin ? (
        <div data-testid="admin-only">
          <EmptyState kind="error" title="Admins only" description="Ask a workspace admin to manage stores." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Store</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.stores.map((s) => (
                <TableRow key={s.id} data-testid="admin-store-row">
                  <TableCell>
                    <div className="font-medium">{s.name}</div>
                    <div className="text-xs text-muted-foreground">/s/{s.slug}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{s.ownerEmail}</TableCell>
                  <TableCell>
                    <Badge variant={s.disabled ? "destructive" : "soft"} data-testid="store-state">
                      {s.disabled ? "Disabled" : "Live"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="xs" variant="ghost" data-testid="store-toggle" onClick={() => void toggle(s.id, s.disabled)}>
                      {s.disabled ? "Turn on" : "Turn off"}
                    </Button>
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
