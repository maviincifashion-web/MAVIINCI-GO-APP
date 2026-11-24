import { useEffect, useMemo, useState } from "react";
import { api, img, LibraryFabric, StudioMaterial, Template } from "../api";
import { useStore } from "../store";
import { TopBar } from "../ui";

type Garment = "kurta" | "pajama" | "kurta+pajama";
const PARTS: Record<Garment, [string, string][]> = {
  kurta: [["kurta", "Model layers"], ["kurta_fold", "Folded photos"]],
  pajama: [["pajama", "Pajama layers + style photos"]],
  "kurta+pajama": [["kurta", "Kurta model layers"], ["kurta_fold", "Kurta folded photos"], ["pajama", "Pajama layers + style photos"]],
};

/** A new job from a material that is already in the studio (materials are made in the Lab on a PC). */
export default function NewJob() {
  const { state, pop, push, toast, refresh } = useStore();
  const [mats, setMats] = useState<StudioMaterial[]>([]);
  const [tpls, setTpls] = useState<Template[]>([]);
  const [lib, setLib] = useState<LibraryFabric[]>([]);
  const [garment, setGarment] = useState<Garment>("kurta");
  const [mat, setMat] = useState("");
  const [fab, setFab] = useState<LibraryFabric | null>(null);
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [pprice, setPprice] = useState("");
  const [discount, setDiscount] = useState("");
  const [quality, setQuality] = useState("final");
  const [mode, setMode] = useState<"auto" | "review">(state?.uploadMode || "auto");
  const [assign, setAssign] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [allMats, setAllMats] = useState(false);

  useEffect(() => {
    api.materials().then(setMats).catch((e) => setErr(String(e.message || e)));
    api.templates().then(setTpls).catch(() => {});
    api.fabrics().then((r) => setLib(r.fabrics || [])).catch(() => {});
  }, []);

  const material = mats.find((m) => m.slug === mat);
  const pickMat = (m: StudioMaterial) => {
    setMat(m.slug);
    if (!name || mats.some((x) => x.name === name)) setName(m.name);
    const hit = lib.find((f) => f.name.trim().toLowerCase() === m.name.trim().toLowerCase());
    if (hit && !fab) setFab(hit);
  };
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shownLib = useMemo(() => lib.filter((f) => words.every((w) => `${f.name} ${f.brand} ${f.colorCode}`.toLowerCase().includes(w))).slice(0, 60), [lib, q]);
  const missingTpl = (garment === "kurta+pajama" ? ["kurta", "pajama"] : [garment]).filter((k) => tpls.length && !tpls.some((t) => t.key === k));
  const farm = state?.farm || [];
  const parts = PARTS[garment];
  const hasPajama = garment !== "kurta";
  const ok = !!material && !!name.trim() && !!price.trim() && (garment !== "kurta+pajama" || !!pprice.trim()) && !missingTpl.length;
  const shownMats = allMats ? mats : mats.slice(0, 12);

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const a = Object.fromEntries(parts.map(([k]) => [k, assign[k]]).filter(([, v]) => v));
      const j = await api.createJob({
        garment, materialSlug: mat, fabricName: name.trim(), fabricLibraryId: fab?.id, price: price.trim(),
        pajamaPrice: garment === "kurta+pajama" ? pprice.trim() : undefined, discount: discount.trim() || undefined,
        quality, uploadMode: mode, assign: Object.keys(a).length ? a : null,
      });
      toast(`${name.trim()} is in the queue`);
      await refresh();
      pop(); push({ name: "job", id: j.id });
    } catch (e) { setErr(String((e as Error).message || e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <TopBar title="New job" />
      <div className="body">
        <div className="glbl">Garment</div>
        <div className="gm">
          {([["kurta", "Kurta"], ["pajama", "Pajama"], ["kurta+pajama", "Kurta + Pajama"]] as [Garment, string][]).map(([k, l]) => (
            <button key={k} className={garment === k ? "on" : ""} onClick={() => setGarment(k)}>{l}</button>
          ))}
        </div>
        {missingTpl.length > 0 && <div className="err">No {missingTpl.join(" or ")} template in the studio yet.</div>}

        <div className="glbl">Material <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500 }}>· made in the Lab on a PC</span></div>
        <div className="mats">
          {shownMats.map((m) => (
            <button key={m.slug} className={`mat${mat === m.slug ? " on" : ""}`} onClick={() => pickMat(m)}>
              <i style={m.hasSwatch ? { backgroundImage: `url("${img.material(m.slug, 240)}")` } : {}} /><span>{m.name}</span>
            </button>
          ))}
        </div>
        {mats.length > 12 && !allMats && <button className="btn sm" onClick={() => setAllMats(true)}>Show all {mats.length} materials</button>}
        {!mats.length && !err && <div className="empty">No materials in the studio yet. Make one in the Lab on a PC.</div>}

        <div className="glbl">Outfit</div>
        <label className="field">Fabric from the admin panel
          <input placeholder={lib.length ? `Search ${lib.length} fabrics` : "Fabric library not loaded"} value={q} onChange={(e) => setQ(e.target.value)} />
        </label>
        {fab && <div className="chip" style={{ alignSelf: "flex-start" }}><span className="dot ok" />{fab.name}{fab.colorCode ? ` · ${fab.colorCode}` : ""}<button style={{ background: "none", border: 0, color: "var(--muted)", padding: 0, marginLeft: 4 }} onClick={() => setFab(null)}>✕</button></div>}
        {q && (
          <div className="list">
            {shownLib.map((f) => (
              <button key={f.id} className={fab?.id === f.id ? "on" : ""} onClick={() => { setFab(f); setName(f.name); setQ(""); }}>
                <i style={f.src ? { backgroundImage: `url("${f.src}")` } : {}} /><div><b style={{ fontSize: 13 }}>{f.name}</b><small>{[f.brand, f.colorCode].filter(Boolean).join(" · ")}</small></div>
              </button>
            ))}
            {!shownLib.length && <div className="sub" style={{ padding: 10 }}>No fabric matches.</div>}
          </div>
        )}
        <label className="field">Fabric name on the website<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="g2">
          <label className="field">{garment === "pajama" ? "Price (₹)" : "Kurta price (₹)"}<input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          {garment === "kurta+pajama"
            ? <label className="field">Pajama price (₹)<input inputMode="numeric" value={pprice} onChange={(e) => setPprice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
            : <label className="field">Discount (%)<input inputMode="numeric" value={discount} onChange={(e) => setDiscount(e.target.value.replace(/[^\d.]/g, ""))} /></label>}
        </div>

        <div className="glbl">Render</div>
        <div className="seg">
          {[["final", "Final"], ["preview", "Preview"], ["quick", "Quick"]].map(([k, l]) => <button key={k} className={quality === k ? "on" : ""} onClick={() => setQuality(k)}>{l}</button>)}
        </div>
        <div className="rows">
          {parts.map(([k, l]) => (
            <div className="lane" key={k}>
              <div className="t"><b>{l}</b><span>{assign[k] || "any free PC"}</span></div>
              <select value={assign[k] || ""} onChange={(e) => setAssign({ ...assign, [k]: e.target.value })}>
                <option value="">Any free PC</option>
                {farm.map((pc) => <option key={pc.name} value={pc.name}>{pc.name}{pc.online ? "" : " (offline)"}</option>)}
              </select>
            </div>
          ))}
        </div>
        {hasPajama && quality === "final" && <div className="info">A pajama at Final quality renders 110 photos and takes a few hours.</div>}

        <div className="glbl">Publishing</div>
        <div className="seg">
          <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>When checks pass</button>
          <button className={mode === "review" ? "on" : ""} onClick={() => setMode("review")}>After review</button>
        </div>

        <div className="card">
          <div className="ct">This job makes</div>
          <div className="sub" style={{ color: "var(--ink2)" }}>
            {garment === "kurta" && "1 kurta outfit (model layers + folded photos) and its fabric button."}
            {garment === "pajama" && "1 pajama outfit (96 model layers + 14 style photos) and its fabric button."}
            {garment === "kurta+pajama" && "2 outfits: a kurta and a pajama in the same fabric, each with its own button."}
            {" "}{mode === "auto" ? "It goes live as soon as every check passes." : "It waits in Review."}
          </div>
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn gold" disabled={!ok || busy} onClick={create}>{busy ? <span className="spin" /> : "Add to queue"}</button>
        {!ok && <div className="sub" style={{ textAlign: "center" }}>{!material ? "Pick a material." : !name.trim() ? "Enter the fabric name." : !price.trim() ? "Enter the price." : garment === "kurta+pajama" && !pprice.trim() ? "Enter the pajama price." : ""}</div>}
      </div>
    </>
  );
}
