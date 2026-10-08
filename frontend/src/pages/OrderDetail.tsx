import { Link, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, MapPin, RefreshCw, Truck } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Order } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { errMsg, rupiah } from "@/lib/helpers";
import { OrderStatusBadge, OrderStepper, OrderTimeline, openPayment } from "@/components/OrderBits";
import { Button } from "@/components/ui/button";

export default function OrderDetail() {
  const { id = "" } = useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: o, isError } = useQuery({ queryKey: ["orders", id], queryFn: () => apiGet<Order>(`/orders/${id}`) });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["orders"] });
  const action = useMutation({
    mutationFn: (kind: "refresh" | "cancel" | "complete") => apiPost<Order>(`/orders/${id}/${kind}`),
    onSuccess: (order) => {
      qc.setQueryData(["orders", id], order);
      invalidate();
    },
    onError: (e) => toast.error(errMsg(e, t("error_generic"))),
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 md:px-8">
      <Link to="/orders" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-brand" data-testid="order-detail-back-link">
        <ArrowLeft className="size-4" /> {t("orders_title")}
      </Link>
      {isError && <p className="py-20 text-center text-muted-foreground" data-testid="order-not-found">404</p>}
      {!o && !isError && <div className="mt-6 h-64 animate-pulse rounded-sm bg-muted" />}
      {o && (
        <>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="font-heading text-4xl" data-testid="order-detail-title">{t("order_detail")}</h1>
              <p className="mt-1 font-mono text-sm text-muted-foreground" data-testid="order-detail-code">{o.order_code}</p>
            </div>
            <OrderStatusBadge status={o.status} />
          </div>

          {o.status !== "cancelled" ? (
            <div className="mt-8 rounded-sm border border-border bg-white p-6"><OrderStepper order={o} /></div>
          ) : (
            <div className="mt-8 rounded-sm border border-border bg-muted p-4 text-sm" data-testid="order-cancelled-banner">
              {o.timeline[o.timeline.length - 1]?.note}
            </div>
          )}

          {/* Action bar */}
          <div className="mt-4 flex flex-wrap gap-2" data-testid="order-actions">
            {o.status === "awaiting_payment" && o.snap_token && (
              <Button className="bg-brand text-white hover:bg-brand/90" data-testid="order-pay-btn"
                onClick={() => openPayment(o.snap_token!, o.id, () => { qc.invalidateQueries({ queryKey: ["orders"] }); }).catch(() => toast.error(t("error_generic")))}>
                {t("pay_now")}
              </Button>
            )}
            {o.status === "awaiting_payment" && (
              <Button variant="outline" disabled={action.isPending} onClick={() => action.mutate("refresh")} data-testid="order-refresh-btn">
                <RefreshCw /> {t("refresh_status")}
              </Button>
            )}
            {(o.status === "awaiting_payment" || o.status === "paid") && (
              <Button variant="ghost" className="text-destructive" disabled={action.isPending}
                onClick={() => { if (confirm(t("cancel_confirm"))) action.mutate("cancel"); }} data-testid="order-cancel-btn">
                {t("cancel_order")}
              </Button>
            )}
            {o.status === "shipped" && (
              <Button className="bg-brand text-white hover:bg-brand/90" disabled={action.isPending} onClick={() => action.mutate("complete")} data-testid="order-received-btn">
                {t("order_received")}
              </Button>
            )}
          </div>

          <div className="mt-8 grid gap-6 md:grid-cols-12">
            <div className="space-y-6 md:col-span-7">
              <section className="rounded-sm border border-border bg-white p-6">
                <h2 className="mb-5 font-heading text-2xl">{t("timeline")}</h2>
                <OrderTimeline entries={o.timeline} />
              </section>
              <section className="rounded-sm border border-border bg-white p-6">
                <h2 className="mb-4 font-heading text-2xl">{t("order_summary")}</h2>
                <div className="space-y-4">
                  {o.items.map((i) => (
                    <div key={`${i.product_id}-${i.size}-${i.color}`} className="flex items-center gap-3" data-testid="order-detail-item">
                      <img src={i.image_url} alt={i.name} className="h-20 w-16 rounded-sm object-cover" />
                      <div className="flex-1 text-sm">
                        <Link to={`/product/${i.product_id}`} className="font-medium hover:text-brand">{i.name}</Link>
                        <p className="text-xs text-muted-foreground">{[i.color, i.size].filter(Boolean).join(" · ")} · x{i.quantity}</p>
                      </div>
                      <p className="font-mono text-sm">{rupiah(i.price * i.quantity)}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <aside className="space-y-6 md:col-span-5">
              <section className="rounded-sm border border-border bg-white p-6 text-sm">
                <h3 className="flex items-center gap-2 font-semibold"><MapPin className="size-4 text-brand" /> {t("shipping_info")}</h3>
                <p className="mt-3 font-medium" data-testid="order-recipient">{o.recipient_name} · {o.phone}</p>
                <p className="text-muted-foreground">{o.address}</p>
                <p className="text-muted-foreground">{o.zone_label}</p>
                {o.note && <p className="mt-2 italic text-muted-foreground">“{o.note}”</p>}
                <div className="mt-4 flex items-center gap-2 border-t border-border pt-4">
                  <Truck className="size-4 text-brand" />
                  <span className="font-medium" data-testid="order-courier">{o.courier_label}</span>
                </div>
                {o.tracking_number && (
                  <div className="mt-2 flex items-center justify-between rounded-sm bg-muted px-3 py-2">
                    <span><span className="text-xs text-muted-foreground">{t("tracking_no")} </span><span className="font-mono font-semibold" data-testid="order-tracking-number">{o.tracking_number}</span></span>
                    <Button size="icon-xs" variant="ghost" aria-label="copy" data-testid="order-copy-resi-btn"
                      onClick={() => void navigator.clipboard.writeText(o.tracking_number).then(() => toast.success(t("copied")))}><Copy /></Button>
                  </div>
                )}
              </section>
              <section className="rounded-sm border border-border bg-white p-6">
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between"><dt className="text-muted-foreground">{t("subtotal")}</dt><dd className="font-mono">{rupiah(o.subtotal)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">{t("shipping")}</dt><dd className="font-mono">{rupiah(o.shipping_cost)}</dd></div>
                  {o.discount > 0 && (
                    <div className="flex justify-between text-brand"><dt>{t("discount")} ({o.voucher_code})</dt><dd className="font-mono" data-testid="order-discount">-{rupiah(o.discount)}</dd></div>
                  )}
                  <div className="flex justify-between border-t border-border pt-3 text-base font-semibold">
                    <dt>{t("total")}</dt><dd className="font-mono" data-testid="order-detail-total">{rupiah(o.gross_amount)}</dd>
                  </div>
                  {o.payment_type && (
                    <div className="flex justify-between pt-1 text-xs text-muted-foreground"><dt>{t("payment_method")}</dt><dd className="uppercase">{o.payment_type.replace(/_/g, " ")}</dd></div>
                  )}
                </dl>
              </section>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
