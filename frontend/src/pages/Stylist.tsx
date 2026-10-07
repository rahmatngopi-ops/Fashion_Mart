import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Send, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiStream } from "@/lib/api";
import type { Product, StylistMessage } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { rupiah, useMe } from "@/lib/helpers";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

type StreamEvent = { delta?: string; error?: string; done?: boolean };

function inline(text: string, products: Map<string, Product>, keyBase: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[\[product:[^\]]+\]\]|\*[^*\s][^*]*\*)/g).map((part, i) => {
    const k = `${keyBase}-${i}`;
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4)
      return <strong key={k} className="font-semibold text-ink">{inline(part.slice(2, -2), products, k)}</strong>;
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={k}>{part.slice(1, -1)}</em>;
    const m = part.match(/^\[\[product:([^\]]+)\]\]$/);
    if (m) {
      const p = products.get(m[1].trim());
      if (!p) return null;
      return (
        <Link key={k} to={`/product/${p.id}`} data-testid={`stylist-product-chip-${p.id}`}
          className="mx-1 inline-flex items-center gap-1.5 rounded-full border border-border bg-white py-0.5 pl-0.5 pr-2.5 align-middle text-xs transition-colors duration-200 hover:border-brand">
          <img src={p.image_url} alt="" className="size-5 rounded-full object-cover" />
          <span className="font-medium">{p.name}</span>
          <span className="font-mono text-muted-foreground">{rupiah(p.price)}</span>
        </Link>
      );
    }
    return <Fragment key={k}>{part}</Fragment>;
  });
}

function RichText({ text, products }: { text: string; products: Map<string, Product> }) {
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {text.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={i} className="h-1" />;
        const bullet = /^([-*•]|\d+\.)\s+/.test(trimmed);
        const heading = trimmed.match(/^#{1,4}\s+(.*)$/);
        if (heading) return <p key={i} className="pt-1 font-heading text-lg">{inline(heading[1], products, `h${i}`)}</p>;
        return bullet ? (
          <p key={i} className="flex gap-2 pl-1"><span className="text-brand">—</span><span>{inline(trimmed.replace(/^([-*•]|\d+\.)\s+/, ""), products, `b${i}`)}</span></p>
        ) : (
          <p key={i}>{inline(trimmed, products, `p${i}`)}</p>
        );
      })}
    </div>
  );
}

export default function Stylist() {
  const { t, lang } = useI18n();
  const qc = useQueryClient();
  const { data: me, isLoading: meLoading } = useMe();
  const { data: history } = useQuery({
    queryKey: ["stylist-history"],
    queryFn: () => apiGet<StylistMessage[]>("/ai/stylist/history"),
    enabled: !!me,
  });
  const { data: products } = useQuery({ queryKey: ["products", "all"], queryFn: () => apiGet<Product[]>("/products") });
  const productMap = new Map((products ?? []).map((p) => [p.id, p]));
  const [input, setInput] = useState("");
  const [pendingUser, setPendingUser] = useState<string | null>(null);
  const [streaming, setStreaming] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [history, streaming, pendingUser]);

  const clear = useMutation({
    mutationFn: () => apiDelete("/ai/stylist/history"),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["stylist-history"] }),
  });

  const send = async (text: string) => {
    const msg = text.trim();
    if (!msg || streaming !== null) return;
    setInput("");
    setPendingUser(msg);
    setStreaming("");
    try {
      await apiStream<StreamEvent>("/ai/stylist/stream", { message: msg, lang }, (ev) => {
        if (ev.delta) setStreaming((s) => (s ?? "") + ev.delta);
        if (ev.error) toast.error(ev.error);
      });
    } catch {
      toast.error(t("error_generic"));
    } finally {
      await qc.invalidateQueries({ queryKey: ["stylist-history"] });
      setPendingUser(null);
      setStreaming(null);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  const prompts = [t("prompt_1"), t("prompt_2"), t("prompt_3"), t("prompt_4")];

  return (
    <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 md:px-8 lg:grid-cols-12 lg:py-14">
      <aside className="lg:col-span-4">
        <p className="text-xs uppercase tracking-[0.25em] text-brand">Gemini · Atelier</p>
        <h1 className="mt-3 font-heading text-4xl md:text-5xl" data-testid="stylist-title">{t("stylist_title")}</h1>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{t("stylist_sub")}</p>
        <div className="mt-8 space-y-2">
          {prompts.map((p, i) => (
            <button
              key={p}
              type="button"
              disabled={!me || streaming !== null}
              onClick={() => void send(p)}
              data-testid={`stylist-prompt-${i}`}
              className="block w-full rounded-sm border border-border bg-white px-4 py-3 text-left text-sm transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand disabled:opacity-50"
            >
              <Sparkles className="mr-2 inline size-3.5 text-brand" />
              {p}
            </button>
          ))}
        </div>
      </aside>

      <section className="flex min-h-[560px] flex-col rounded-sm border border-border bg-white lg:col-span-8">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">FASHION_MART Stylist</p>
          {me && (
            <Button variant="ghost" size="sm" onClick={() => clear.mutate()} disabled={streaming !== null} data-testid="stylist-clear-btn">
              <RotateCcw /> {t("stylist_clear")}
            </Button>
          )}
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto p-5" style={{ maxHeight: "62vh" }} data-testid="stylist-messages">
          {!meLoading && !me && (
            <div className="py-20 text-center">
              <p className="text-muted-foreground" data-testid="stylist-login-required">{t("stylist_login")}</p>
              <Link to="/login" className={buttonVariants({ className: "mt-5" })} data-testid="stylist-login-link">{t("nav_login")}</Link>
            </div>
          )}
          {me && history?.length === 0 && pendingUser === null && (
            <p className="py-20 text-center text-sm text-muted-foreground" data-testid="stylist-empty">{t("stylist_empty")}</p>
          )}
          {history?.map((m) => (
            <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"} data-testid={`stylist-msg-${m.role}`}>
              {m.role === "user" ? (
                <p className="max-w-[80%] rounded-sm bg-ink px-4 py-2.5 text-sm text-parchment">{m.content}</p>
              ) : (
                <div className="max-w-[90%] rounded-sm border border-[#E2DDD5] bg-bubble px-4 py-3"><RichText text={m.content} products={productMap} /></div>
              )}
            </div>
          ))}
          {pendingUser !== null && (
            <div className="flex justify-end"><p className="max-w-[80%] rounded-sm bg-ink px-4 py-2.5 text-sm text-parchment">{pendingUser}</p></div>
          )}
          {streaming !== null && (
            <div className="flex" data-testid="stylist-streaming">
              <div className="max-w-[90%] rounded-sm border border-[#E2DDD5] bg-bubble px-4 py-3">
                {streaming ? <RichText text={streaming} products={productMap} /> : <span className="text-sm text-muted-foreground">…</span>}
                <span className="ml-0.5 inline-block h-4 w-px animate-caret bg-ink align-middle" />
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <form onSubmit={onSubmit} className="flex gap-2 border-t border-border p-4">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(input);
              }
            }}
            disabled={!me}
            rows={1}
            placeholder={t("stylist_placeholder")}
            className="min-h-11 resize-none"
            data-testid="ai-stylist-input"
          />
          <Button type="submit" disabled={!me || !input.trim() || streaming !== null} className="h-11 bg-brand text-white hover:bg-brand/90" data-testid="ai-stylist-send-btn">
            <Send /> <span className="hidden sm:inline">{t("stylist_send")}</span>
          </Button>
        </form>
      </section>
    </div>
  );
}
