import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

export function BackToProducts() {
  return (
    <Link to="/products" className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground">
      <ChevronLeft className="size-4" aria-hidden />
      Products
    </Link>
  );
}
