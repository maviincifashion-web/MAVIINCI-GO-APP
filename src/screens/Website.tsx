import { useEffect, useMemo, useState } from "react";
import { api, LiveOutfit, StudioMaterial, Template } from "../api";
import { useStore } from "../store";
import { TopBar } from "../ui";
import { ago, busyOutfits, hasTemplate, materialFor } from "../util";

/** Outfits live on the website, and re-rendering them with the current templates (old photos kept, approval needed). */
export default function Website() {
  const { state, toast, refresh, setTab } = useStore();
  const [data, setData] = useState<{ outfits: LiveOutfit[]; time: number } | null>(null);
  const [mats, setMats] = useState<StudioMaterial[]>([]);
  const [tpls, setTpls] = useState<Template[]>([]);
  const [err, setErr] = useState("");
  const [garment, setGarment] = useState("all");
  const [onlyReady, setOnlyReady] = useState(false);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [quality, setQuality] = useState("final");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.outfits().then(setData).catch((e) => setErr(String(e.message || e)));
    api.materials().then(setMats).catch(() => {});
    api.templates().then(setTpls).catch(() => {});
  }, []);

  const jobs = state?.jobs || [];
  const matFor = useMemo(() => materialFor(mats, jobs), [mats, jobs]);
  const busyIds = useMemo(() => busyOutfits(jobs), [jobs]);
  const all = data?.outfits || [];
  const garments = [...new Set(all.map((o) => o.garment))];
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const canDo = (o: LiveOutfit) => !!matFor(o) && hasTemplate(tpls, o);
  const ready = (o: LiveOutfit) => canDo(o) && !busyIds.has(o.id);
  const shown = all.filter((o) => (garment === "all" || o.garment === garment) && words.every((w) => `${o.fabric} ${o.id}`.toLowerCase().includes(w)) && (!onlyReady || canDo(o)));
  const toggle = (o: LiveOutfit) => { if (!ready(o)) return; const s = new Set(sel); if (s.has(o.id)) s.delete(o.id); else s.add(o.id); setSel(s); };

  const go = async () => {
    setBusy(true);
    try {
      const r = await api.rerender([...sel], quality);
      toast(`${r.queued.length} re-render${r.queued.length === 1 ? "" : "s"} queued. Each waits in Review before the website changes.`);
      setSel(new Set()); await refresh(); setTab("queue");
    } catch (e) { toast(String((e as Error).message || e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <TopBar title="Website outfits" />
      <div className="body" style={{ paddingBottom: sel.size ? 170 : 24 }}>
        <div className="sub">{data ? `${all.length} outfits live${data.time ? ` · list from ${ago(data.time)}` : ""} · ${shown.filter(ready).length} of ${shown.length} can be re-rendered` : "Loading…"}</div>
        {err && <div className="err">{err}</div>}
        <input placeholder="Search fabric or outfit" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="chips">
          {["all", ...garments].map((g) => <button key={g} className={`chip${garment === g ? " on" : ""}`} onClick={() => setGarment(g)}>{g === "all" ? "All" : g}</button>)}
          <button className={`chip${onlyReady ? " on" : ""}`} onClick={() => setOnlyReady(!onlyReady)}><span className="dot ok" />Material ready</button>
        </div>
        <div className="oc">
          {shown.map((o) => {
            const m = matFor(o); const job = busyIds.get(o.id); const on = sel.has(o.id);
            return (
              <button key={o.id} className={`ocard${on ? " on" : ""}`} onClick={() => toggle(o)} style={{ opacity: ready(o) || job ? 1 : 0.55 }}>
                <i style={o.fabricImg ? { backgroundImage: `url("${o.fabricImg}")` } : {}}>{on && <span className="pill ok" style={{ position: "absolute", top: 6, right: 6 }}><i />Selected</span>}</i>
                <div><b>{o.fabric || o.id}</b><small>{o.garment} · {o.price ? `₹${o.price}` : "—"}{o.madeBy === "farm" ? " · FARM" : ""}</small>
                  <div className={`st${m && !job ? " ok" : ""}`}>{job ? `Re-render ${job.status === "review" ? "waiting for review" : job.status}` : m ? m : !hasTemplate(tpls, o) ? "No template yet" : "No material yet"}</div></div>
              </button>
            );
          })}
        </div>
        {data && !shown.length && <div className="empty">No outfit matches.</div>}
      </div>
      {sel.size > 0 && (
        <div className="sheet">
          <div style={{ display: "flex", alignItems: "center" }}><b>{sel.size} outfit{sel.size === 1 ? "" : "s"} selected</b><span style={{ flex: 1 }} /><button className="btn sm" onClick={() => setSel(new Set())}>Clear</button></div>
          <div className="seg">{[["final", "Final"], ["preview", "Preview"]].map(([k, l]) => <button key={k} className={quality === k ? "on" : ""} onClick={() => setQuality(k)}>{l}</button>)}</div>
          <div className="sub">New photos replace the live ones only after approval in Review. The old photos are kept and can be restored.</div>
          <button className="btn gold" disabled={busy} onClick={go}>{busy ? <span className="spin" /> : `Re-render ${sel.size}`}</button>
        </div>
      )}
    </>
  );
}
