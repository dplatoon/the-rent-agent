import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Listing } from "@/lib/listings";

type CompareState = {
  enabled: boolean;
  items: Listing[];
  toggleEnabled: () => void;
  setEnabled: (v: boolean) => void;
  toggle: (l: Listing) => void;
  remove: (id: string) => void;
  clear: () => void;
  has: (id: string) => boolean;
};

const MAX = 4;

export const useCompare = create<CompareState>()(
  persist(
    (set, get) => ({
      enabled: false,
      items: [],
      toggleEnabled: () => set((s) => ({ enabled: !s.enabled })),
      setEnabled: (v) => set({ enabled: v }),
      toggle: (l) => {
        const { items } = get();
        const exists = items.find((x) => x.id === l.id);
        if (exists) set({ items: items.filter((x) => x.id !== l.id) });
        else if (items.length < MAX) set({ items: [...items, l] });
      },
      remove: (id) => set((s) => ({ items: s.items.filter((x) => x.id !== id) })),
      clear: () => set({ items: [] }),
      has: (id) => !!get().items.find((x) => x.id === id),
    }),
    {
      name: "compare-store",
      storage: createJSONStorage(() =>
        typeof window !== "undefined" ? window.localStorage : (undefined as never)
      ),
      partialize: (s) => ({ enabled: s.enabled, items: s.items }),
      skipHydration: true,
    }
  )
);

if (typeof window !== "undefined") {
  // Hydrate on the client only to avoid SSR mismatch
  void useCompare.persist.rehydrate();
}

export const COMPARE_MAX = MAX;
