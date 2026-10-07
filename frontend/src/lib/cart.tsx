import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface CartLine {
  product_id: string;
  name: string;
  price: number;
  image_url: string;
  size: string;
  quantity: number;
}

interface CartCtx {
  items: CartLine[];
  open: boolean;
  setOpen: (o: boolean) => void;
  add: (line: CartLine) => void;
  setQty: (product_id: string, size: string, qty: number) => void;
  clear: () => void;
  count: number;
  subtotal: number;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "fm_cart";

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
      const hit = prev.find((i) => i.product_id === line.product_id && i.size === line.size);
      if (hit) {
        return prev.map((i) => (i === hit ? { ...i, quantity: Math.min(20, i.quantity + line.quantity) } : i));
      }
      return [...prev, line];
    });
  }, []);

  const setQty = useCallback((product_id: string, size: string, qty: number) => {
    setItems((prev) =>
      qty <= 0
        ? prev.filter((i) => !(i.product_id === product_id && i.size === size))
        : prev.map((i) => (i.product_id === product_id && i.size === size ? { ...i, quantity: Math.min(20, qty) } : i)),
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
