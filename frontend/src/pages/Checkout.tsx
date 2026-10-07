import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { apiPost } from "@/lib/api";
import type { CheckoutResponse, Order } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useCart } from "@/lib/cart";
import { errMsg, paySnap, rupiah, useMe } from "@/lib/helpers";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export async function openPayment(token: string, orderId: string, after: () => void) {
  const refresh = () => apiPost<Order>(`/orders/${orderId}/refresh`).catch(() => null).finally(after);
  await paySnap(token, { onSuccess: refresh, onPending: refresh, onError: refresh, onClose: refresh });
}

export default function Checkout() {
  const { t } = useI18n();
  const cart = useCart();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: me, isLoading } = useMe();
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await apiPost<CheckoutResponse>("/orders/checkout", {
        items: cart.items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, size: i.size })),
        phone,
        address,
      });
      await openPayment(res.token, res.order.id, () => {
        cart.clear();
        qc.invalidateQueries({ queryKey: ["orders"] });
        navigate("/orders");
      });
    } catch (err) {
      toast.error(errMsg(err, t("error_generic")));
    } finally {
      setBusy(false);
    }
  };

  if (!isLoading && !me) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Lock className="mx-auto size-8 text-brand" />
        <p className="mt-4 text-muted-foreground" data-testid="checkout-login-required">{t("stylist_login").replace("AI Stylist", "checkout")}</p>
        <Link to="/login" className={buttonVariants({ className: "mt-6" })} data-testid="checkout-login-link">{t("nav_login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
      <h1 className="font-heading text-4xl md:text-5xl">{t("checkout_title")}</h1>
      <div className="mt-10 grid gap-10 md:grid-cols-12">
        <form onSubmit={submit} className="space-y-5 md:col-span-7" data-testid="checkout-form">
          <div className="space-y-2">
            <Label htmlFor="phone">{t("phone")}</Label>
            <Input id="phone" required minLength={6} value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0812xxxxxxx" className="h-11 bg-white" data-testid="checkout-phone-input" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="address">{t("address")}</Label>
            <Textarea id="address" required minLength={5} rows={4} value={address} onChange={(e) => setAddress(e.target.value)} className="bg-white" data-testid="checkout-address-input" />
          </div>
          <Button type="submit" disabled={busy || cart.items.length === 0} className="h-12 w-full bg-brand text-white hover:bg-brand/90" data-testid="checkout-pay-btn">
            <Lock /> {t("pay_midtrans")}
          </Button>
          <p className="rounded-sm border border-dashed border-border bg-white p-3 font-mono text-[11px] text-muted-foreground" data-testid="checkout-sandbox-note">
            {t("sandbox_note")}
          </p>
        </form>
        <aside className="h-fit rounded-sm border border-border bg-white p-6 md:col-span-5" data-testid="checkout-summary">
          <h2 className="font-heading text-2xl">{t("order_summary")}</h2>
          <div className="mt-5 space-y-4">
            {cart.items.length === 0 && <p className="text-sm text-muted-foreground">{t("cart_empty")}</p>}
            {cart.items.map((i) => (
              <div key={`${i.product_id}-${i.size}`} className="flex items-center gap-3">
                <img src={i.image_url} alt={i.name} className="h-16 w-12 rounded-sm object-cover" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{i.size && `${i.size} · `}x{i.quantity}</p>
                </div>
                <p className="font-mono text-xs">{rupiah(i.price * i.quantity)}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex justify-between border-t border-border pt-4">
            <span className="font-medium">{t("total")}</span>
            <span className="font-mono font-semibold" data-testid="checkout-total">{rupiah(cart.subtotal)}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
