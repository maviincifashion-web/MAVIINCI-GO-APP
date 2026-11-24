// App-wide state: the farm snapshot (polled every 3 s while the app is visible) and navigation.
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, NotPaired, State } from "./api";

export type Tab = "home" | "queue" | "review" | "farm" | "more";
export type Screen =
  | { name: "job"; id: string }
  | { name: "new" }
  | { name: "activity" }
  | { name: "website" }
  | { name: "settings" };

interface Store {
  state: State | null; error: string; lastOk: number;
  refresh: () => Promise<void>;
  tab: Tab; setTab: (t: Tab) => void;
  stack: Screen[]; push: (s: Screen) => void; pop: () => void;
  toast: (t: string) => void;
  unpaired: () => void;
}
const Ctx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children, onUnpaired, onToast }: { children: React.ReactNode; onUnpaired: () => void; onToast: (t: string) => void }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [lastOk, setLastOk] = useState(0);
  const dev = (window as unknown as { __dev?: URLSearchParams }).__dev;
  const [tab, setTabRaw] = useState<Tab>((dev?.get("tab") as Tab) || "home");
  const [stack, setStack] = useState<Screen[]>(() => {
    const s = dev?.get("screen");
    return s ? [(s.startsWith("job:") ? { name: "job", id: s.slice(4) } : { name: s }) as Screen] : [];
  });
  const busy = useRef(false);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try { setState(await api.state()); setError(""); setLastOk(Date.now()); }
    catch (e) { if (e instanceof NotPaired) onUnpaired(); else setError(String((e as Error).message || e)); }
    finally { busy.current = false; }
  }, [onUnpaired]);

  useEffect(() => {
    refresh();
    let timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 3000);
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(timer); document.removeEventListener("visibilitychange", vis); timer = 0; };
  }, [refresh]);

  const setTab = (t: Tab) => { setStack([]); setTabRaw(t); };
  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => st.slice(0, -1));

  return <Ctx.Provider value={{ state, error, lastOk, refresh, tab, setTab, stack, push, pop, toast: onToast, unpaired: onUnpaired }}>{children}</Ctx.Provider>;
}

/** Runs an action with a busy flag; the result or error goes to a toast. */
export function useAction() {
  const { toast, refresh } = useStore();
  const [busy, setBusy] = useState("");
  const run = async (key: string, fn: () => Promise<unknown>, done?: string) => {
    setBusy(key);
    try { await fn(); if (done) toast(done); await refresh(); }
    catch (e) { toast(String((e as Error).message || e)); }
    finally { setBusy(""); }
  };
  return { busy, run };
}
