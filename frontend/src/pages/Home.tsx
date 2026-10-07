import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CreditCard, Layers, Sparkles } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { Product } from "@/lib/types";
import { useI18n } from "@/lib/i18n";
import { buttonVariants } from "@/components/ui/button";
import ProductCard from "@/components/ProductCard";
import { cn } from "@/lib/utils";

const HERO = "https://images.unsplash.com/photo-1649094995015-047fcf337506?auto=format&fit=crop&w=1400&q=80";
const SIDE = "https://images.unsplash.com/photo-1699459867169-515c14378f79?auto=format&fit=crop&w=800&q=80";
const MARKETS = ["Shopee", "Tokopedia", "TikTok Shop", "Lazada", "Midtrans", "QRIS", "GoPay", "BCA VA"];

export default function Home() {
  const { t } = useI18n();
  const { data: products, isError } = useQuery({ queryKey: ["products", "all"], queryFn: () => apiGet<Product[]>("/products") });
  const features = [
    { icon: Sparkles, title: t("feature_stylist_t"), desc: t("feature_stylist_d"), to: "/stylist" },
    { icon: Layers, title: t("feature_listing_t"), desc: t("feature_listing_d"), to: "/seller" },
    { icon: CreditCard, title: t("feature_pay_t"), desc: t("feature_pay_d"), to: "/products" },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-7xl gap-8 px-4 pb-16 pt-10 md:grid-cols-12 md:px-8 md:pt-16">
        <div className="flex flex-col justify-center md:col-span-6 animate-fade-up">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-brand" data-testid="hero-kicker">{t("hero_kicker")}</p>
          <h1 className="mt-5 whitespace-pre-line font-heading text-5xl leading-[1.05] tracking-tight md:text-6xl lg:text-7xl" data-testid="hero-title">
            {t("hero_title")}
          </h1>
          <p className="mt-6 max-w-lg text-base leading-relaxed text-muted-foreground">{t("hero_sub")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products" className={cn(buttonVariants({ size: "lg" }), "h-12 px-6")} data-testid="hero-shop-btn">
              {t("hero_cta_shop")} <ArrowRight />
            </Link>
            <Link to="/stylist" className={cn(buttonVariants({ size: "lg", variant: "outline" }), "h-12 border-ink px-6")} data-testid="hero-stylist-btn">
              <Sparkles /> {t("hero_cta_stylist")}
            </Link>
          </div>
        </div>
        <div className="relative md:col-span-6">
          <div className="relative aspect-[4/5] overflow-hidden rounded-sm">
            <img src={HERO} alt="Editorial" className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(20,20,19,0)_55%,rgba(20,20,19,0.65)_100%)]" />
            <p className="absolute bottom-6 left-6 font-heading text-2xl italic text-white">Linen &amp; Light</p>
          </div>
          <div className="absolute -bottom-8 -left-6 hidden w-40 overflow-hidden rounded-sm border-4 border-parchment shadow-xl lg:block">
            <img src={SIDE} alt="Lookbook" className="aspect-[3/4] w-full object-cover" />
          </div>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-border bg-white py-4">
        <div className="flex w-max animate-marquee gap-12 whitespace-nowrap">
          {[...MARKETS, ...MARKETS].map((m, i) => (
            <span key={i} className="font-heading text-xl italic text-muted-foreground">{m} <span className="text-brand">✦</span></span>
          ))}
        </div>
      </div>

      {/* Features bento */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-16 md:grid-cols-12 md:px-8 md:py-24">
        {features.map((f, i) => (
          <Link
            key={f.title}
            to={f.to}
            data-testid={`feature-card-${i}`}
            className={cn(
              "group flex flex-col justify-between rounded-sm border border-border p-7 transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-md",
              i === 0 ? "bg-ink text-[#F5F3EF] md:col-span-6 md:row-span-2 md:min-h-[320px]" : "bg-white md:col-span-6",
            )}
          >
            <f.icon className={cn("size-6", i === 0 ? "text-[#E87979]" : "text-brand")} />
            <div className="mt-10">
              <h3 className={cn("font-heading", i === 0 ? "text-4xl" : "text-2xl")}>{f.title}</h3>
              <p className={cn("mt-2 max-w-md text-sm", i === 0 ? "text-[#A8A29A]" : "text-muted-foreground")}>{f.desc}</p>
            </div>
          </Link>
        ))}
      </section>

      {/* New arrivals */}
      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <div className="mb-8 flex items-end justify-between">
          <h2 className="font-heading text-3xl md:text-4xl">{t("section_new")}</h2>
          <Link to="/products" className="text-sm underline-offset-4 hover:text-brand hover:underline" data-testid="home-see-all-link">
            {t("section_see_all")} →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 lg:grid-cols-4 md:gap-x-8">
          {!isError && products?.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} index={i} />)}
          {!products && !isError && Array.from({ length: 4 }).map((_, i) => <div key={i} className="aspect-[3/4] animate-pulse rounded-sm bg-muted" />)}
        </div>
      </section>
    </div>
  );
}
