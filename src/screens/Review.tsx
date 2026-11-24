import { useEffect, useState } from "react";
import { api, Job, JobDetail } from "../api";
import { Icon } from "../icons";
import { useAction, useStore } from "../store";
import { Look, TopBar, lookName, swatch } from "../ui";
import { ago, garmentOf, isUpdate, jobName, partName } from "../util";

/** Review inbox: finished renders waiting for someone to publish them (or render again). */
export default function Review() {
  const { state } = useStore();
  const jobs = (state?.jobs || []).filter((j) => j.status === "review").sort((a, b) => Date.parse(a.finishedAt || a.created) - Date.parse(b.finishedAt || b.created));
  return (
    <>
      <TopBar />
      <div className="body">
        <div><h2>Review</h2><div className="sub">{jobs.length ? `${jobs.length} waiting · swipe the photos, then publish or render again` : "Nothing is waiting."}</div></div>
        {jobs.map((j) => <ReviewCard key={j.id} job={j} />)}
        {!jobs.length && <div className="empty">Every finished render is live. New renders that need a look show up here.</div>}
      </div>
    </>
  );
}

function ReviewCard({ job: j }: { job: Job }) {
  const { push } = useStore();
  const [d, setD] = useState<JobDetail | null>(null);
  const { busy, run } = useAction();
  useEffect(() => { api.job(j.id).then(setD).catch(() => {}); }, [j.id, j.finishedAt]);
  const parts = j.parts || [];
  const looks = (d?.previews || []).flatMap((p) => (p.looks.length ? p.looks : [""]).map((l, i) => ({ part: p.part, i, n: p.looks.length || undefined, l: l ? lookName(l) : partName(parts.find((x) => x.key === p.part)) })));
  const res = Object.values(j.results || {});
  const failed = res.some((r) => !r.complete || r.empty.length || r.missing_required.length);
  const photos = res.length;
  const approve = () => confirm(isUpdate(j) ? "Replace the photos of the live outfit with this render? The old photos are kept and can be restored." : `Publish ${jobName(j)} to the website? Customers see it at once.`)
    && run("approve", () => api.approve(j.id), isUpdate(j) ? "Updating the website…" : "Publishing…");

  return (
    <div className="job">
      <div className="jh" onClick={() => push({ name: "job", id: j.id })}>
        <div className="sw" style={swatch(j)} />
        <div className="t"><b>{jobName(j)}</b><small>{garmentOf(j)}{isUpdate(j) ? " · website update" : ""} · {j.outfit?.price ? `₹${j.outfit.price}` : "no price"} · {ago(j.finishedAt || j.created)}</small></div>
        <Icon name="chev" size={18} />
      </div>
      <div className="carousel">
        {looks.map((t) => <Look key={t.part + t.i} job={j.id} part={t.part} index={t.i} count={t.n} label={t.l} className="slide" sheetW={2000} />)}
        {!d && <div className="slide" style={{ aspectRatio: "9 / 16", display: "grid", placeItems: "center" }}><span className="spin" /></div>}
      </div>
      <div className={failed ? "err" : "ok"} style={{ fontSize: 12 }}>{failed ? "A check failed. Open the job to see which photos are missing." : `Every check passed${photos > 1 ? ` across ${photos} files` : ""}.`}</div>
      <div className="actions">
        <button className="btn" disabled={!!busy} onClick={() => run("retry", () => api.retry(j.id), "Back in the queue")}><Icon name="refresh" size={16} />Render again</button>
        <button className="btn gold" disabled={!!busy} onClick={approve}>{busy === "approve" ? <span className="spin" /> : <><Icon name="upload" size={16} />{isUpdate(j) ? "Update website" : "Publish"}</>}</button>
      </div>
    </div>
  );
}
