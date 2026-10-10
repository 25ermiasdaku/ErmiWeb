/**
 * The basket, held in memory for the session.
 *
 * A line is keyed by item **and** its sorted option ids, so a Large oat latte
 * and a Small whole-milk latte are two lines rather than one that keeps
 * changing its mind. `unitPriceCents` is worked out once on add, exactly as the
 * web till does — the server still recomputes every price from the ids, so a
 * tampered cart cannot invent a cheaper drink.
 */
import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { MenuItem, MenuOption } from "@/api";

export type CartLineOption = { id: number; label: string; priceDeltaCents: number };

export type CartLine = {
  key: string;
  itemId: number;
  name: string;
  icon: string;
  qty: number;
  unitPriceCents: number;
  options: CartLineOption[];
};

type CartContextValue = {
  lines: CartLine[];
  /** Add a configured drink. An optional quantity saves the detail screen a loop. */
  add: (item: MenuItem, chosenOptions: MenuOption[], quantity?: number) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  subtotalCents: number;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

/** Stable identity for a configured drink: item id plus sorted option ids. */
function lineKey(itemId: number, options: CartLineOption[]): string {
  const ids = options
    .map((option) => option.id)
    .sort((a, b) => a - b)
    .join(",");
  return `${itemId}:${ids}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((item: MenuItem, chosenOptions: MenuOption[], quantity = 1) => {
    const options: CartLineOption[] = chosenOptions.map((option) => ({
      id: option.id,
      label: option.label,
      priceDeltaCents: option.priceDeltaCents,
    }));
    const key = lineKey(item.id, options);
    const unitPriceCents =
      item.basePriceCents + options.reduce((sum, option) => sum + option.priceDeltaCents, 0);

    setLines((prev) => {
      const existing = prev.find((line) => line.key === key);
      if (existing) {
        return prev.map((line) =>
          line.key === key ? { ...line, qty: line.qty + quantity } : line,
        );
      }
      return [
        ...prev,
        { key, itemId: item.id, name: item.name, icon: item.icon, qty: quantity, unitPriceCents, options },
      ];
    });
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((line) => line.key !== key));
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) =>
      qty <= 0
        ? prev.filter((line) => line.key !== key)
        : prev.map((line) => (line.key === key ? { ...line, qty } : line)),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const subtotalCents = useMemo(
    () => lines.reduce((sum, line) => sum + line.unitPriceCents * line.qty, 0),
    [lines],
  );
  const count = useMemo(() => lines.reduce((sum, line) => sum + line.qty, 0), [lines]);

  const value = useMemo<CartContextValue>(
    () => ({ lines, add, remove, setQty, clear, subtotalCents, count }),
    [lines, add, remove, setQty, clear, subtotalCents, count],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const value = useContext(CartContext);
  if (!value) throw new Error("useCart must be used inside <CartProvider>.");
  return value;
}
