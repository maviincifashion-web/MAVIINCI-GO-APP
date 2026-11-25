import { useCallback, useEffect, useRef, useState } from "react";
import { App as Cap } from "@capacitor/app";
import { api, pickRoute } from "./api";
import { auth } from "./cloud";
import { Icon, IconName } from "./icons";
import { StoreProvider, Tab, useStore } from "./store";
import Connect from "./screens/Connect";
import Home from "./screens/Home";
import Queue from "./screens/Queue";
import JobScreen from "./screens/Job";
import Review from "./screens/Review";
import NewJob from "./screens/NewJob";
import Farm from "./screens/Farm";
import Activity from "./screens/Activity";
import More from "./screens/More";
import Website from "./screens/Website";
import SettingsScreen from "./screens/Settings";

export default function App() {
  const [ready, setReady] = useState(false);
  const [paired, setPaired] = useState(false);
  const [gen, setGen] = useState(0);          // remounts the store when the way to the farm changes
  const [why, setWhy] = useState("");
  const [toast, setToast] = useState("");
  const timer = useRef(0);
  const show = useCallback((t: string) => { setToast(t); clearTimeout(timer.current); timer.current = window.setTimeout(() => setToast(""), 3200); }, []);

  // the sign-in is kept on the phone; wait for it, then pick the office Wi-Fi or Firebase
  useEffect(() => { (async () => { await auth.authStateReady(); setPaired(!!(await pickRoute())); setReady(true); })(); }, []);

  // a login the farm refuses is signed out; a removed office pairing is forgotten; another way may still work
  const unpaired = useCallback(async (msg?: string) => {
    if (msg) await api.signOut().catch(() => {}); else await api.forgetLan();
    if (await pickRoute()) { setGen((g) => g + 1); return; }
    setWhy(msg || "This phone was removed from the farm. Connect again.");
    setPaired(false);
  }, []);

  if (!ready) return <div className="app" style={{ display: "grid", placeItems: "center" }}><span className="spin" /></div>;
  return (
    <>
      {paired
        ? <StoreProvider key={gen} onUnpaired={unpaired} onToast={show}><Shell /></StoreProvider>
        : <Connect why={why} onPaired={() => { setWhy(""); setGen((g) => g + 1); setPaired(true); }} />}
      {toast && <div className="toast" onClick={() => setToast("")}>{toast}</div>}
    </>
  );
}

function Shell() {
  const { tab, setTab, stack, pop, state } = useStore();
  const top = stack[stack.length - 1];
  const nav = useRef({ stack, tab, pop, setTab });
  nav.current = { stack, tab, pop, setTab };

  // the Android back button closes the open screen, then goes to Overview, then leaves the app
  useEffect(() => {
    const h = Cap.addListener("backButton", () => {
      const n = nav.current;
      if (n.stack.length) n.pop();
      else if (n.tab !== "home") n.setTab("home");
      else Cap.exitApp();
    });
    return () => { h.then((x) => x.remove()); };
  }, []);

  const reviewCount = (state?.jobs || []).filter((j) => j.status === "review").length;
  const tabs: [Tab, IconName, string, number?][] = [
    ["home", "home", "Overview"], ["queue", "queue", "Queue"], ["review", "review", "Review", reviewCount], ["farm", "farm", "Farm"], ["more", "more", "More"],
  ];

  let screen: React.ReactNode;
  if (top?.name === "job") screen = <JobScreen key={top.id} id={top.id} />;
  else if (top?.name === "new") screen = <NewJob />;
  else if (top?.name === "activity") screen = <Activity />;
  else if (top?.name === "website") screen = <Website />;
  else if (top?.name === "settings") screen = <SettingsScreen />;
  else screen = tab === "home" ? <Home /> : tab === "queue" ? <Queue /> : tab === "review" ? <Review /> : tab === "farm" ? <Farm /> : <More />;

  return (
    <div className="app">
      {screen}
      {!top && (
        <nav className="tabbar">
          {tabs.map(([k, ic, label, n]) => (
            <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              <Icon name={ic} size={21} />{label}{n ? <em>{n}</em> : null}
            </button>
          ))}
        </nav>
      )}
    </div>
  );
}
