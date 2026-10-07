import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { Order, PaymentStatus } from "@/lib/types";
import { useI18n, type DictKey } from "@/lib/i18n";
import { errMsg, rupiah, useMe } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { openPayment } from "@/pages/Checkout";
import { cn } from "@/lib/utils";

const STATUS_CLS: Record<PaymentStatus, string> = {
  pending: "bg-amber-100 text-amber-800",
  paid: "bg-green-100 text-green-800",
  failed: "bg-red-100 text-red-800",
  expired: "bg-neutral-200 text-neutral-700",
};

export function StatusBadge({ status }: { status: PaymentStatus }) {
  const { t } = useI18n();
  return (
    <Badge className={cn("rounded-full border-0", STATUS_CLS[status])} data-testid="order-status-badge">
      {t(`status_${status}` as DictKey)}
    </Badge>
  );
}

export default function Orders() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: orders, isError } = useQuery({
    queryKey: ["orders"],
    queryFn: () => apiGet<Order[]>("/orders"),
    enabled: !!me,
  });
  const refresh = useMutation({
    mutationFn: (id: string) => apiPost<Order>(`/orders/${id}/refresh`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["orders"] }),
    onError: (e) => toast.error(errMsg(e, t("error_generic"))),
  });

  if (!meLoading && !me) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Link to="/login" className={buttonVariants()} data-testid="orders-login-link">{t("nav_login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-8">
      <h1 className="font-heading text-4xl md:text-5xl" data-testid="orders-title">{t("orders_title")}</h1>
      <div className="mt-10 space-y-5">
        {orders?.length === 0 && <p className="text-muted-foreground" data-testid="orders-empty">{t("orders_empty")}</p>}
        {isError && <p className="text-muted-foreground">{t("error_generic")}</p>}
        {!isError && orders?.map((o) => (
          <div key={o.id} className="rounded-sm border border-border bg-white p-5 animate-fade-up" data-testid={`order-card-${o.order_code}`}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-semibold" data-testid="order-code">{o.order_code}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
                  {o.payment_type && ` · ${o.payment_type.replace(/_/g, " ")}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={o.payment_status} />
                {o.payment_status === "pending" && (
                  <>
                    <Button size="sm" variant="outline" disabled={refresh.isPending} onClick={() => refresh.mutate(o.id)} data-testid="order-refresh-btn">
                      <RefreshCw /> {t("refresh_status")}
                    </Button>
                    {o.snap_token && (
                      <Button size="sm" className="bg-brand text-white hover:bg-brand/90" data-testid="order-pay-btn"
                        onClick={() => openPayment(o.snap_token!, o.id, () => qc.invalidateQueries({ queryKey: ["orders"] })).catch(() => toast.error(t("error_generic")))}>
                        {t("pay_now")}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {o.items.map((i) => (
                <div key={`${i.product_id}-${i.size}`} className="flex items-center gap-2 rounded-sm bg-muted p-2 pr-3">
                  <img src={i.image_url} alt={i.name} className="h-12 w-9 rounded-sm object-cover" />
                  <div className="text-xs">
                    <p className="font-medium">{i.name}</p>
                    <p className="text-muted-foreground">{i.size && `${i.size} · `}x{i.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-right font-mono text-sm font-semibold" data-testid="order-total">{rupiah(o.gross_amount)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
