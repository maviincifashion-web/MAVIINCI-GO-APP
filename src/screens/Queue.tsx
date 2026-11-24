import { useState } from "react";
import type { FarmPC, Job } from "../api";
import { api } from "../api";
import { Icon } from "../icons";
import { useAction, useStore } from "../store";
import { Bar, StatusPill, TopBar, pctText, swatch } from "../ui";
import { ago, eta, garmentOf, isUpdate, jobName, jobPct, partName, partPct, pinNote, stageLabel } from "../util";

type Filter = "active" | "review" | "done" | "failed";

/** The job queue: render order, which PC renders which file, and moving work between PCs. */
export default function Queue() {
  const { state, push } = useStore();
  const [f, setF] = useState<Filter>("active");
  const jobs = state?.jobs || [];
  const farm = state?.farm || [];
  const byOrder = (a: Job, b: Job) => (a.priority ?? 0) - (b.priority ?? 0) || Date.parse(a.created) - Date.parse(b.created);
  const groups: Record<Filter, Job[]> = {
    active: jobs.filter((j) => ["running", "uploading", "queued"].includes(j.status)).sort((a, b) => (a.status === "queued" ? 1 : 0) - (b.status === "queued" ? 1 : 0) || byOrder(a, b)),
    review: jobs.filter((j) => j.status === "review"),
    done: jobs.filter((j) => j.status === "done").sort((a, b) => Date.parse(b.finishedAt || b.created) - Date.parse(a.finishedAt || a.created)).slice(0, 40),
    failed: jobs.filter((j) => j.status === "failed" || j.status === "cancelled").slice(0, 40),
  };
  const queuedIds = groups.active.filter((j) => j.status === "queued").map((j) => j.id);

  return (
    <>
      <TopBar />
      <div className="body pad-fab">
        <h2>Queue</h2>
        <div className="seg">
          {([["active", "Active"], ["review", "Review"], ["done", "Live"], ["failed", "Failed"]] as [Filter, string][]).map(([k, l]) => (
            <button key={k} className={f === k ? "on" : ""} onClick={() => setF(k)}>{l}<em>{groups[k].length}</em></button>
          ))}
        </div>
        {groups[f].map((j) => <JobCard key={j.id} job={j} farm={farm} queued={queuedIds} onOpen={() => push({ name: "job", id: j.id })} />)}
        {!groups[f].length && <div className="empty">{f === "active" ? "Nothing is rendering or waiting. Start a new job." : "Nothing here."}</div>}
      </div>
      <button className="fab" onClick={() => push({ name: "new" })}><Icon name="plus" size={19} />New job</button>
    </>
  );
}

export function JobCard({ job: j, farm, queued, onOpen }: { job: Job; farm: FarmPC[]; queued: string[]; onOpen: () => void }) {
  const { busy, run } = useAction();
  const online = farm.filter((p) => p.online).map((p) => p.name);
  const parts = j.parts || [];
  const qi = queued.indexOf(j.id);
  const active = ["queued", "running"].includes(j.status);
  return (
    <div className="job">
      <div className="jh" onClick={onOpen}>
        <div className="sw" style={swatch(j)} />
        <div className="t"><b>{jobName(j)}</b><small>{garmentOf(j)}{isUpdate(j) ? " · website update" : ""} · {j.quality} · {ago(j.created)}</small></div>
        <StatusPill job={j} />
      </div>
      {j.status === "running" || j.status === "queued" ? parts.map((p) => {
        const st = j.partState?.[p.key];
        const pin = p.worker || null;
        const note = pinNote(pin, farm);
        const prog = st?.progress;
        return (
          <div className="lane" key={p.key}>
            <div className="t"><b>{partName(p)}</b>
              <span>{st?.status === "running" ? `${st.worker} · ${prog?.total ? `${prog.done}/${prog.total}` : stageLabel(prog?.stage)}` : st?.status === "done" ? `done · ${st.worker || ""}` : st?.status === "failed" ? "failed" : pin ? `waiting for ${pin}` : "any PC"}</span></div>
            <Bar pct={partPct(st)} ok={st?.status === "done"} />
            {st?.status === "running" && eta(st) && <div className="sub" style={{ fontSize: 11 }}>{eta(st)}</div>}
            {(!st || st.status === "queued") && (
              <select value={pin || ""} disabled={busy === p.key} onChange={(e) => run(p.key, () => api.assign(j.id, p.key, e.target.value || null), e.target.value ? `${partName(p)} goes to ${e.target.value}` : `${partName(p)}: any PC`)}>
                <option value="">Any PC</option>
                {farm.map((pc) => <option key={pc.name} value={pc.name}>{pc.name}{online.includes(pc.name) ? "" : " (offline)"}</option>)}
              </select>
            )}
            {note && <div className="sub" style={{ color: "var(--warn)", fontSize: 11 }}>{note}</div>}
          </div>
        );
      }) : j.status === "uploading" ? <Bar pct={jobPct(j)} /> : null}
      {!parts.length && j.status === "running" && <Bar pct={jobPct(j)} />}
      {active && (
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span className="pct">{j.status === "running" ? pctText(j) : qi >= 0 ? `#${qi + 1} in line` : ""}</span>
          <span style={{ flex: 1 }} />
          {j.status === "queued" && <>
            <button className="btn sm" disabled={qi <= 0 || !!busy} onClick={() => run("up", () => api.move(j.id, "up"))} aria-label="Move up"><Icon name="up" size={16} /></button>
            <button className="btn sm" disabled={qi === queued.length - 1 || !!busy} onClick={() => run("down", () => api.move(j.id, "down"))} aria-label="Move down"><Icon name="down" size={16} /></button>
          </>}
          <button className="btn sm danger" disabled={!!busy} onClick={() => confirm(`Cancel ${jobName(j)}?`) && run("cancel", () => api.cancel(j.id), "Job cancelled")}>Cancel</button>
        </div>
      )}
      {j.status === "failed" && j.error && <div className="sub" style={{ color: "#ffb4ad" }}>{j.error.slice(0, 160)}</div>}
    </div>
  );
}
