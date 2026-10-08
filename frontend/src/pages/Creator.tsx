import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { ApiError, apiGet, apiPost, apiPut } from "@/lib/api";
import type { CreatorProfile, CreatorProfileInput, Support, SupportPublic } from "@/lib/types";
import { useI18n, type DictKey } from "@/lib/i18n";
import { errMsg, rupiah, useMe } from "@/lib/helpers";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const STATUS_KEY: Record<Support["status"], DictKey> = {
  pending: "status_pending", paid: "status_paid", failed: "status_failed", expired: "status_expired",
};

function ProfileForm({ initial }: { initial: CreatorProfile | null }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [form, setForm] = useState<CreatorProfileInput>({
    handle: initial?.handle ?? "", display_name: initial?.display_name ?? "", bio: initial?.bio ?? "", avatar_url: initial?.avatar_url ?? "",
  });
  const save = useMutation({
    mutationFn: () => apiPut<CreatorProfile>("/creators/me", form),
    onSuccess: (p) => {
      qc.setQueryData(["creator-me"], p);
      toast.success(t("save"));
    },
    onError: (e) => toast.error(errMsg(e, t("error_generic"))),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate();
  };
  return (
    <form onSubmit={submit} className="space-y-4 rounded-sm border border-border bg-white p-6" data-testid="creator-profile-form">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t("sw_handle")}</Label>
          <Input required minLength={3} maxLength={30} pattern="[a-z0-9_]+" value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value.toLowerCase() })} className="h-11 font-mono" data-testid="creator-handle-input" />
        </div>
        <div className="space-y-2">
          <Label>{t("sw_display")}</Label>
          <Input required maxLength={60} value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} className="h-11" data-testid="creator-display-name-input" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>{t("sw_bio")}</Label>
        <Textarea maxLength={300} rows={3} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} data-testid="creator-bio-input" />
      </div>
      <div className="space-y-2">
        <Label>{t("sw_avatar")}</Label>
        <Input value={form.avatar_url} onChange={(e) => setForm({ ...form, avatar_url: e.target.value })} className="h-11" data-testid="creator-avatar-input" />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={save.isPending} data-testid="creator-save-btn">{t("save")}</Button>
        {initial && (
          <Link to={`/s/${initial.handle}`} className={buttonVariants({ variant: "outline" })} data-testid="creator-open-page-link">
            <ExternalLink /> {t("sw_open_page")}: /s/{initial.handle}
          </Link>
        )}
      </div>
    </form>
  );
}

export default function Creator() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const profileQ = useQuery({
    queryKey: ["creator-me"],
    queryFn: async () => {
      try {
        return await apiGet<CreatorProfile>("/creators/me");
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) return null;
        throw e;
      }
    },
    enabled: !!me,
  });
  const { data: supports } = useQuery({ queryKey: ["creator-supports"], queryFn: () => apiGet<Support[]>("/creators/me/supports"), enabled: !!profileQ.data });
  const refresh = useMutation({
    mutationFn: (id: string) => apiPost<SupportPublic>(`/supports/${id}/refresh`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["creator-supports"] }),
  });
  const total = (supports ?? []).filter((s) => s.status === "paid").reduce((sum, s) => sum + s.amount, 0);

  if (!meLoading && !me) {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <Link to="/login" className={buttonVariants()} data-testid="creator-login-link">{t("nav_login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-10 px-4 py-12 md:px-8">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-brand">Saweria · Midtrans</p>
        <h1 className="mt-2 font-heading text-4xl md:text-5xl" data-testid="creator-title">{t("sw_dashboard")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("sw_dashboard_sub")}</p>
      </div>
      {profileQ.isSuccess && <ProfileForm key={profileQ.data?.id ?? "new"} initial={profileQ.data} />}

      {profileQ.data && (
        <section>
          <div className="mb-4 flex items-end justify-between">
            <h2 className="font-heading text-3xl">{t("sw_history")}</h2>
            <p className="text-sm text-muted-foreground">{t("sw_total")}: <span className="font-mono font-semibold text-ink" data-testid="creator-total-received">{rupiah(total)}</span></p>
          </div>
          <div className="rounded-sm border border-border bg-white">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("sw_name")}</TableHead>
                  <TableHead>{t("sw_message")}</TableHead>
                  <TableHead className="text-right">{t("total")}</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {supports?.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground" data-testid="creator-history-empty">{t("sw_none")}</TableCell></TableRow>
                )}
                {supports?.map((s) => (
                  <TableRow key={s.id} data-testid={`creator-support-row-${s.code}`}>
                    <TableCell>
                      <p className="font-medium">{s.supporter_name}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" })}</p>
                    </TableCell>
                    <TableCell className="max-w-72 text-sm text-muted-foreground">{s.message || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{rupiah(s.amount)}</TableCell>
                    <TableCell><Badge variant={s.status === "paid" ? "default" : "outline"} data-testid="creator-support-status">{t(STATUS_KEY[s.status])}</Badge></TableCell>
                    <TableCell className="text-right">
                      {s.status === "pending" && (
                        <Button size="icon-sm" variant="ghost" aria-label="refresh" disabled={refresh.isPending} onClick={() => refresh.mutate(s.id)} data-testid="creator-support-refresh-btn"><RefreshCw /></Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>
      )}
    </div>
  );
}
