import { useState } from "react";
import { api, getConn } from "../api";
import { Icon } from "../icons";
import { useStore } from "../store";
import { TopBar } from "../ui";
import { clock } from "../util";
import Connect from "./Connect";

/** The phone's connection to the farm: anywhere (signed in) and/or the office Wi-Fi (paired), and which one is in use. */
export default function SettingsScreen() {
  const { state, error, lastOk, route, reroute, toast, unpaired } = useStore();
  const [add, setAdd] = useState<"" | "anywhere" | "office">("");
  const [, setTick] = useState(0);
  const c = getConn();
  const using = route === "lan" ? "Office Wi-Fi" : route === "cloud" ? "Anywhere (internet)" : "Not connected";
  const done = async () => { setAdd(""); await reroute(); setTick((n) => n + 1); toast("Connected"); };

  return (
    <>
      <TopBar title="Connection" />
      <div className="body">
        <div className={`conn${error ? " off" : ""}`}>
          <span className="big"><Icon name={route === "cloud" ? "live" : "wifi"} size={22} /></span>
          <div style={{ flex: 1 }}><b>{error ? "Farm not answering" : `${using} · ${state?.pc || c?.lan?.pc || ""}`}</b>
            <small>{error || (lastOk ? `Last update ${clock(lastOk)}${route === "lan" ? " · every 3 s" : " · live"}` : "Connecting…")}</small></div>
        </div>

        <div className="glbl">Anywhere</div>
        <div className="set">
          {c?.cloud ? <>
            <div className="r"><div>Signed in<small>{c.cloud.email} · works on mobile data and any Wi-Fi</small></div></div>
            <button className="r" onClick={async () => { if (!confirm("Sign out of the farm on this phone?")) return; await api.signOut(); if (getConn()?.lan) { await reroute(); setTick((n) => n + 1); } else unpaired("Signed out."); }}>
              <div style={{ color: "var(--bad)" }}>Sign out</div></button>
          </> : <button className="r" onClick={() => setAdd("anywhere")}><div>Sign in to use the farm from anywhere<small>With your admin panel login</small></div><Icon name="chev" size={16} /></button>}
        </div>
        {add === "anywhere" && <Connect embedded start="anywhere" onPaired={done} />}

        <div className="glbl">Office Wi-Fi</div>
        <div className="set">
          {c?.lan ? <>
            <div className="r"><div>Paired with {c.lan.pc}<small>{c.lan.base.replace(/^https?:\/\//, "")} · used automatically inside the office (faster)</small></div></div>
            <button className="r" onClick={async () => { if (!confirm("Forget the office Wi-Fi pairing?")) return; await api.forgetLan(); if (getConn()?.cloud) { await reroute(); setTick((n) => n + 1); } else unpaired("Pairing removed."); }}>
              <div style={{ color: "var(--bad)" }}>Forget this pairing</div></button>
          </> : <button className="r" onClick={() => setAdd("office")}><div>Pair on the office Wi-Fi<small>Optional: faster inside the office</small></div><Icon name="chev" size={16} /></button>}
        </div>
        {add === "office" && <Connect embedded start="office" onPaired={done} />}

        <div className="glbl">This phone</div>
        <div className="set">
          <div className="r"><div>Name<small>{c?.device}</small></div></div>
          <div className="r"><div>Studio server<small>{state?.pc || "—"} · farm app v{state?.version || "?"}</small></div></div>
        </div>
        <button className="btn" onClick={async () => { await reroute(); toast(`Using ${getConn()?.lan && (await api.ping(getConn()!.lan!.base).then(() => true).catch(() => false)) ? "the office Wi-Fi" : "the internet"}`); }}>
          <Icon name="refresh" size={16} />Check the connection</button>
      </div>
    </>
  );
}
