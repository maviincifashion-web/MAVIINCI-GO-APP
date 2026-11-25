import { useState } from "react";
import { api } from "../api";
import { Icon, Logo } from "../icons";

const LAST = "farm.lastBase";
type Way = "anywhere" | "office";

/** First run: sign in with an admin panel login (works anywhere), or pair on the office Wi-Fi with the 6-digit code. */
export default function Connect({ onPaired, why, start = "anywhere", embedded }: { onPaired: () => void; why?: string; start?: Way; embedded?: boolean }) {
  const [way, setWay] = useState<Way>(start);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
  const name = () => { const d = device.trim() || "My phone"; localStorage.setItem("farm.device", d); return d; };
  const check = async () => {
    setErr(""); setFound("");
    try { const r = await api.ping(norm(base)); setFound(`${r.app} on ${r.pc} · v${r.version}`); }
    catch { setErr("No farm at this address. Check the address and that the phone is on the office Wi-Fi."); }
  };
  const go = async () => {
    setBusy(true); setErr("");
    try {
      if (way === "anywhere") await api.signIn(email, password, name());
      else {
        const b = norm(base); localStorage.setItem(LAST, b);
        await api.pair(b, code.trim(), name());
      }
      onPaired();
    } catch (e) {
      const m = String((e as Error).message || e);
      setErr(way === "office" && /fetch|network/i.test(m) ? "Could not reach the farm. Check the address and the Wi-Fi." : m);
    } finally { setBusy(false); }
  };
  const ready = way === "anywhere" ? /\S+@\S+/.test(email) && password.length > 0 : code.length === 6;

  return (
    <div className={embedded ? "" : "app"}>
      <div className={embedded ? "rows" : "connect"}>
        {!embedded && <>
          <Logo />
          <div>
            <img src="./wordmark.svg" alt="MAVIINCI" style={{ height: 15, display: "block" }} />
            <b style={{ fontSize: 11, letterSpacing: ".34em", color: "var(--gold)" }}>FARM</b>
          </div>
          <h2 style={{ marginTop: 6 }}>Connect to the farm</h2>
          {why && <div className="err">{why}</div>}
        </>}
        <div className="seg">
          <button className={way === "anywhere" ? "on" : ""} onClick={() => { setWay("anywhere"); setErr(""); }}>Anywhere</button>
          <button className={way === "office" ? "on" : ""} onClick={() => { setWay("office"); setErr(""); }}>Office Wi-Fi</button>
        </div>
        {way === "anywhere" ? <>
          <p className="sub" style={{ margin: 0 }}>Sign in with your <b style={{ color: "var(--ink2)" }}>admin panel login</b>. Works on mobile data too, as long as the studio server is on.</p>
          <label className="field">Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} inputMode="email" autoCapitalize="off" autoCorrect="off" autoComplete="username" />
          </label>
          <label className="field">Password
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" onKeyDown={(e) => e.key === "Enter" && ready && go()} />
          </label>
        </> : <>
          <p className="sub" style={{ margin: 0 }}>Faster inside the office. On the studio server open <b style={{ color: "var(--ink2)" }}>Settings → Phone app</b> for the address and the 6-digit code.</p>
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
        </>}
        <label className="field">Name of this phone
          <input value={device} onChange={(e) => setDevice(e.target.value)} />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn gold" disabled={busy || !ready} onClick={go}>{busy ? <span className="spin" /> : way === "anywhere" ? "Sign in" : "Pair this phone"}</button>
      </div>
    </div>
  );
}
