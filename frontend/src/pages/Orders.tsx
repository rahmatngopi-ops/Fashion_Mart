import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Order, OrderStatus } from "@/lib/types";
import { useI18n, type DictKey } from "@/lib/i18n";
import { rupiah, useMe } from "@/lib/helpers";
import { ORDER_STATUSES, OrderStatusBadge } from "@/components/OrderBits";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Orders() {
  const { t } = useI18n();
  const { data: me, isLoading: meLoading } = useMe();
  const [filter, setFilter] = useState<OrderStatus | "">("");
  const { data: orders, isError } = useQuery({ queryKey: ["orders"], queryFn: () => apiGet<Order[]>("/orders"), enabled: !!me });
  const count = (s: OrderStatus) => orders?.filter((o) => o.status === s).length ?? 0;
  const shown = (orders ?? []).filter((o) => !filter || o.status === filter);

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
      <div className="mt-8 flex gap-1 overflow-x-auto border-b border-border" data-testid="orders-status-tabs">
        {(["", ...ORDER_STATUSES] as const).map((s) => (
          <button
            key={s || "all"}
            type="button"
            onClick={() => setFilter(s)}
            data-testid={`orders-filter-${s || "all"}`}
            className={cn(
              "relative shrink-0 px-4 py-3 text-sm transition-colors duration-200",
              filter === s ? "text-brand after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-brand" : "text-muted-foreground hover:text-ink",
            )}
          >
            {s ? t(`ord_${s}` as DictKey) : t("all_orders")}
            {s && count(s) > 0 && <span className="ml-1.5 rounded-full bg-brand-soft px-1.5 font-mono text-[10px] text-brand">{count(s)}</span>}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-4">
        {orders && shown.length === 0 && <p className="py-12 text-center text-muted-foreground" data-testid="orders-empty">{t("orders_empty")}</p>}
        {isError && <p className="text-muted-foreground">{t("error_generic")}</p>}
        {!isError && shown.map((o) => (
          <Link
            key={o.id}
            to={`/orders/${o.id}`}
            className="block rounded-sm border border-border bg-white p-5 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-ink animate-fade-up"
            data-testid={`order-card-${o.order_code}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="font-mono text-sm font-semibold" data-testid="order-code">{o.order_code}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(o.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })} · {o.courier_label}
                </p>
              </div>
              <OrderStatusBadge status={o.status} />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <img src={o.items[0]?.image_url} alt="" className="h-16 w-12 rounded-sm object-cover" />
              <div className="flex-1 text-sm">
                <p className="font-medium">{o.items[0]?.name}</p>
                <p className="text-xs text-muted-foreground">
                  {[o.items[0]?.color, o.items[0]?.size].filter(Boolean).join(" · ")} · x{o.items[0]?.quantity}
                  {o.items.length > 1 && ` · +${o.items.length - 1}`}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">{t("total")}</p>
                <p className="font-mono text-sm font-semibold" data-testid="order-total">{rupiah(o.gross_amount)}</p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
