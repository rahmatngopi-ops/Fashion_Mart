import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Minus, Plus, ShoppingBag, Sparkles, Store, User as UserIcon } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useI18n } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { rupiah, useMe } from "@/lib/helpers";
import { endSession } from "@/lib/session";
import { cn } from "@/lib/utils";

const navCls = ({ isActive }: { isActive: boolean }) =>
  cn(
    "relative text-sm tracking-wide transition-colors duration-200 hover:text-brand",
    isActive ? "text-ink after:absolute after:-bottom-1.5 after:left-0 after:h-px after:w-full after:bg-brand" : "text-muted-foreground",
  );

function LangToggle() {
  const { lang, setLang } = useI18n();
  return (
    <div className="flex rounded-full border border-border bg-white/60 p-0.5 text-xs font-medium" data-testid="nav-language-toggle">
      {(["id", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => setLang(l)}
          data-testid={`nav-lang-${l}`}
          aria-label={`Language ${l}`}
          className={cn(
            "rounded-full px-2.5 py-1 uppercase transition-colors duration-200",
            lang === l ? "bg-ink text-parchment" : "text-muted-foreground hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </div>
  );
}

function CartDrawer() {
  const { t } = useI18n();
  const cart = useCart();
  const navigate = useNavigate();
  return (
    <Sheet open={cart.open} onOpenChange={cart.setOpen}>
      <SheetContent className="flex w-full flex-col bg-parchment sm:max-w-md" data-testid="cart-drawer">
        <SheetHeader>
          <SheetTitle className="font-heading text-2xl">{t("cart")}</SheetTitle>
        </SheetHeader>
        <div className="flex-1 space-y-4 overflow-y-auto px-4">
          {cart.items.length === 0 && (
            <p className="py-12 text-center text-sm text-muted-foreground" data-testid="cart-empty">{t("cart_empty")}</p>
          )}
          {cart.items.map((i) => (
            <div key={`${i.product_id}-${i.size}-${i.color}`} className="flex gap-3 border-b border-border pb-4" data-testid="cart-line">
              <img src={i.image_url} alt={i.name} className="h-24 w-20 rounded-sm object-cover" />
              <div className="flex flex-1 flex-col">
                <p className="text-sm font-semibold">{i.name}</p>
                <p className="text-xs text-muted-foreground">{[i.color, i.size].filter(Boolean).join(" · ")}</p>
                <p className="mt-1 font-mono text-xs">{rupiah(i.price)}</p>
                <div className="mt-auto flex items-center gap-2">
                  <Button size="icon-xs" variant="outline" aria-label="decrease" data-testid="cart-line-decrease"
                    onClick={() => cart.setQty(i, i.quantity - 1)}><Minus /></Button>
                  <span className="w-6 text-center font-mono text-sm" data-testid="cart-line-qty">{i.quantity}</span>
                  <Button size="icon-xs" variant="outline" aria-label="increase" data-testid="cart-line-increase"
                    onClick={() => cart.setQty(i, i.quantity + 1)}><Plus /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="border-t border-border p-4">
          <div className="mb-4 flex justify-between text-sm">
            <span className="text-muted-foreground">{t("subtotal")}</span>
            <span className="font-mono font-semibold" data-testid="cart-subtotal">{rupiah(cart.subtotal)}</span>
          </div>
          <Button
            className="h-11 w-full bg-brand text-white hover:bg-brand/90"
            disabled={cart.items.length === 0}
            data-testid="cart-checkout-btn"
            onClick={() => {
              cart.setOpen(false);
              navigate("/checkout");
            }}
          >
            {t("checkout")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function Layout() {
  const { t } = useI18n();
  const cart = useCart();
  const { data: me } = useMe();

  return (
    <div className="flex min-h-screen flex-col bg-parchment text-ink">
      <header className="sticky top-0 z-40 border-b border-border/80 bg-parchment/85 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 md:px-8">
          <Link to="/" className="font-heading text-xl font-semibold tracking-tight" data-testid="nav-logo">
            FASHION<span className="text-brand">_</span>MART
          </Link>
          <nav className="ml-6 hidden items-center gap-7 md:flex">
            <NavLink to="/products" className={navCls} data-testid="nav-shop-link">{t("nav_shop")}</NavLink>
            <NavLink to="/stylist" className={navCls} data-testid="nav-stylist-link">{t("nav_stylist")}</NavLink>
            {me && <NavLink to="/orders" className={navCls} data-testid="nav-orders-link">{t("nav_orders")}</NavLink>}
            {me?.role === "admin" && (
              <NavLink to="/seller" className={navCls} data-testid="nav-seller-studio-link">{t("nav_seller")}</NavLink>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2 md:gap-3">
            <LangToggle />
            {me ? (
              <div className="flex items-center gap-2">
                <span className="hidden text-xs text-muted-foreground lg:inline" data-testid="nav-user-name">{me.name}</span>
                <Button variant="ghost" size="sm" data-testid="nav-logout-btn" onClick={() => endSession("/")}>
                  {t("nav_logout")}
                </Button>
              </div>
            ) : (
              <Link to="/login" className="flex items-center gap-1 text-sm hover:text-brand" data-testid="nav-login-link">
                <UserIcon className="size-4" /> <span className="hidden sm:inline">{t("nav_login")}</span>
              </Link>
            )}
            <button
              type="button"
              onClick={() => cart.setOpen(true)}
              className="relative rounded-full p-2 transition-colors duration-200 hover:bg-muted"
              aria-label="Open cart"
              data-testid="nav-cart-trigger"
            >
              <ShoppingBag className="size-5" />
              {cart.count > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid size-5 place-items-center rounded-full bg-brand font-mono text-[10px] text-white" data-testid="nav-cart-count">
                  {cart.count}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20 md:pb-0">
        <Outlet />
      </main>

      <footer className="bg-ink text-[#F5F3EF]">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-12 md:px-8">
          <div className="md:col-span-6">
            <p className="font-heading text-3xl">FASHION<span className="text-[#E87979]">_</span>MART</p>
            <p className="mt-3 max-w-sm text-sm text-[#A8A29A]">{t("footer_tag")}</p>
          </div>
          <div className="md:col-span-6 md:text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-[#A8A29A]">Shopee · Tokopedia · TikTok Shop · Lazada</p>
            <p className="mt-2 text-xs text-[#A8A29A]">Payments by Midtrans · AI by Gemini</p>
            <p className="mt-6 font-mono text-[11px] text-[#A8A29A]">© 2026 FASHION_MART</p>
          </div>
        </div>
      </footer>

      {/* Mobile floating nav */}
      <nav className="fixed inset-x-4 bottom-4 z-40 flex justify-around rounded-full border border-border bg-parchment/90 py-2 shadow-lg backdrop-blur-xl md:hidden">
        <Link to="/products" className="flex flex-col items-center p-1 text-[10px]" data-testid="mobile-nav-shop"><Store className="size-5" />{t("nav_shop")}</Link>
        <Link to="/stylist" className="flex flex-col items-center p-1 text-[10px]" data-testid="mobile-nav-stylist"><Sparkles className="size-5" />Stylist</Link>
        {me?.role === "admin" && <Link to="/seller" className="flex flex-col items-center p-1 text-[10px]" data-testid="mobile-nav-seller"><Store className="size-5" />Seller</Link>}
        {me && <Link to="/orders" className="flex flex-col items-center p-1 text-[10px]" data-testid="mobile-nav-orders"><UserIcon className="size-5" />{t("nav_orders")}</Link>}
      </nav>

      <CartDrawer />
      <Toaster richColors />
    </div>
  );
}
