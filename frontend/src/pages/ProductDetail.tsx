import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ShoppingBag, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { rupiah } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function ProductDetail() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const cart = useCart();
  const { data: p, isError } = useQuery({ queryKey: ["product", id], queryFn: () => apiGet<Product>(`/products/${id}`) });
  const [size, setSize] = useState("");

  const addToCart = () => {
    if (!p) return;
    const chosen = size || p.sizes[0] || "";
    cart.add({ product_id: p.id, name: p.name, price: p.price, image_url: p.image_url, size: chosen, quantity: 1 });
    toast.success(t("added"), { description: p.name });
    cart.setOpen(true);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8">
      <Link to="/products" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand" data-testid="product-back-link">
        <ArrowLeft className="size-4" /> {t("back")}
      </Link>
      {isError && <p className="py-20 text-center text-muted-foreground" data-testid="product-not-found">404</p>}
      {!p && !isError && <div className="mt-6 aspect-[4/3] animate-pulse rounded-sm bg-muted" />}
      {p && (
        <div className="mt-6 grid gap-10 md:grid-cols-12">
          <div className="md:col-span-7">
            <div className="aspect-[4/5] overflow-hidden rounded-sm bg-muted">
              <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" data-testid="product-image" />
            </div>
          </div>
          <div className="md:col-span-5 md:pt-6">
            <p className="text-xs uppercase tracking-[0.25em] text-brand">{p.category}</p>
            <h1 className="mt-3 font-heading text-4xl leading-tight md:text-5xl" data-testid="product-name">{p.name}</h1>
            <p className="mt-4 font-mono text-xl" data-testid="product-price">{rupiah(p.price)}</p>
            <p className="mt-6 leading-relaxed text-muted-foreground" data-testid="product-description">{p.description}</p>

            {p.colors.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("colors")}</p>
                <p className="mt-1 text-sm">{p.colors.join(" · ")}</p>
              </div>
            )}
            {p.sizes.length > 0 && (
              <div className="mt-6">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("size")}</p>
                <div className="mt-2 flex gap-2">
                  {p.sizes.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setSize(s)}
                      data-testid={`product-size-${s}`}
                      className={cn(
                        "grid size-11 place-items-center rounded-sm border text-sm transition-colors duration-200",
                        (size || p.sizes[0]) === s ? "border-ink bg-ink text-parchment" : "border-border bg-white hover:border-ink",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-6 text-xs text-muted-foreground" data-testid="product-stock">{t("stock")}: {p.stock}</p>
            <div className="mt-6 flex flex-col gap-3">
              <Button className="h-12 bg-brand text-white hover:bg-brand/90" onClick={addToCart} disabled={p.stock === 0} data-testid="product-add-to-cart-btn">
                <ShoppingBag /> {t("add_to_cart")}
              </Button>
              <Link to="/stylist" className="inline-flex items-center justify-center gap-2 text-sm underline-offset-4 hover:text-brand hover:underline" data-testid="product-ask-stylist-link">
                <Sparkles className="size-4" /> {t("hero_cta_stylist")}
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
