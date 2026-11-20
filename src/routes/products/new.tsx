import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/client/components/AppShell";
import { PageHeader } from "@/client/components/PageHeader";
import { EMPTY_PRODUCT, ProductForm } from "@/client/components/ProductForm";
import { StoreNav } from "@/client/components/StoreNav";
import { BackToProducts } from "@/client/components/BackToProducts";
import { createProduct, getNewProductContext } from "@/serverFunctions/products";

export const Route = createFileRoute("/products/new")({
  loader: () => getNewProductContext(),
  head: () => ({ meta: [{ title: "New product · Creator Storefront" }] }),
  component: NewProduct,
});

function NewProduct() {
  const { currency } = Route.useLoaderData();
  const navigate = useNavigate();
  return (
    <AppShell nav={<StoreNav />}>
      <PageHeader title="New product" backLink={<BackToProducts />} />
      <ProductForm
        initial={EMPTY_PRODUCT}
        currency={currency}
        typeLocked={false}
        submitLabel="Create product"
        onSubmit={async (input) => {
          const { id } = await createProduct({ data: input });
          await navigate({ to: "/products/$productId", params: { productId: id } });
        }}
      />
    </AppShell>
  );
}
