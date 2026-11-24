import { useEffect, useState } from "react";
import { Activity as Act, api } from "../api";
import { Icon } from "../icons";
import { useStore } from "../store";
import { Look, Ring, StatusPill, TopBar, swatch } from "../ui";
import { ago, clock, eta, jobName, partNameByKey, partPct, short, stageLabel } from "../util";

const TONE_ICON: Record<string, "render" | "live" | "review" | "alert" | "clock"> = { run: "render", ok: "live", gold: "review", bad: "alert", "": "clock" };

/** Overview: what every PC is doing, today's numbers, the latest finished look and recent activity. */
export default function Home() {
  const { state, push, error, lastOk, setTab } = useStore();
  const [acts, setActs] = useState<Act[]>([]);
  useEffect(() => { api.activity().then(setActs).catch(() => {}); }, [state?.time && Math.floor(state.time / 15000)]);

  const jobs = state?.jobs || [];
  const farm = state?.farm || [];
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const liveToday = jobs.filter((j) => j.status === "done" && j.finishedAt && Date.parse(j.finishedAt) >= today.getTime()).length;
  const running = jobs.filter((j) => j.status === "running" || j.status === "uploading").length;
  const queued = jobs.filter((j) => j.status === "queued").length;
  const review = jobs.filter((j) => j.status === "review").length;
  const latest = jobs.filter((j) => j.status === "done" || j.status === "review").sort((a, b) => Date.parse(b.finishedAt || b.created) - Date.parse(a.finishedAt || a.created))[0];
  const hour = new Date().getHours();

  return (
    <>
      <TopBar />
      <div className="body pad-fab">
        <div>
          <h2>{hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening"}</h2>
          <div className="sub">{farm.filter((f) => f.online).length} of {farm.length || 3} PCs online · publishing {state?.uploadMode === "auto" ? "automatic" : "after review"}{lastOk ? ` · ${clock(lastOk)}` : ""}</div>
        </div>
        {error && <div className="err">{error}</div>}
        <div className="kpis">
          <div className="kpi"><span>Live today</span><b>{liveToday}</b></div>
          <div className="kpi"><span>Rendering</span><b>{running}</b></div>
          <div className="kpi"><span>Queued</span><b>{queued}</b></div>
          <div className="kpi"><span>Review</span><b style={{ color: review ? "var(--gold-ink)" : undefined }}>{review}</b></div>
        </div>

        <div className="ct" style={{ margin: "4px 0 -4px" }}>Render farm<small onClick={() => setTab("farm")} style={{ color: "var(--gold-ink)" }}>{farm.filter((f) => f.state === "busy").length} rendering</small></div>
        <div className="hscroll">
          {farm.map((f) => {
            const job = jobs.find((j) => j.id === f.job);
            const st = job && f.part ? job.partState?.[f.part] : null;
            const pct = st ? partPct(st) : 0;
            const tag = !f.online ? ["", "Offline"] : f.state === "busy" ? ["run", "Rendering"] : !f.workerEnabled || f.state === "stopped" ? ["paused", "Paused"] : ["idle", "Idle"];
            return (
              <div className="pc" key={f.name} onClick={() => job && push({ name: "job", id: job.id })}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><b>{f.name}</b><span className={`tag ${tag[0]}`}>{tag[1]}</span></div>
                <Ring pct={pct}><div className="s" style={swatch(job)}>{!job && <Icon name="power" size={18} />}</div></Ring>
                {job ? <div><small style={{ color: "var(--ink)", fontWeight: 600 }}>{jobName(job)}</small>
                  <small>{partNameByKey(job, f.part)} · {Math.round(pct * 100)}%</small><small>{eta(st) || stageLabel(st?.progress?.stage)}</small></div>
                  : <div><small>{short(f.gpu) || "—"}</small><small>{f.online ? (f.gpuStats ? `${f.gpuStats.temp}° · ${f.gpuStats.util}%` : "waiting for work") : `seen ${ago(f.time)}`}</small></div>}
              </div>
            );
          })}
          {!farm.length && <div className="empty" style={{ width: "100%" }}>No PCs have reported yet.</div>}
        </div>

        {latest && (
          <div className="card" onClick={() => push({ name: "job", id: latest.id })}>
            <div className="ct">Latest look<small>{jobName(latest)} · <StatusPill job={latest} /></small></div>
            <LatestLooks id={latest.id} />
          </div>
        )}

        <div className="card">
          <div className="ct">Activity<small onClick={() => push({ name: "activity" })} style={{ color: "var(--gold-ink)" }}>See all</small></div>
          {acts.slice(0, 5).map((a, i) => (
            <button className="act" key={i} onClick={() => push({ name: "job", id: a.job })}>
              <span className={`ic ${a.tone}`}><Icon name={TONE_ICON[a.tone] || "clock"} size={17} /></span>
              <div><b>{a.title}</b><small>{a.text}</small></div><time>{ago(a.t)}</time>
            </button>
          ))}
          {!acts.length && <div className="sub">Nothing yet today.</div>}
        </div>
      </div>
      <button className="fab" onClick={() => push({ name: "new" })}><Icon name="plus" size={19} />New job</button>
    </>
  );
}

function LatestLooks({ id }: { id: string }) {
  const [pv, setPv] = useState<{ part: string; looks: string[] }[]>([]);
  useEffect(() => { api.job(id).then((d) => setPv(d.previews)).catch(() => {}); }, [id]);
  const tiles = pv.flatMap((p) => (p.looks.length ? p.looks : [""]).map((l, i) => ({ part: p.part, i, n: p.looks.length || undefined, l })));
  return (
    <div className="looks">
      {tiles.map((t) => <Look key={t.part + t.i} job={id} part={t.part} index={t.i} count={t.n} label={t.l ? t.l.replace(/_/g, " ") : undefined} sheetW={1600} />)}
      {!tiles.length && <div className="sub">No preview yet.</div>}
    </div>
  );
}
