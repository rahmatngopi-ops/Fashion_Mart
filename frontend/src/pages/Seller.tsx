import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, Download, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import type { ListingResponse, Marketplace, MarketplaceListing, Order, Product, ProductInput } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { errMsg, rupiah, useMe } from "@/lib/helpers";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/pages/Orders";

const MARKETS: { key: Marketplace; label: string; bg: string; fg: string }[] = [
  { key: "shopee", label: "Shopee", bg: "#FFF1EB", fg: "#EE4D2D" },
  { key: "tokopedia", label: "Tokopedia", bg: "#EEFAEE", fg: "#03AC0E" },
  { key: "tiktok", label: "TikTok Shop", bg: "#F4F4F6", fg: "#010101" },
  { key: "lazada", label: "Lazada", bg: "#EDF3FE", fg: "#0F146D" },
];

const EMPTY: ProductInput = { name: "", category: "", price: 0, stock: 0, image_url: "", description: "", colors: [], sizes: [] };
const csvList = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function copy(text: string, msg: string) {
  void navigator.clipboard.writeText(text).then(() => toast.success(msg), () => toast.error("Clipboard blocked"));
}

function exportCsv(name: string, listings: MarketplaceListing[]) {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ["marketplace", "title", "description", "tags", "suggested_price"],
    ...listings.map((l) => [l.marketplace, l.title, l.description, l.tags.join(" "), l.suggested_price]),
  ];
  const blob = new Blob(["\ufeff" + rows.map((r) => r.map(esc).join(",")).join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name.replace(/\W+/g, "_").toLowerCase() || "listing"}_marketplace.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function ProductDialog({ open, onOpenChange, editing }: { open: boolean; onOpenChange: (o: boolean) => void; editing: Product | null }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const init = editing ?? EMPTY;
  const [form, setForm] = useState({
    ...init, colorsText: init.colors.join(", "), sizesText: init.sizes.join(", "),
  });
  const save = useMutation({
    mutationFn: (body: ProductInput) => (editing ? apiPut<Product>(`/products/${editing.id}`, body) : apiPost<Product>("/products", body)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products"] });
      toast.success(t("save"));
      onOpenChange(false);
    },
    onError: (e) => toast.error(errMsg(e, t("error_generic"))),
  });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    save.mutate({
      name: form.name, category: form.category, price: Number(form.price), stock: Number(form.stock),
      image_url: form.image_url, description: form.description, colors: csvList(form.colorsText), sizes: csvList(form.sizesText),
    });
  };
  const field = (key: "name" | "category" | "image_url", label: string) => (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input required={key !== "image_url"} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} data-testid={`product-form-${key.replace("_", "-")}-input`} />
    </div>
  );
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg" data-testid="product-dialog">
        <DialogHeader><DialogTitle className="font-heading text-2xl">{editing ? t("edit_product") : t("add_product")}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {field("name", t("product_name"))}
          {field("category", t("category"))}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("price")} (Rp)</Label>
              <Input type="number" min={1} required value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} data-testid="product-form-price-input" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("stock")}</Label>
              <Input type="number" min={0} required value={form.stock} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} data-testid="product-form-stock-input" />
            </div>
          </div>
          {field("image_url", t("image_url"))}
          <div className="space-y-1.5">
            <Label>{t("description")}</Label>
            <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="product-form-description-input" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t("colors_csv")}</Label>
              <Input value={form.colorsText} onChange={(e) => setForm({ ...form, colorsText: e.target.value })} data-testid="product-form-colors-input" />
            </div>
            <div className="space-y-1.5">
              <Label>{t("sizes_csv")}</Label>
              <Input value={form.sizesText} onChange={(e) => setForm({ ...form, sizesText: e.target.value })} data-testid="product-form-sizes-input" />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="product-form-cancel-btn">{t("cancel")}</Button>
            <Button type="submit" disabled={save.isPending} data-testid="product-form-save-btn">{t("save")}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CatalogTab({ products }: { products: Product[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [dialog, setDialog] = useState<{ open: boolean; editing: Product | null; key: number }>({ open: false, editing: null, key: 0 });
  const del = useMutation({
    mutationFn: (id: string) => apiDelete(`/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products"] }),
    onError: (e) => toast.error(errMsg(e, t("error_generic"))),
  });
  return (
    <div className="rounded-sm border border-border bg-white">
      <div className="flex items-center justify-between border-b border-border p-4">
        <p className="font-mono text-xs text-muted-foreground" data-testid="catalog-count">{products.length} SKU</p>
        <Button onClick={() => setDialog({ open: true, editing: null, key: dialog.key + 1 })} data-testid="catalog-add-product-btn">
          <Plus /> {t("add_product")}
        </Button>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("product_name")}</TableHead>
            <TableHead>{t("category")}</TableHead>
            <TableHead className="text-right">{t("price")}</TableHead>
            <TableHead className="text-right">{t("stock")}</TableHead>
            <TableHead>Marketplace</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((p) => (
            <TableRow key={p.id} data-testid={`catalog-row-${p.id}`}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <img src={p.image_url} alt="" className="h-10 w-8 rounded-sm object-cover" />
                  <span className="font-medium">{p.name}</span>
                </div>
              </TableCell>
              <TableCell className="text-muted-foreground">{p.category}</TableCell>
              <TableCell className="text-right font-mono text-xs">{rupiah(p.price)}</TableCell>
              <TableCell className="text-right font-mono text-xs">{p.stock}</TableCell>
              <TableCell>
                <div className="flex gap-1">
                  {MARKETS.map((m) => {
                    const ready = p.listings.some((l) => l.marketplace === m.key);
                    return (
                      <span key={m.key} title={m.label} className="size-2.5 rounded-full" style={{ background: ready ? m.fg : "#E5E0D8" }} />
                    );
                  })}
                </div>
              </TableCell>
              <TableCell className="text-right">
                <Button size="icon-sm" variant="ghost" aria-label="edit" onClick={() => setDialog({ open: true, editing: p, key: dialog.key + 1 })} data-testid={`catalog-edit-${p.id}`}><Pencil /></Button>
                <Button size="icon-sm" variant="ghost" aria-label="delete" onClick={() => { if (confirm(`${t("delete")} ${p.name}?`)) del.mutate(p.id); }} data-testid={`catalog-delete-${p.id}`}><Trash2 /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {dialog.open && (
        <ProductDialog key={dialog.key} open={dialog.open} editing={dialog.editing} onOpenChange={(o) => setDialog({ ...dialog, open: o })} />
      )}
    </div>
  );
}

function ListingTab({ products }: { products: Product[] }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const [productId, setProductId] = useState("");
  const [form, setForm] = useState({ name: "", category: "", notes: "", base_price: "" });
  const [result, setResult] = useState<MarketplaceListing[]>([]);

  const pick = (id: string) => {
    setProductId(id);
    const p = products.find((x) => x.id === id);
    if (p) {
      setForm({ name: p.name, category: p.category, notes: p.description, base_price: String(p.price) });
      setResult(p.listings);
    }
  };

  const gen = useMutation({
    mutationFn: () =>
      apiPost<ListingResponse>("/ai/listing", {
        product_id: productId || null, name: form.name, category: form.category, notes: form.notes,
        base_price: form.base_price ? Number(form.base_price) : null,
      }),
    onSuccess: (r) => {
      setResult(r.listings);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e) => toast.error(errMsg(e, t("error_generic"))),
  });

  const names = Object.fromEntries(products.map((p) => [p.id, p.name]));

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <form
        onSubmit={(e) => { e.preventDefault(); gen.mutate(); }}
        className="h-fit space-y-4 rounded-sm border border-border bg-white p-5 lg:col-span-4"
        data-testid="listing-form"
      >
        <div className="space-y-1.5">
          <Label>{t("pick_product")}</Label>
          <Select value={productId} onValueChange={pick}>
            <SelectTrigger className="w-full" data-testid="listing-product-select">
              <SelectValue>{(v) => (v ? names[v as string] : "—")}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {products.map((p) => (
                <SelectItem key={p.id} value={p.id} data-testid={`listing-product-option-${p.id}`}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label>{t("product_name")}</Label>
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="listing-name-input" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>{t("category")}</Label>
            <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} data-testid="listing-category-input" />
          </div>
          <div className="space-y-1.5">
            <Label>{t("price")} (Rp)</Label>
            <Input type="number" min={0} value={form.base_price} onChange={(e) => setForm({ ...form, base_price: e.target.value })} data-testid="listing-price-input" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>{t("seller_notes")}</Label>
          <Textarea rows={4} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} data-testid="listing-notes-input" />
        </div>
        <Button type="submit" disabled={gen.isPending || !form.name} className="h-11 w-full bg-brand text-white hover:bg-brand/90" data-testid="seller-ai-generate-listing-btn">
          <Sparkles className={gen.isPending ? "animate-spin" : ""} /> {gen.isPending ? t("generating") : t("generate")}
        </Button>
      </form>

      <div className="rounded-sm border border-border bg-white p-5 lg:col-span-8" data-testid="listing-result">
        {result.length === 0 ? (
          <p className="py-24 text-center text-sm text-muted-foreground" data-testid="listing-empty">
            {gen.isPending ? t("generating") : t("listing_empty")}
          </p>
        ) : (
          <Tabs defaultValue="shopee">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <TabsList>
                {MARKETS.map((m) => (
                  <TabsTrigger key={m.key} value={m.key} data-testid={`seller-marketplace-tab-${m.key}`}>{m.label}</TabsTrigger>
                ))}
              </TabsList>
              <Button variant="outline" size="sm" onClick={() => exportCsv(form.name, result)} data-testid="seller-export-csv-btn">
                <Download /> {t("export_csv")}
              </Button>
            </div>
            {MARKETS.map((m) => {
              const l = result.find((x) => x.marketplace === m.key);
              if (!l) return <TabsContent key={m.key} value={m.key}>—</TabsContent>;
              const all = `${l.title}\n\n${l.description}\n\n${l.tags.join(" ")}`;
              return (
                <TabsContent key={m.key} value={m.key} className="mt-5 space-y-5 animate-fade-up" data-testid={`listing-panel-${m.key}`}>
                  <div className="flex items-center justify-between rounded-sm px-4 py-3" style={{ background: m.bg, color: m.fg }}>
                    <span className="text-sm font-semibold">{m.label}</span>
                    <span className="font-mono text-sm" data-testid={`listing-${m.key}-price`}>{t("suggested_price")}: {rupiah(l.suggested_price)}</span>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("title")} · <span className="font-mono">{l.title.length}</span></p>
                      <Button size="xs" variant="ghost" onClick={() => copy(l.title, t("copied"))} data-testid={`seller-copy-${m.key}-title-btn`}><Copy /> {t("copy")}</Button>
                    </div>
                    <p className="mt-1 font-medium" data-testid={`listing-${m.key}-title`}>{l.title}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("description")}</p>
                      <Button size="xs" variant="ghost" onClick={() => copy(l.description, t("copied"))} data-testid={`seller-copy-${m.key}-description-btn`}><Copy /> {t("copy")}</Button>
                    </div>
                    <p className="mt-1 max-h-72 overflow-y-auto whitespace-pre-line rounded-sm bg-muted p-3 text-sm leading-relaxed" data-testid={`listing-${m.key}-description`}>{l.description}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("tags")}</p>
                      <Button size="xs" variant="ghost" onClick={() => copy(l.tags.join(" "), t("copied"))} data-testid={`seller-copy-${m.key}-tags-btn`}><Copy /> {t("copy")}</Button>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5" data-testid={`listing-${m.key}-tags`}>
                      {l.tags.map((tag) => <span key={tag} className="rounded-full border border-border px-2.5 py-0.5 font-mono text-[11px]">{tag}</span>)}
                    </div>
                  </div>
                  <Button variant="outline" className="w-full" onClick={() => copy(all, t("copied"))} data-testid={`seller-copy-${m.key}-all-btn`}><Copy /> {t("copy")} — {m.label}</Button>
                </TabsContent>
              );
            })}
          </Tabs>
        )}
      </div>
    </div>
  );
}

function OrdersTab() {
  const { t } = useI18n();
  const { data: orders } = useQuery({ queryKey: ["orders", "admin"], queryFn: () => apiGet<Order[]>("/admin/orders") });
  return (
    <div className="rounded-sm border border-border bg-white">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order</TableHead>
            <TableHead>{t("customer")}</TableHead>
            <TableHead>Items</TableHead>
            <TableHead className="text-right">{t("total")}</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders?.length === 0 && (
            <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground">{t("orders_empty")}</TableCell></TableRow>
          )}
          {orders?.map((o) => (
            <TableRow key={o.id} data-testid={`admin-order-row-${o.order_code}`}>
              <TableCell className="font-mono text-xs">{o.order_code}</TableCell>
              <TableCell className="text-xs">{o.phone}<br /><span className="text-muted-foreground">{o.address.slice(0, 40)}</span></TableCell>
              <TableCell className="text-xs">{o.items.map((i) => `${i.name} x${i.quantity}`).join(", ")}</TableCell>
              <TableCell className="text-right font-mono text-xs">{rupiah(o.gross_amount)}</TableCell>
              <TableCell><StatusBadge status={o.payment_status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default function Seller() {
  const { t } = useI18n();
  const { data: me, isLoading } = useMe();
  const { data: products } = useQuery({ queryKey: ["products", "all"], queryFn: () => apiGet<Product[]>("/products") });

  if (!isLoading && me?.role !== "admin") {
    return (
      <div className="mx-auto max-w-md px-4 py-24 text-center">
        <p className="text-muted-foreground" data-testid="seller-admin-required">Seller Studio — admin only.</p>
        <Link to="/login" className={buttonVariants({ className: "mt-6" })} data-testid="seller-login-link">{t("nav_login")}</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 md:px-8 md:py-14">
      <p className="text-xs uppercase tracking-[0.25em] text-brand">Shopee · Tokopedia · TikTok Shop · Lazada</p>
      <h1 className="mt-2 font-heading text-4xl md:text-5xl" data-testid="seller-title">{t("seller_title")}</h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">{t("seller_sub")}</p>
      <Tabs defaultValue="listing" className="mt-8">
        <TabsList variant="line" className="mb-6">
          <TabsTrigger value="listing" data-testid="seller-tab-listing">{t("tab_listing")}</TabsTrigger>
          <TabsTrigger value="catalog" data-testid="seller-tab-catalog">{t("tab_catalog")}</TabsTrigger>
          <TabsTrigger value="orders" data-testid="seller-tab-orders">{t("tab_orders")}</TabsTrigger>
        </TabsList>
        <TabsContent value="listing"><ListingTab products={products ?? []} /></TabsContent>
        <TabsContent value="catalog"><CatalogTab products={products ?? []} /></TabsContent>
        <TabsContent value="orders"><OrdersTab /></TabsContent>
      </Tabs>
    </div>
  );
}
