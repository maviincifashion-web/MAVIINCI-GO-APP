import { useEffect, useMemo, useState } from "react";
import { api, img, Job, LibraryFabric, LiveOutfit, StudioMaterial, Template } from "../api";
import { useStore } from "../store";
import { TopBar } from "../ui";

type Garment = "kurta" | "pajama" | "sadri" | "kurta+pajama";
const GLABEL: Record<string, string> = { kurta: "Kurta", pajama: "Pajama", sadri: "Sadri" };
const PARTS: Record<Garment, [string, string][]> = {
  kurta: [["kurta", "Model layers"], ["kurta_fold", "Folded photos"]],
  pajama: [["pajama", "Pajama layers + style photos"]],
  sadri: [["sadri", "Sadri layers + buttons"], ["sadri_icon", "Button photo"]],
  "kurta+pajama": [["kurta", "Kurta model layers"], ["kurta_fold", "Kurta folded photos"], ["pajama", "Pajama layers + style photos"]],
};

/** A new job from a material that is already in the studio (materials are made in the Lab on a PC).
 *  Picking a fabric whose outfit is already on the website edits that outfit (same rule as the desktop New job). */
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
  const [live, setLive] = useState<LiveOutfit[]>([]);
  const [targets, setTargets] = useState<Record<string, string>>({});   // group -> outfit id to edit ("" = new outfit)

  useEffect(() => {
    api.materials().then(setMats).catch((e) => setErr(String(e.message || e)));
    api.templates().then(setTpls).catch(() => {});
    api.fabrics().then((r) => setLib(r.fabrics || [])).catch(() => {});
    api.outfits().then((r) => setLive(r.outfits || [])).catch(() => {});
  }, []);

  // each website outfit this job makes, and the live outfits of the picked fabric
  const groups: [string, string][] = garment === "kurta+pajama" ? [["kurta", "Kurta"], ["pajama", "Pajama"]] : [["main", GLABEL[garment] || "Kurta"]];
  const matchesOf = (g: string) => !fab ? [] : live
    .filter((o) => o.garment === g && (o.fabricID ? o.fabricID === fab.id : o.fabric.toLowerCase() === fab.name.trim().toLowerCase()))
    .sort((a, b) => b.created - a.created);
  const matchKey = groups.map(([k, g]) => `${k}:${matchesOf(g).map((o) => o.id).join(",")}`).join("|");
  useEffect(() => {
    const t: Record<string, string> = {};
    for (const [k, g] of groups) {
      const m = matchesOf(g)[0];
      t[k] = m ? m.id : "";
      if (m?.price) (k === "pajama" ? setPprice : setPrice)(String(m.price));
    }
    setTargets(t);
  }, [matchKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const target = (k: string) => targets[k] || "";
  const isUpdate = groups.some(([k]) => target(k));
  const byId = (id: string) => live.find((o) => o.id === id);
  const busyFor = (id: string): Job | undefined => (state?.jobs || []).find((j) => j.update?.outfits && Object.values(j.update.outfits).includes(id) && ["queued", "running", "review", "uploading"].includes(j.status));

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
  const hasPajama = garment === "pajama" || garment === "kurta+pajama";
  const needPrice = !target(groups[0][0]) && !price.trim();
  const needPprice = garment === "kurta+pajama" && !target("pajama") && !pprice.trim();
  const ok = !!material && !!name.trim() && !needPrice && !needPprice && !missingTpl.length;
  const shownMats = allMats ? mats : mats.slice(0, 12);

  const create = async () => {
    setBusy(true); setErr("");
    try {
      const a = Object.fromEntries(parts.map(([k]) => [k, assign[k]]).filter(([, v]) => v));
      const j = await api.createJob({
        garment, materialSlug: mat, fabricName: name.trim(), fabricLibraryId: fab?.id, price: price.trim(),
        pajamaPrice: garment === "kurta+pajama" ? pprice.trim() : undefined, discount: discount.trim() || undefined,
        quality, uploadMode: isUpdate ? "review" : mode, assign: Object.keys(a).length ? a : null,
        ...(isUpdate ? { update: Object.fromEntries(groups.map(([k]) => [k, target(k)]).filter(([, id]) => id)) } : {}),
      });
      toast(isUpdate ? `${name.trim()}: re-render queued, waits in Review` : `${name.trim()} is in the queue`);
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
          {([["kurta", "Kurta"], ["pajama", "Pajama"], ["sadri", "Sadri"], ["kurta+pajama", "Kurta + Pajama"]] as [Garment, string][]).map(([k, l]) => (
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
              <button key={f.id} className={fab?.id === f.id ? "on" : ""} onClick={() => {
                setFab(f); setName(f.name); setQ("");
                const m = !mat && mats.find((x) => x.name.trim().toLowerCase() === f.name.trim().toLowerCase());   // the material named after it
                if (m) setMat(m.slug);
              }}>
                <i style={f.src ? { backgroundImage: `url("${f.src}")` } : {}} /><div><b style={{ fontSize: 13 }}>{f.name}</b><small>{[f.brand, f.colorCode].filter(Boolean).join(" · ")}</small></div>
              </button>
            ))}
            {!shownLib.length && <div className="sub" style={{ padding: 10 }}>No fabric matches.</div>}
          </div>
        )}
        {groups.map(([k, g]) => {
          const ms = matchesOf(g); if (!ms.length) return null;
          const cur = byId(target(k)); const bj = cur ? busyFor(cur.id) : undefined;
          return (
            <div key={k} className={`edit${target(k) ? " on" : ""}`}>
              <div className="eh">
                <i style={(cur || ms[0]).fabricImg ? { backgroundImage: `url("${(cur || ms[0]).fabricImg}")` } : {}} />
                <div><b>{target(k) ? `Edits the live ${g.toLowerCase()} outfit` : `Makes a new ${g.toLowerCase()} outfit`}</b>
                  <small>{target(k) ? "New photos replace the live ones after approval in Review. Old photos are kept." : `This fabric already has a ${g.toLowerCase()} outfit on the website.`}</small>
                  {bj && <small style={{ color: "var(--warn)" }}>A re-render of it is already {bj.status === "review" ? "waiting in Review" : bj.status}.</small>}</div>
              </div>
              <select value={target(k)} onChange={(e) => setTargets({ ...targets, [k]: e.target.value })}>
                {ms.map((o) => <option key={o.id} value={o.id}>Edit {o.id} · ₹{o.price || "—"}</option>)}
                <option value="">New outfit instead</option>
              </select>
            </div>
          );
        })}
        <label className="field">Fabric name on the website<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        <div className="g2">
          <label className="field">{garment === "kurta+pajama" ? "Kurta price (₹)" : `${GLABEL[garment]} price (₹)`}{target(groups[0][0]) ? ` · live ₹${byId(target(groups[0][0]))?.price || "—"}` : ""}<input inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
          {garment === "kurta+pajama"
            ? <label className="field">Pajama price (₹){target("pajama") ? ` · live ₹${byId(target("pajama"))?.price || "—"}` : ""}<input inputMode="numeric" value={pprice} onChange={(e) => setPprice(e.target.value.replace(/[^\d.]/g, ""))} /></label>
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
        {isUpdate ? <div className="info">An edit of a live outfit always waits for approval in Review.</div> : (
          <div className="seg">
            <button className={mode === "auto" ? "on" : ""} onClick={() => setMode("auto")}>When checks pass</button>
            <button className={mode === "review" ? "on" : ""} onClick={() => setMode("review")}>After review</button>
          </div>
        )}

        <div className="card">
          <div className="ct">This job makes</div>
          <div className="sub" style={{ color: "var(--ink2)" }}>
            {groups.map(([k, g]) => target(k) ? `New photos for ${target(k)} (${g.toLowerCase()}). ` : `A new ${g.toLowerCase()} outfit and its fabric button. `)}
            {isUpdate || mode === "review" ? "It waits in Review." : "It goes live as soon as every check passes."}
          </div>
        </div>
        {err && <div className="err">{err}</div>}
        <button className="btn gold" disabled={!ok || busy} onClick={create}>{busy ? <span className="spin" /> : isUpdate ? "Re-render and edit" : "Add to queue"}</button>
        {!ok && <div className="sub" style={{ textAlign: "center" }}>{!material ? "Pick a material." : !name.trim() ? "Enter the fabric name." : needPrice ? "Enter the price." : needPprice ? "Enter the pajama price." : ""}</div>}
      </div>
    </>
  );
}
