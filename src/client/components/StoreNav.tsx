import { Link, useRouterState } from "@tanstack/react-router";

const LINKS = [
  { to: "/", label: "Dashboard" },
  { to: "/products", label: "Products" },
  { to: "/orders", label: "Orders" },
  { to: "/promos", label: "Promo codes" },
  { to: "/settings", label: "Store" },
] as const;

/** The member pages, plus Admin for workspace admins. */
export function StoreNav() {
  const admin = useRouterState({
    select: (state) => {
      const root = state.matches[0]?.loaderData as { admin?: boolean } | undefined;
      return root?.admin ?? false;
    },
  });
  const links = admin ? [...LINKS, { to: "/admin", label: "Admin" } as const] : LINKS;
  return (
    <nav className="flex shrink-0 items-center gap-3 text-sm">
      {links.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          activeOptions={{ exact: link.to === "/" }}
          className="whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[status=active]:font-medium data-[status=active]:text-foreground"
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
