import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Heart } from "lucide-react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api";
import type { CreatorPage, SupportCheckoutResponse, SupportInput, SupportPublic } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { errMsg, paySnap, rupiah, useMe } from "@/lib/helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const PRESETS = [10000, 25000, 50000, 100000, 250000];

export default function SupportPage() {
  const { handle = "" } = useParams();
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: me } = useMe();
  const { data, isError } = useQuery({ queryKey: ["creator", handle], queryFn: () => apiGet<CreatorPage>(`/creators/${handle}`) });
  const [amount, setAmount] = useState(25000);
  const [custom, setCustom] = useState("");
  const [form, setForm] = useState({ supporter_name: "", supporter_email: "", message: "" });
  const [busy, setBusy] = useState(false);
  const finalAmount = custom ? Number(custom) : amount;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body: SupportInput = { ...form, supporter_name: form.supporter_name || me?.name || "Anonim", amount: finalAmount };
      const res = await apiPost<SupportCheckoutResponse>(`/creators/${handle}/support`, body);
      const refresh = () =>
        apiPost<SupportPublic>(`/supports/${res.support.id}/refresh`)
          .then((s) => {
            if (s.status === "paid") {
              toast.success(t("sw_thanks"));
              setForm({ supporter_name: "", supporter_email: "", message: "" });
            } else toast.message(t("sw_pending"));
          })
          .catch(() => null)
          .finally(() => qc.invalidateQueries({ queryKey: ["creator", handle] }));
      await paySnap(res.token, { onSuccess: refresh, onPending: refresh, onError: refresh, onClose: refresh });
    } catch (err) {
      toast.error(errMsg(err, t("error_generic")));
    } finally {
      setBusy(false);
    }
  };

  if (isError) return <p className="py-24 text-center text-muted-foreground" data-testid="support-not-found">{t("sw_not_found")}</p>;
  const p = data?.profile;

  return (
    <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 md:grid-cols-12 md:px-8">
      <section className="md:col-span-5">
        {!p ? (
          <div className="h-48 animate-pulse rounded-sm bg-muted" />
        ) : (
          <div className="rounded-sm border border-border bg-white p-6 animate-fade-up" data-testid="support-creator-card">
            <div className="flex items-center gap-4">
              {p.avatar_url ? (
                <img src={p.avatar_url} alt={p.display_name} className="size-20 rounded-full object-cover" />
              ) : (
                <div className="grid size-20 place-items-center rounded-full bg-brand font-heading text-3xl text-white">{p.display_name[0]}</div>
              )}
              <div>
                <h1 className="font-heading text-3xl" data-testid="support-creator-name">{p.display_name}</h1>
                <p className="font-mono text-xs text-muted-foreground">@{p.handle}</p>
              </div>
            </div>
            {p.bio && <p className="mt-4 text-sm leading-relaxed text-muted-foreground" data-testid="support-creator-bio">{p.bio}</p>}
          </div>
        )}
        <h2 className="mt-8 font-heading text-2xl">{t("sw_recent")}</h2>
        <div className="mt-4 space-y-3" data-testid="support-recent-list">
          {data?.recent.length === 0 && <p className="text-sm text-muted-foreground">{t("sw_none")}</p>}
          {data?.recent.map((s) => (
            <div key={s.id} className="rounded-sm border border-border bg-white p-4" data-testid="support-recent-item">
              <p className="text-sm"><span className="font-semibold">{s.supporter_name}</span> · <span className="font-mono text-brand">{rupiah(s.amount)}</span></p>
              {s.message && <p className="mt-1 text-sm text-muted-foreground">“{s.message}”</p>}
            </div>
          ))}
        </div>
      </section>

      <form onSubmit={submit} className="h-fit space-y-5 rounded-sm border border-border bg-white p-6 md:col-span-7" data-testid="support-form">
        <h2 className="flex items-center gap-2 font-heading text-3xl"><Heart className="size-6 text-brand" /> {t("sw_support_title")}</h2>
        <div className="space-y-2">
          <Label>{t("sw_amount")}</Label>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
            {PRESETS.map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => { setAmount(v); setCustom(""); }}
                data-testid={`support-amount-${v}`}
                className={cn(
                  "rounded-sm border py-3 font-mono text-sm transition-colors duration-200",
                  !custom && amount === v ? "border-brand bg-brand text-white" : "border-border hover:border-ink",
                )}
              >
                {rupiah(v)}
              </button>
            ))}
          </div>
          <Input type="number" min={5000} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder={t("sw_custom")} className="h-11" data-testid="support-custom-amount-input" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{t("sw_name")}</Label>
            <Input maxLength={50} value={form.supporter_name} placeholder={me?.name ?? "Anonim"} onChange={(e) => setForm({ ...form, supporter_name: e.target.value })} className="h-11" data-testid="support-name-input" />
          </div>
          <div className="space-y-2">
            <Label>{t("sw_email")}</Label>
            <Input type="email" maxLength={100} value={form.supporter_email} onChange={(e) => setForm({ ...form, supporter_email: e.target.value })} className="h-11" data-testid="support-email-input" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t("sw_message")}</Label>
          <Textarea maxLength={255} rows={3} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} data-testid="support-message-input" />
        </div>
        <Button type="submit" disabled={busy || !p || finalAmount < 5000} className="h-12 w-full bg-brand text-white hover:bg-brand/90" data-testid="support-submit-btn">
          <Heart /> {t("sw_send")} · {rupiah(finalAmount || 0)}
        </Button>
        <p className="rounded-sm border border-dashed border-border p-3 font-mono text-[11px] text-muted-foreground">{t("sandbox_note")}</p>
      </form>
    </div>
  );
}
