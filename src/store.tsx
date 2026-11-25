// App-wide state: the farm snapshot and navigation.
// Office Wi-Fi: the snapshot is polled every 3 s. Anywhere: it streams from Firebase, and while the app is open it tells
// the studio server a phone is looking (so updates come every few seconds instead of once a minute).
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { api, CloudDenied, getConn, getRoute, NotPaired, onImages, pickRoute, Route, setSnapActivity, State } from "./api";
import { subscribeState, watch } from "./cloud";

export type Tab = "home" | "queue" | "review" | "farm" | "more";
export type Screen =
  | { name: "job"; id: string }
  | { name: "new" }
  | { name: "activity" }
  | { name: "website" }
  | { name: "settings" };

interface Store {
  state: State | null; error: string; lastOk: number; route: Route | null;
  refresh: () => Promise<void>;
  reroute: () => Promise<void>;
  tab: Tab; setTab: (t: Tab) => void;
  stack: Screen[]; push: (s: Screen) => void; pop: () => void;
  toast: (t: string) => void;
  unpaired: (why?: string) => void;
}
const Ctx = createContext<Store>(null as unknown as Store);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children, onUnpaired, onToast }: { children: React.ReactNode; onUnpaired: (why?: string) => void; onToast: (t: string) => void }) {
  const [state, setState] = useState<State | null>(null);
  const [error, setError] = useState("");
  const [lastOk, setLastOk] = useState(0);
  const [route, setRoute] = useState<Route | null>(getRoute());
  const [, setPics] = useState(0);
  const dev = (window as unknown as { __dev?: URLSearchParams }).__dev;
  const [tab, setTabRaw] = useState<Tab>((dev?.get("tab") as Tab) || "home");
  const [stack, setStack] = useState<Screen[]>(() => {
    const s = dev?.get("screen");
    return s ? [(s.startsWith("job:") ? { name: "job", id: s.slice(4) } : { name: s }) as Screen] : [];
  });
  const busy = useRef(false);

  const fail = useCallback((e: unknown) => {
    if (e instanceof NotPaired || e instanceof CloudDenied) onUnpaired(e instanceof CloudDenied ? e.message : undefined);
    else setError(String((e as Error).message || e));
  }, [onUnpaired]);

  // office Wi-Fi: ask for the snapshot
  const refresh = useCallback(async () => {
    if (getRoute() !== "lan") { const c = getConn(); if (c && getRoute() === "cloud") watch(c.device); return; }
    if (busy.current) return;
    busy.current = true;
    try { setState(await api.state()); setError(""); setLastOk(Date.now()); }
    catch (e) { fail(e); }
    finally { busy.current = false; }
  }, [fail]);

  const reroute = useCallback(async () => { setRoute(await pickRoute()); }, []);

  // check the way every minute (walking into the office switches to the Wi-Fi, leaving it switches to Firebase)
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) reroute(); }, 60_000);
    return () => clearInterval(t);
  }, [reroute]);
  useEffect(() => onImages(() => setPics((n) => n + 1)), []);

  useEffect(() => {
    if (!route) return;
    const vis = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", vis);
    if (route === "lan") {
      refresh();
      const timer = window.setInterval(() => { if (!document.hidden) refresh(); }, 3000);
      return () => { clearInterval(timer); document.removeEventListener("visibilitychange", vis); };
    }
    const device = getConn()?.device || "phone";
    watch(device);
    const beat = window.setInterval(() => { if (!document.hidden) watch(device); }, 50_000);
    const off = subscribeState((s, time) => {
      const st = s as State;
      setState(st); setSnapActivity(st.activity || null); setLastOk(time);
      setError(Date.now() - time > 3 * 60_000 && Date.now() - time < 7 * 24 * 3600_000
        ? `No update from ${st.pc} for ${Math.round((Date.now() - time) / 60_000)} min. Is the app open there?` : "");
    }, fail);
    return () => { off(); clearInterval(beat); document.removeEventListener("visibilitychange", vis); };
  }, [route, refresh, fail]);

  const setTab = (t: Tab) => { setStack([]); setTabRaw(t); };
  const push = (s: Screen) => setStack((st) => [...st, s]);
  const pop = () => setStack((st) => st.slice(0, -1));

  return <Ctx.Provider value={{ state, error, lastOk, route, refresh, reroute, tab, setTab, stack, push, pop, toast: onToast, unpaired: onUnpaired }}>{children}</Ctx.Provider>;
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
