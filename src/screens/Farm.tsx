import { api } from "../api";
import { Icon } from "../icons";
import { useAction, useStore } from "../store";
import { Bar, TopBar, swatch } from "../ui";
import { ago, eta, jobName, partNameByKey, partPct, short, stageLabel } from "../util";

/** The three PCs: what each renders, GPU load, and switching a PC on or off for jobs. */
export default function Farm() {
  const { state, push } = useStore();
  const { busy, run } = useAction();
  const farm = state?.farm || [];
  const jobs = state?.jobs || [];
  return (
    <>
      <TopBar />
      <div className="body">
        <div><h2>Render farm</h2><div className="sub">Any PC takes any file. Turn a PC off to keep it free for other work.</div></div>
        {farm.map((f) => {
          const job = jobs.find((j) => j.id === f.job);
          const st = job && f.part ? job.partState?.[f.part] : null;
          const g = f.gpuStats;
          const takes = f.workerEnabled && f.state !== "stopped";
          const tone = !f.online ? "" : f.state === "busy" ? "run" : takes ? "ok" : "warn";
          return (
            <div className="fpc" key={f.name}>
              <div className="h">
                <span className={`dot ${tone}`} />
                <div><b>{f.name}</b><small>{short(f.gpu) || "GPU unknown"} · v{f.version || "?"}{f.uploader ? " · upload PC" : ""}</small></div>
                <button className={`toggle${takes ? " on" : ""}`} disabled={!f.online || busy === f.name} aria-label={takes ? "Stop taking jobs" : "Take jobs"}
                  onClick={() => run(f.name, () => api.setWorker(f.name, !takes), takes ? `${f.name} stops after its current file` : `${f.name} takes jobs`)} />
              </div>
              {!f.online ? <div className="sub">Offline · last seen {ago(f.time)}</div> : (
                <>
                  <div className="meters">
                    <div><span>GPU</span><b>{g ? `${g.util}%` : "—"}</b><Bar pct={(g?.util || 0) / 100} /></div>
                    <div><span>VRAM</span><b>{g ? `${(g.memUsed / 1024).toFixed(1)}/${(g.memTotal / 1024).toFixed(0)} GB` : "—"}</b><Bar pct={g ? g.memUsed / g.memTotal : 0} /></div>
                    <div><span>Temp</span><b>{g ? `${g.temp}°` : "—"}</b><Bar pct={g ? g.temp / 95 : 0} /></div>
                  </div>
                  {job ? (
                    <div className="fjob" onClick={() => push({ name: "job", id: job.id })}>
                      <i style={swatch(job, 120)} />
                      <div><b>{jobName(job)}</b><small>{partNameByKey(job, f.part)} · {st?.progress?.total ? `${st.progress.done}/${st.progress.total}` : stageLabel(st?.progress?.stage)}{eta(st) ? ` · ${eta(st)}` : ""}</small>
                        <Bar pct={partPct(st)} /></div>
                      <Icon name="chev" size={16} />
                    </div>
                  ) : <div className="sub">{takes ? "Idle, waiting for work" : "Not taking jobs"}</div>}
                </>
              )}
            </div>
          );
        })}
        {!farm.length && <div className="empty">No PCs have reported yet.</div>}
      </div>
    </>
  );
}
