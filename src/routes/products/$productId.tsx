import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { ArrowDown, ArrowUp, Download, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/client/components/AppShell";
import { ConfirmDialog } from "@/client/components/ConfirmDialog";
import { FormField } from "@/client/components/FormField";
import { PageHeader } from "@/client/components/PageHeader";
import { ProductForm } from "@/client/components/ProductForm";
import { StoreNav } from "@/client/components/StoreNav";
import { Alert, AlertDescription } from "@/client/components/ui/alert";
import { Badge } from "@/client/components/ui/badge";
import { Button } from "@/client/components/ui/button";
import { Input } from "@/client/components/ui/input";
import { PRODUCT_TYPE_LABELS } from "@/lib/money";
import { addLesson, deleteItem, deleteProduct, getProduct, moveItem, updateProduct } from "@/serverFunctions/products";
import { BackToProducts } from "@/client/components/BackToProducts";

export const Route = createFileRoute("/products/$productId")({
  loader: ({ params }) => getProduct({ data: { id: params.productId } }),
  head: ({ loaderData }) => ({ meta: [{ title: `${loaderData?.product.title ?? "Product"} · Creator Storefront` }] }),
  component: EditProduct,
});

function EditProduct() {
  const { store, product, items } = Route.useLoaderData();
  const router = useRouter();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    setDeleting(true);
    try {
      await deleteProduct({ data: { id: product.id } });
      await navigate({ to: "/products" });
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Couldn't delete it.");
      setDeleting(false);
      setConfirming(false);
    }
  }

  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader
        title={product.title}
        backLink={<BackToProducts />}
        description={<Badge variant="outline">{PRODUCT_TYPE_LABELS[product.type]}</Badge>}
        actions={
          <Button variant="outline" data-testid="delete-product" onClick={() => setConfirming(true)}>
            <Trash2 aria-hidden />
            Delete
          </Button>
        }
      />
      {product.type === "recorded_course" || product.type === "digital" ? (
        <Items productId={product.id} lessons={product.type === "recorded_course"} items={items} onChange={() => router.invalidate()} />
      ) : null}
      <ProductForm
        key={product.updatedAt}
        initial={product}
        currency={store.currency}
        typeLocked
        submitLabel="Save"
        onSubmit={async (input) => {
          await updateProduct({ data: { id: product.id, ...input } });
          toast.success("Saved");
          await router.invalidate();
        }}
      />
      {confirming ? (
        <ConfirmDialog
          title={`Delete ${product.title}?`}
          confirmLabel="Delete product"
          destructive
          pending={deleting}
          onConfirm={() => void remove()}
          onClose={() => setConfirming(false)}
        >
          Its page goes offline and buyers lose access to its files and lessons.
        </ConfirmDialog>
      ) : null}
    </AppShell>
  );
}

type Item = { id: string; kind: string; title: string; videoUrl: string | null; fileName: string | null; fileSize: number | null };

function size(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function Items({ productId, lessons, items, onChange }: { productId: string; lessons: boolean; items: Item[]; onChange: () => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [video, setVideo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  async function run(work: () => Promise<unknown>) {
    setError(null);
    setBusy(true);
    try {
      await work();
      await onChange();
      return true;
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That didn't work.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function upload(file: File) {
    const ok = await run(async () => {
      const form = new FormData();
      form.set("file", file);
      if (lessons && title.trim()) form.set("title", title.trim());
      const res = await fetch(`/api/uploads/${productId}`, { method: "POST", body: form });
      if (!res.ok) throw new Error(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "Upload failed.");
    });
    if (ok) setTitle("");
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <section className="max-w-2xl space-y-4">
      <h2 className="text-lg font-semibold">{lessons ? "Lessons" : "Files"}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{lessons ? "No lessons yet." : "No files yet."}</p>
      ) : (
        <ol className="divide-y divide-border rounded-lg border border-border bg-card">
          {items.map((item, index) => (
            <li key={item.id} data-testid="item-row" data-item-id={item.id} className="flex items-center gap-2 px-3 py-2 text-sm">
              <span className="w-6 text-muted-foreground">{index + 1}.</span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium">{item.title}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {item.videoUrl ?? [item.fileName !== item.title ? item.fileName : null, size(item.fileSize)].filter(Boolean).join(" · ")}
                </div>
              </div>
              {item.fileName ? (
                <Button size="icon-xs" variant="ghost" aria-label="Download" render={<a href={`/api/files/${item.id}`} />}>
                  <Download aria-hidden />
                </Button>
              ) : null}
              <Button size="icon-xs" variant="ghost" aria-label="Move up" disabled={busy || index === 0} onClick={() => void run(() => moveItem({ data: { id: item.id, direction: "up" } }))}>
                <ArrowUp aria-hidden />
              </Button>
              <Button size="icon-xs" variant="ghost" aria-label="Move down" disabled={busy || index === items.length - 1} onClick={() => void run(() => moveItem({ data: { id: item.id, direction: "down" } }))}>
                <ArrowDown aria-hidden />
              </Button>
              <Button size="icon-xs" variant="ghost" aria-label="Remove" disabled={busy} onClick={() => void run(() => deleteItem({ data: { id: item.id } }))}>
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ol>
      )}
      {lessons ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Lesson title" htmlFor="lesson-title">
            <Input id="lesson-title" data-testid="lesson-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </FormField>
          <FormField label="Video link" htmlFor="lesson-video">
            <Input id="lesson-video" data-testid="lesson-video" placeholder="https://" value={video} onChange={(e) => setVideo(e.target.value)} />
          </FormField>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {lessons ? (
          <Button
            type="button"
            data-testid="add-lesson"
            disabled={busy}
            onClick={async () => {
              if (await run(() => addLesson({ data: { productId, title, videoUrl: video } }))) {
                setTitle("");
                setVideo("");
              }
            }}
          >
            Add lesson
          </Button>
        ) : null}
        <Button type="button" variant="outline" disabled={busy} onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden />
          {lessons ? "Upload lesson file" : "Upload file"}
        </Button>
        <input
          ref={fileInput}
          type="file"
          className="sr-only"
          data-testid="file-input"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
      </div>
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
