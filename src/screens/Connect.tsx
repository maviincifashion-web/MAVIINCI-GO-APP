import { useState } from "react";
import { api } from "../api";
import { Icon, Logo } from "../icons";

const LAST = "farm.lastBase";

/** First run: pair this phone with the farm (address of the studio server + the 6-digit code from its Settings). */
export default function Connect({ onPaired }: { onPaired: () => void }) {
  const [base, setBase] = useState(() => localStorage.getItem(LAST) || "http://192.168.1.11:7861");
  const [code, setCode] = useState("");
  const [device, setDevice] = useState(() => localStorage.getItem("farm.device") || "My phone");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [found, setFound] = useState("");

  const norm = (b: string) => {
    let s = b.trim().replace(/\/$/, "");
    if (!/^https?:\/\//.test(s)) s = "http://" + s;
    if (!/:\d+$/.test(s)) s += ":7861";
    return s;
  };
  const check = async () => {
    setErr(""); setFound("");
    try { const r = await api.ping(norm(base)); setFound(`${r.app} on ${r.pc} · v${r.version}`); }
    catch { setErr("No farm at this address. Check the address and that the phone is on the office Wi-Fi."); }
  };
  const pair = async () => {
    setBusy(true); setErr("");
    try {
      const b = norm(base);
      localStorage.setItem(LAST, b); localStorage.setItem("farm.device", device.trim() || "My phone");
      await api.pair(b, code.trim(), device.trim() || "My phone");
      onPaired();
    } catch (e) {
      const m = String((e as Error).message || e);
      setErr(/fetch|network/i.test(m) ? "Could not reach the farm. Check the address and the Wi-Fi." : m);
    } finally { setBusy(false); }
  };

  return (
    <div className="app">
      <div className="connect">
        <Logo />
        <div>
          <img src="./wordmark.svg" alt="MAVIINCI" style={{ height: 15, display: "block" }} />
          <b style={{ fontSize: 11, letterSpacing: ".34em", color: "var(--gold)" }}>FARM</b>
        </div>
        <h2 style={{ marginTop: 6 }}>Connect to the farm</h2>
        <p className="sub" style={{ margin: 0 }}>On the studio server open <b style={{ color: "var(--ink2)" }}>Settings → Phone app</b>. It shows the address and a 6-digit code. Each phone pairs once.</p>
        <label className="field">Farm address
          <div style={{ display: "flex", gap: 8 }}>
            <input value={base} onChange={(e) => setBase(e.target.value)} inputMode="url" autoCapitalize="off" autoCorrect="off" />
            <button className="btn sm" onClick={check} style={{ flex: "none" }}><Icon name="wifi" size={16} />Test</button>
          </div>
        </label>
        {found && <div className="ok">{found}</div>}
        <label className="field">Pairing code
          <input value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="000000"
            style={{ fontFamily: "var(--mono)", fontSize: 24, letterSpacing: ".4em", textAlign: "center" }} />
        </label>
        <label className="field">Name of this phone
          <input value={device} onChange={(e) => setDevice(e.target.value)} />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn gold" disabled={busy || code.length !== 6} onClick={pair}>{busy ? <span className="spin" /> : "Pair this phone"}</button>
      </div>
    </div>
  );
}
