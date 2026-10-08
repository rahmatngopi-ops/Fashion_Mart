import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartLine {
  product_id: string;
  name: string;
  price: number;
  image_url: string;
  size: string;
  color: string;
  quantity: number;
}

interface CartCtx {
  items: CartLine[];
  open: boolean;
  setOpen: (o: boolean) => void;
  add: (line: CartLine) => void;
  setQty: (line: CartLine, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "fm_cart_v2";
const same = (a: CartLine, b: CartLine) => a.product_id === b.product_id && a.size === b.size && a.color === b.color;

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartLine[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? "[]") as CartLine[];
    } catch {
      return [];
    }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const add = useCallback((line: CartLine) => {
    setItems((prev) => {
      const hit = prev.find((i) => same(i, line));
      if (hit) {
        return prev.map((i) => (i === hit ? { ...i, quantity: Math.min(20, i.quantity + line.quantity) } : i));
      }
      return [...prev, line];
    });
  }, []);

  const setQty = useCallback((line: CartLine, qty: number) => {
    setItems((prev) =>
      qty <= 0 ? prev.filter((i) => !same(i, line)) : prev.map((i) => (same(i, line) ? { ...i, quantity: Math.min(20, qty) } : i)),
    );
  }, []);

  const clear = useCallback(() => setItems([]), []);

  const value = useMemo(
    () => ({
      items, open, setOpen, add, setQty, clear,
      count: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.quantity * i.price, 0),
    }),
    [items, open, add, setQty, clear],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart(): CartCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart outside provider");
  return ctx;
}
