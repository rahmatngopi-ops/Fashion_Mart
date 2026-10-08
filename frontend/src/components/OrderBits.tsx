import { Check, CircleDot, PackageCheck, Truck, Wallet, X } from "lucide-react";
import { apiPost } from "@/lib/api";
import type { Order, OrderStatus, TimelineEntry } from "@/lib/types";
import { useI18n, type DictKey } from "@/lib/i18n";
import { paySnap } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const ORDER_STATUSES: OrderStatus[] = ["awaiting_payment", "paid", "packed", "shipped", "completed", "cancelled"];
const FLOW: OrderStatus[] = ["awaiting_payment", "paid", "packed", "shipped", "completed"];
const ICONS = { awaiting_payment: Wallet, paid: CircleDot, packed: PackageCheck, shipped: Truck, completed: Check, cancelled: X };

const STATUS_CLS: Record<OrderStatus, string> = {
  awaiting_payment: "bg-amber-100 text-amber-800",
  paid: "bg-sky-100 text-sky-800",
  packed: "bg-indigo-100 text-indigo-800",
  shipped: "bg-violet-100 text-violet-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-neutral-200 text-neutral-700",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  const { t } = useI18n();
  return (
    <Badge className={cn("rounded-full border-0", STATUS_CLS[status])} data-testid="order-status-badge" data-status={status}>
      {t(`ord_${status}` as DictKey)}
    </Badge>
  );
}

/** Horizontal marketplace-style progress stepper. */
export function OrderStepper({ order }: { order: Order }) {
  const { t } = useI18n();
  const cancelled = order.status === "cancelled";
  const reached = new Set(order.timeline.map((e) => e.status));
  const currentIdx = FLOW.indexOf(order.status);
  return (
    <div className="flex items-start" data-testid="order-stepper">
      {FLOW.map((s, i) => {
        const Icon = ICONS[s];
        const done = cancelled ? reached.has(s) : i <= currentIdx;
        return (
          <div key={s} className="flex flex-1 flex-col items-center text-center">
            <div className="flex w-full items-center">
              <div className={cn("h-px flex-1", i === 0 ? "opacity-0" : done ? "bg-brand" : "bg-border")} />
              <div
                className={cn(
                  "grid size-10 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300",
                  done ? "border-brand bg-brand text-white" : "border-border bg-white text-muted-foreground",
                )}
                data-testid={`order-step-${s}`}
                data-done={done}
              >
                <Icon className="size-4" />
              </div>
              <div className={cn("h-px flex-1", i === FLOW.length - 1 ? "opacity-0" : done && i < currentIdx ? "bg-brand" : "bg-border")} />
            </div>
            <p className={cn("mt-2 text-[11px] font-medium leading-tight", done ? "text-ink" : "text-muted-foreground")}>{t(`ord_${s}` as DictKey)}</p>
          </div>
        );
      })}
    </div>
  );
}

export function OrderTimeline({ entries }: { entries: TimelineEntry[] }) {
  const { t } = useI18n();
  const list = [...entries].reverse();
  return (
    <ol className="relative space-y-6 border-l border-border pl-6" data-testid="order-timeline">
      {list.map((e, i) => (
        <li key={`${e.status}-${e.at}`} className="relative animate-fade-up" data-testid={`timeline-entry-${e.status}`}>
          <span className={cn("absolute -left-[31px] top-1 size-3 rounded-full ring-4 ring-white", i === 0 ? "bg-brand" : "bg-border")} />
          <p className={cn("text-sm font-semibold", i === 0 ? "text-brand" : "text-ink")}>{t(`ord_${e.status}` as DictKey)}</p>
          <p className="text-sm text-muted-foreground">{e.note}</p>
          <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
            {new Date(e.at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}
          </p>
        </li>
      ))}
    </ol>
  );
}

export async function openPayment(token: string, orderId: string, after: () => void) {
  const refresh = () => apiPost<Order>(`/orders/${orderId}/refresh`).catch(() => null).finally(after);
  await paySnap(token, { onSuccess: refresh, onPending: refresh, onError: refresh, onClose: refresh });
}
