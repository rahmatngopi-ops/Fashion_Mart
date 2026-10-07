import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { Input } from "@/components/ui/input";
import ProductCard from "@/components/ProductCard";
import { cn } from "@/lib/utils";

export default function Products() {
  const { t } = useI18n();
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const { data: all, isError } = useQuery({ queryKey: ["products", "all"], queryFn: () => apiGet<Product[]>("/products") });
  const categories = Array.from(new Set((all ?? []).map((p) => p.category))).sort();
  const shown = (all ?? []).filter(
    (p) => (!category || p.category === category) && (!q || p.name.toLowerCase().includes(q.toLowerCase())),
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
      <p className="text-xs uppercase tracking-[0.25em] text-brand">FASHION_MART</p>
      <h1 className="mt-2 font-heading text-4xl md:text-5xl" data-testid="products-title">{t("nav_shop")}</h1>

      <div className="mt-8 flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-2">
          {["", ...categories].map((c) => (
            <button
              key={c || "all"}
              type="button"
              onClick={() => setCategory(c)}
              data-testid={`category-filter-${c ? c.toLowerCase() : "all"}`}
              className={cn(
                "rounded-full border px-4 py-1.5 text-xs font-medium uppercase tracking-wider transition-colors duration-200",
                category === c ? "border-ink bg-ink text-parchment" : "border-border bg-white hover:border-ink",
              )}
            >
              {c || t("all")}
            </button>
          ))}
        </div>
        <div className="relative md:w-72">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("search")} className="h-10 bg-white pl-9" data-testid="products-search-input" />
        </div>
      </div>

      <div className="mt-10 grid grid-cols-2 gap-x-4 gap-y-10 md:gap-x-8 lg:grid-cols-4" data-testid="products-grid">
        {!isError && shown.map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
        {!all && !isError && Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-sm bg-muted" />)}
      </div>
      {all && shown.length === 0 && <p className="py-16 text-center text-sm text-muted-foreground" data-testid="products-empty">—</p>}
    </div>
  );
}
