import { useEffect, useState } from "react";
import { api, JobDetail } from "../api";
import { Icon } from "../icons";
import { useAction, useStore } from "../store";
import { Bar, Look, StatusPill, TopBar, lookName, swatch } from "../ui";
import { ago, eta, garmentOf, isUpdate, jobName, jobWorkers, partName, partPct, stageLabel } from "../util";

/** One job: its looks, every file and PC, the checks, and the actions (publish, retry, restore, cancel). */
export default function JobScreen({ id }: { id: string }) {
  const { state, pop } = useStore();
  const [d, setD] = useState<JobDetail | null>(null);
  const [err, setErr] = useState("");
  const [zoom, setZoom] = useState<{ part: string; i: number; n?: number; l: string } | null>(null);
  const { busy, run } = useAction();
  const live = state?.jobs.find((j) => j.id === id);
  const sig = live ? `${live.status}|${JSON.stringify(live.partState || {})}|${live.finishedAt || ""}` : "";
  useEffect(() => { api.job(id).then(setD).catch((e) => setErr(String(e.message || e))); }, [id, sig]);

  if (!d) return <><TopBar title="Job" /><div className="body">{err ? <div className="err">{err}</div> : <div className="empty"><span className="spin" /></div>}</div></>;
  const j = live ? { ...d, ...live } : d;
  const parts = j.parts || [];
  const results = Object.entries(j.results || {});
  const looks = d.previews.flatMap((p) => (p.looks.length ? p.looks : [""]).map((l, i) => ({ part: p.part, i, n: p.looks.length || undefined, l: l ? lookName(l) : partName(parts.find((x) => x.key === p.part)) })));
  const outfits = j.upload?.outfits || (j.upload?.outfitId ? [{ garment: garmentOf(j), outfitId: j.upload.outfitId }] : []);
  const doApprove = () => confirm(isUpdate(j) ? `Replace the photos of the live outfit with this render? The old photos are kept and can be restored.` : `Publish ${jobName(j)} to the website? Customers see it at once.`)
    && run("approve", () => api.approve(j.id), isUpdate(j) ? "Updating the website…" : "Publishing…");

  return (
    <>
      <TopBar title={jobName(j)} />
      <div className="body">
        <div className="jh">
          <div className="sw" style={{ ...swatch(j, 200), width: 54, height: 54, borderRadius: 14 }} />
          <div className="t"><b style={{ fontSize: 17 }}>{jobName(j)}</b><small>{garmentOf(j)} · {j.quality} · {j.outfit?.price ? `₹${j.outfit.price}` : "no price"}{j.outfit?.pajamaPrice ? ` + ₹${j.outfit.pajamaPrice}` : ""}</small>
            <small>{j.createdBy} · {ago(j.created)}{jobWorkers(j).length ? ` · ${jobWorkers(j).join(" + ")}` : ""}</small></div>
          <StatusPill job={j} />
        </div>
        {isUpdate(j) && <div className="info">Website update: this render replaces the photos of {Object.values(j.update!.outfits).join(", ")}. The old photos are kept.{j.restored ? ` Restored ${ago(j.restored)}.` : ""}</div>}
        {j.error && <div className="err">{j.error}</div>}

        {looks.length > 0 && (
          <div className="carousel">
            {looks.map((t) => <Look key={t.part + t.i} job={j.id} part={t.part} index={t.i} count={t.n} label={t.l} className="slide" sheetW={2400} onClick={() => setZoom(t)} />)}
          </div>
        )}

        {j.status === "review" && (
          <div className="actions">
            <button className="btn" disabled={!!busy} onClick={() => run("retry", () => api.retry(j.id), "Back in the queue")}><Icon name="refresh" size={16} />Render again</button>
            <button className="btn gold" disabled={!!busy} onClick={doApprove}>{busy === "approve" ? <span className="spin" /> : <><Icon name="upload" size={16} />{isUpdate(j) ? "Update website" : "Publish"}</>}</button>
          </div>
        )}
        {j.status === "failed" && (
          <div className="actions">
            <button className="btn" disabled={!!busy} onClick={() => run("retry", () => api.retry(j.id), "Back in the queue")}>Retry all</button>
            <button className="btn gold" disabled={!!busy} onClick={() => run("retryf", () => api.retry(j.id, true), "Failed files back in the queue")}>Retry failed files</button>
          </div>
        )}

        <div className="card">
          <div className="ct">Files and PCs</div>
          <div className="rows">
            {parts.map((p) => {
              const r = j.results?.[p.key];
              // older jobs keep no state per file: a finished job's files are done
              const st = j.partState?.[p.key] || (["done", "review", "uploading"].includes(j.status) || r ? { status: "done" as const, worker: r?.worker } : undefined);
              return (
                <div className="lane" key={p.key}>
                  <div className="t"><b>{partName(p)}</b><span>{st?.status === "running" ? `${st.worker} · ${st.progress?.total ? `${st.progress.done}/${st.progress.total}` : stageLabel(st.progress?.stage)}` : st?.status || "queued"}{st?.status === "done" && (st.worker || r?.worker) ? ` · ${st.worker || r?.worker}` : ""}</span></div>
                  <Bar pct={partPct(st)} ok={st?.status === "done"} />
                  {st?.status === "running" && eta(st) && <div className="sub" style={{ fontSize: 11 }}>{eta(st)}</div>}
                  {r?.render_seconds ? <div className="sub" style={{ fontSize: 11 }}>rendered in {Math.round(r.render_seconds / 60)} min</div> : null}
                  {st?.error && <div className="sub" style={{ color: "#ffb4ad", fontSize: 11 }}>{st.error.slice(0, 160)}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {results.length > 0 && (
          <div className="card">
            <div className="ct">Checks</div>
            {results.map(([k, r]) => {
              const pn = partName(parts.find((x) => x.key === k) || { key: k, role: "display" });
              const bad = !r.complete || r.empty.length > 0 || r.missing_required.length > 0;
              return (
                <div key={k}>
                  <div className={`ck${bad ? " bad" : ""}`}><i>{bad ? "!" : "✓"}</i>{pn}<em>{bad ? `${r.empty.length} empty · ${r.missing_required.length} missing` : "every photo present"}</em></div>
                  {r.stitch && <div className="ck"><i>✓</i>Thread colour<em><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: r.stitch, verticalAlign: -1, marginRight: 5 }} />{r.stitch}</em></div>}
                  {r.buttons && <div className={`ck${r.buttons.complete === false ? " bad" : ""}`}><i>{r.buttons.complete === false ? "!" : "✓"}</i>Fabric button<em>{r.buttons.written} photos{r.buttons.icon ? " + icon" : ""}</em></div>}
                </div>
              );
            })}
          </div>
        )}

        {outfits.length > 0 && (
          <div className="card">
            <div className="ct"><Icon name="live" size={16} />On the website</div>
            {outfits.map((o) => <div className="ck" key={o.outfitId}><i>✓</i>{o.garment}<em>{o.outfitId}</em></div>)}
            {isUpdate(j) && j.status === "done" && !j.restored && (
              <button className="btn" style={{ marginTop: 10, width: "100%" }} disabled={!!busy}
                onClick={() => confirm("Put the old photos back on the website?") && run("restore", () => api.restore(j.id), "Old photos restored")}>Restore old photos</button>
            )}
          </div>
        )}

        {["queued", "running"].includes(j.status) && (
          <button className="btn danger" disabled={!!busy} onClick={() => confirm(`Cancel ${jobName(j)}?`) && run("cancel", async () => { await api.cancel(j.id); pop(); }, "Job cancelled")}>Cancel job</button>
        )}
        {["done", "cancelled"].includes(j.status) && (
          <button className="btn" disabled={!!busy} onClick={() => run("retry", () => api.retry(j.id), isUpdate(j) || j.status === "done" ? "Re-render queued (waits for approval)" : "Back in the queue")}>Render again</button>
        )}

        <div className="card">
          <div className="ct">Log</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--muted)", display: "flex", flexDirection: "column", gap: 3, maxHeight: 220, overflowY: "auto", userSelect: "text" }}>
            {d.log.slice().reverse().map((l, i) => { const s = l.indexOf(" "); return <div key={i}><span style={{ color: "var(--faint)" }}>{new Date(l.slice(0, s)).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span> {l.slice(s + 1)}</div>; })}
          </div>
        </div>
      </div>
      {zoom && (
        <div className="zoom" onClick={() => setZoom(null)}>
          <Look job={j.id} part={zoom.part} index={zoom.i} count={zoom.n} className="zoom-img" sheetW={3600} />
          <div className="sub" style={{ textAlign: "center", marginTop: 10 }}>{zoom.l} · tap to close</div>
        </div>
      )}
    </>
  );
}
