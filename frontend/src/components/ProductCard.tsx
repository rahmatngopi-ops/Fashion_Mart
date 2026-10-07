import { Link } from "react-router-dom";
import { motion } from "motion/react";
import type { Product } from "@/lib/types";
import { rupiah } from "@/lib/helpers";

export default function ProductCard({ product, index = 0 }: { product: Product; index?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index, 8) * 0.06 }}
    >
      <Link to={`/product/${product.id}`} className="group block" data-testid={`product-card-${product.id}`}>
        <div className="relative aspect-[3/4] overflow-hidden rounded-sm bg-muted">
          <img
            src={product.image_url}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
          />
          <span className="absolute left-3 top-3 rounded-full bg-parchment/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.15em] backdrop-blur">
            {product.category}
          </span>
        </div>
        <div className="mt-3 flex items-start justify-between gap-3">
          <p className="text-sm font-medium transition-colors duration-200 group-hover:text-brand" data-testid="product-card-name">{product.name}</p>
          <p className="shrink-0 font-mono text-xs" data-testid="product-card-price">{rupiah(product.price)}</p>
        </div>
      </Link>
    </motion.div>
  );
}
