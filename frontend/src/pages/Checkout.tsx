import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Lock, TicketPercent, X } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { CheckoutInput, CheckoutResponse, ShippingOptions, VoucherValidateResult } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { useCart, type CartLine } from "@/lib/cart";
import { errMsg, rupiah, useMe } from "@/lib/helpers";
import { openPayment } from "@/components/OrderBits";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const quote = (base: number, mult: number) => Math.round((base * mult) / 500) * 500;

export default function Checkout() {
  const { t } = useI18n();
  const cart = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const buyNow = (location.state as { buyNow?: CartLine } | null)?.buyNow;
  const items: CartLine[] = buyNow ? [buyNow] : cart.items;
  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);

  const { data: me, isLoading } = useMe();
  const { data: opts } = useQuery({ queryKey: ["shipping-options"], queryFn: () => apiGet<ShippingOptions>("/shipping/options") });
  const [form, setForm] = useState({ recipient_name: "", phone: "", address: "", note: "" });
  const [zone, setZone] = useState("");
  const [courier, setCourier] = useState("");
  const [voucherInput, setVoucherInput] = useState("");
  const [voucher, setVoucher] = useState<VoucherValidateResult | null>(null);
  const [busy, setBusy] = useState(false);

  const zoneObj = opts?.zones.find((z) => z.code === zone);
  const courierObj = opts?.couriers.find((c) => c.code === courier);
  const shipping = zoneObj && courierObj ? quote(courierObj.base_cost, zoneObj.multiplier) : 0;
  const discount = voucher?.discount ?? 0;
  const total = subtotal + shipping - discount;

  const applyVoucher = async (code = voucherInput) => {
    if (!code.trim()) return;
    try {
      const v = await apiPost<VoucherValidateResult>("/vouchers/validate", { code, subtotal, shipping_cost: shipping });
      setVoucher(v);
      toast.success(`${v.code}: -${rupiah(v.discount)}`);
    } catch (err) {
      setVoucher(null);
      toast.error(errMsg(err, t("error_generic")));
    }
  };

  // shipping-type vouchers depend on the courier cost: re-validate when it changes
  const changeShipping = (nextZone: string, nextCourier: string) => {
    setZone(nextZone);
    setCourier(nextCourier);
    if (voucher) setVoucher(null);
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!zone || !courier) {
      toast.error(t("select_region_first"));
      return;
    }
    setBusy(true);
    try {
      const body: CheckoutInput = {
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity, size: i.size, color: i.color })),
        ...form, zone, courier, voucher_code: voucher?.code ?? "",
      };
      const res = await apiPost<CheckoutResponse>("/orders/checkout", body);
      if (!buyNow) cart.clear();
      qc.invalidateQueries({ queryKey: ["orders"] });
      await openPayment(res.token, res.order.id, () => {
        qc.invalidateQueries({ queryKey: ["orders"] });
        navigate(`/orders/${res.order.id}`, { replace: true });
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
        <p className="mt-4 text-muted-foreground" data-testid="checkout-login-required">{t("nav_login")} → {t("checkout")}</p>
        <Link to="/login" className={buttonVariants({ className: "mt-6" })} data-testid="checkout-login-link">{t("nav_login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-8">
      <h1 className="font-heading text-4xl md:text-5xl">{t("checkout_title")}</h1>
      <form onSubmit={submit} className="mt-10 grid gap-10 md:grid-cols-12" data-testid="checkout-form">
        <div className="space-y-8 md:col-span-7">
          <section className="space-y-4">
            <h2 className="font-heading text-2xl">{t("shipping_info")}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="recipient">{t("recipient")}</Label>
                <Input id="recipient" required minLength={2} value={form.recipient_name} onChange={(e) => setForm({ ...form, recipient_name: e.target.value })} className="h-11 bg-white" data-testid="checkout-recipient-input" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">{t("phone")}</Label>
                <Input id="phone" required minLength={6} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="0812xxxxxxx" className="h-11 bg-white" data-testid="checkout-phone-input" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">{t("address")}</Label>
              <Textarea id="address" required minLength={5} rows={3} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="bg-white" data-testid="checkout-address-input" />
            </div>
            <div className="space-y-2">
              <Label>{t("region")}</Label>
              <Select value={zone} onValueChange={(v: string) => changeShipping(v, courier)}>
                <SelectTrigger className="h-11 w-full bg-white" data-testid="checkout-zone-select">
                  <SelectValue>{(v) => opts?.zones.find((z) => z.code === v)?.label ?? "—"}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {opts?.zones.map((z) => (
                    <SelectItem key={z.code} value={z.code} data-testid={`checkout-zone-option-${z.code}`}>{z.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="font-heading text-2xl">{t("courier")}</h2>
            {!zoneObj && <p className="text-sm text-muted-foreground" data-testid="checkout-courier-hint">{t("select_region_first")}</p>}
            <div className="grid gap-2 sm:grid-cols-2">
              {zoneObj && opts?.couriers.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => changeShipping(zone, c.code)}
                  data-testid={`checkout-courier-${c.code}`}
                  className={cn(
                    "flex items-center justify-between rounded-sm border bg-white p-4 text-left transition-[border-color,box-shadow] duration-200",
                    courier === c.code ? "border-brand shadow-[0_0_0_1px_var(--color-brand)]" : "border-border hover:border-ink",
                  )}
                >
                  <div>
                    <p className="text-sm font-semibold">{c.name} <span className="font-normal text-muted-foreground">{c.service}</span></p>
                    <p className="text-xs text-muted-foreground">{c.etd} {t("etd_days")}</p>
                  </div>
                  <p className="font-mono text-sm">{rupiah(quote(c.base_cost, zoneObj.multiplier))}</p>
                </button>
              ))}
            </div>
          </section>

          <div className="space-y-2">
            <Label htmlFor="note">{t("note_seller")}</Label>
            <Input id="note" maxLength={300} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} className="h-11 bg-white" data-testid="checkout-note-input" />
          </div>
        </div>

        <aside className="h-fit space-y-5 rounded-sm border border-border bg-white p-6 md:sticky md:top-24 md:col-span-5" data-testid="checkout-summary">
          <h2 className="font-heading text-2xl">{t("order_summary")}</h2>
          <div className="space-y-4">
            {items.length === 0 && <p className="text-sm text-muted-foreground">{t("cart_empty")}</p>}
            {items.map((i) => (
              <div key={`${i.product_id}-${i.size}-${i.color}`} className="flex items-center gap-3" data-testid="checkout-item">
                <img src={i.image_url} alt={i.name} className="h-16 w-12 rounded-sm object-cover" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{i.name}</p>
                  <p className="text-xs text-muted-foreground">{[i.color, i.size].filter(Boolean).join(" · ")} · x{i.quantity}</p>
                </div>
                <p className="font-mono text-xs">{rupiah(i.price * i.quantity)}</p>
              </div>
            ))}
          </div>

          <div className="border-t border-border pt-4">
            <Label className="mb-2 flex items-center gap-1.5"><TicketPercent className="size-4 text-brand" /> {t("voucher")}</Label>
            {voucher ? (
              <div className="flex items-center justify-between rounded-sm border border-dashed border-brand bg-brand-soft px-3 py-2" data-testid="checkout-voucher-applied">
                <div>
                  <p className="font-mono text-sm font-semibold text-brand">{voucher.code}</p>
                  <p className="text-xs text-muted-foreground">{voucher.description}</p>
                </div>
                <Button type="button" variant="ghost" size="icon-sm" aria-label={t("remove")} onClick={() => setVoucher(null)} data-testid="checkout-voucher-remove-btn"><X /></Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={voucherInput} onChange={(e) => setVoucherInput(e.target.value.toUpperCase())} placeholder={t("voucher_placeholder")} className="h-10 font-mono uppercase" data-testid="checkout-voucher-input" />
                <Button type="button" variant="outline" className="h-10" onClick={() => void applyVoucher()} disabled={!voucherInput.trim() || items.length === 0} data-testid="checkout-voucher-apply-btn">{t("apply")}</Button>
              </div>
            )}
          </div>

          <dl className="space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("subtotal")}</dt><dd className="font-mono" data-testid="checkout-subtotal">{rupiah(subtotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">{t("shipping")}{courierObj && ` · ${courierObj.name} ${courierObj.service}`}</dt><dd className="font-mono" data-testid="checkout-shipping">{rupiah(shipping)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-brand"><dt>{t("discount")}</dt><dd className="font-mono" data-testid="checkout-discount">-{rupiah(discount)}</dd></div>}
            <div className="flex justify-between border-t border-border pt-3 text-base">
              <dt className="font-semibold">{t("total")}</dt><dd className="font-mono font-semibold" data-testid="checkout-total">{rupiah(total)}</dd>
            </div>
          </dl>
          <Button type="submit" disabled={busy || items.length === 0} className="h-12 w-full bg-brand text-white hover:bg-brand/90" data-testid="checkout-pay-btn">
            <Lock /> {t("pay_midtrans")}
          </Button>
          <p className="rounded-sm border border-dashed border-border p-3 font-mono text-[11px] text-muted-foreground" data-testid="checkout-sandbox-note">{t("sandbox_note")}</p>
        </aside>
      </form>
    </div>
  );
}
