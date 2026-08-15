import { createContext, useContext, useEffect, useMemo, useState } from "react";

type FavoritesContextValue = { ids: number[]; count: number; has: (id: number) => boolean; toggle: (id: number) => void };
const FavoritesContext = createContext<FavoritesContextValue | undefined>(undefined);
const storageKey = "majid-siraj-favorites";

export function FavoritesProvider({ children }: { children: React.ReactNode }) {
  const [ids, setIds] = useState<number[]>([]);
  useEffect(() => { try { const saved = JSON.parse(window.localStorage.getItem(storageKey) || "[]"); if (Array.isArray(saved)) setIds(saved.filter(Number.isInteger)); } catch { /* تجاهل قيمة تخزين غير صالحة */ } }, []);
  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify(ids)); }, [ids]);
  const value = useMemo(() => ({ ids, count: ids.length, has: (id: number) => ids.includes(id), toggle: (id: number) => setIds(current => current.includes(id) ? current.filter(item => item !== id) : [...current, id]) }), [ids]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error("useFavorites يجب استخدامه داخل FavoritesProvider");
  return context;
}
