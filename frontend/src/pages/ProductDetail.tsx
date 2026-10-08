import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Minus, Plus, ShoppingBag, Sparkles, Zap } from "lucide-react";
import { toast } from "sonner";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useCart, type CartLine } from "@/lib/cart";
import { rupiah } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function VariantPicker({ label, options, value, onChange, testid, missing }: {
  label: string; options: string[]; value: string; onChange: (v: string) => void; testid: string; missing: boolean;
}) {
  return (
    <div className="mt-6">
      <p className={cn("text-xs font-medium uppercase tracking-wider", missing ? "text-brand" : "text-muted-foreground")}>
        {label}{value && <span className="ml-2 normal-case tracking-normal text-ink">· {value}</span>}
      </p>
      <div className={cn("mt-2 flex flex-wrap gap-2 rounded-sm transition-shadow duration-200", missing && "ring-2 ring-brand/40 ring-offset-4 ring-offset-parchment")}>
        {options.map((o) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            data-testid={`${testid}-${o.toLowerCase().replace(/\s+/g, "-")}`}
            className={cn(
              "h-11 min-w-11 rounded-sm border px-3 text-sm transition-colors duration-200",
              value === o ? "border-ink bg-ink text-parchment" : "border-border bg-white hover:border-ink",
            )}
          >
            {o}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function ProductDetail() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const cart = useCart();
  const navigate = useNavigate();
  const { data: p, isError } = useQuery({ queryKey: ["product", id], queryFn: () => apiGet<Product>(`/products/${id}`) });
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [qty, setQty] = useState(1);
  const [tried, setTried] = useState(false);

  const needSize = !!p && p.sizes.length > 0 && !size;
  const needColor = !!p && p.colors.length > 0 && !color;

  const buildLine = (): CartLine | null => {
    if (!p) return null;
    setTried(true);
    if (needSize || needColor) {
      toast.error(t("pick_variant"));
      return null;
    }
    return { product_id: p.id, name: p.name, price: p.price, image_url: p.image_url, size, color, quantity: qty };
  };

  const addToCart = () => {
    const line = buildLine();
    if (!line) return;
    cart.add(line);
    toast.success(t("added"), { description: `${line.name} · ${[color, size].filter(Boolean).join(" · ")}` });
    cart.setOpen(true);
  };

  const buyNow = () => {
    const line = buildLine();
    if (line) navigate("/checkout", { state: { buyNow: line } });
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
              <VariantPicker label={t("colors")} options={p.colors} value={color} onChange={setColor} testid="product-color" missing={tried && needColor} />
            )}
            {p.sizes.length > 0 && (
              <VariantPicker label={t("size")} options={p.sizes} value={size} onChange={setSize} testid="product-size" missing={tried && needSize} />
            )}

            <div className="mt-6 flex items-center gap-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("quantity")}</p>
              <div className="flex items-center rounded-sm border border-border bg-white">
                <Button variant="ghost" size="icon-sm" aria-label="decrease" onClick={() => setQty((q) => Math.max(1, q - 1))} data-testid="product-qty-decrease"><Minus /></Button>
                <span className="w-8 text-center font-mono text-sm" data-testid="product-qty">{qty}</span>
                <Button variant="ghost" size="icon-sm" aria-label="increase" onClick={() => setQty((q) => Math.min(p.stock, 20, q + 1))} data-testid="product-qty-increase"><Plus /></Button>
              </div>
              <p className="text-xs text-muted-foreground" data-testid="product-stock">{t("stock")}: {p.stock}</p>
            </div>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <Button variant="outline" className="h-12 border-ink" onClick={addToCart} disabled={p.stock === 0} data-testid="product-add-to-cart-btn">
                <ShoppingBag /> {t("add_to_cart")}
              </Button>
              <Button className="h-12 bg-brand text-white hover:bg-brand/90" onClick={buyNow} disabled={p.stock === 0} data-testid="product-buy-now-btn">
                <Zap /> {t("buy_now")}
              </Button>
            </div>
            <Link to="/stylist" className="mt-4 flex items-center justify-center gap-2 text-sm underline-offset-4 hover:text-brand hover:underline" data-testid="product-ask-stylist-link">
              <Sparkles className="size-4" /> {t("hero_cta_stylist")}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
