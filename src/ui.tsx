// Small shared pieces of the screens.
import { useEffect, useState } from "react";
import type { Job } from "./api";
import { img } from "./api";
import { Icon, Logo } from "./icons";
import { useStore } from "./store";
import { STATUS_LABEL, STATUS_TONE, isUpdate, jobPct } from "./util";

export function TopBar({ title, right }: { title?: string; right?: React.ReactNode }) {
  const { stack, pop, state, push, error } = useStore();
  if (stack.length) return (
    <header className="ab">
      <button className="back" onClick={pop}><Icon name="back" size={20} />Back</button>
      <h1>{title}</h1>
      <div style={{ minWidth: 60, display: "flex", justifyContent: "flex-end" }}>{right}</div>
    </header>
  );
  const attention = (state?.jobs || []).filter((j) => j.status === "review" || j.status === "failed").length;
  return (
    <header className="ab">
      <Logo />
      <div className="wm"><img src="./wordmark.svg" alt="MAVIINCI" /><b>FARM</b></div>
      <div className="sp" />
      {error && <span className="pill bad"><i />Offline</span>}
      {right}
      <button className="ib" onClick={() => push({ name: "activity" })} aria-label="Activity"><Icon name="bell" size={19} />{attention ? <em>{attention}</em> : null}</button>
    </header>
  );
}

export function StatusPill({ job }: { job: Job }) {
  const label = job.status === "done" && isUpdate(job) ? "Updated" : job.status === "review" && isUpdate(job) ? "Update" : STATUS_LABEL[job.status];
  return <span className={`pill ${STATUS_TONE[job.status]}`}><i />{label}</span>;
}

export function Bar({ pct, ok }: { pct: number; ok?: boolean }) {
  return <div className={`bar${ok ? " ok" : ""}`}><i style={{ width: `${Math.round(Math.max(0, Math.min(1, pct)) * 100)}%` }} /></div>;
}

export function Ring({ pct, children }: { pct: number; children?: React.ReactNode }) {
  const r = 40, c = 2 * Math.PI * r;
  return (
    <div className="ring">
      <svg viewBox="0 0 92 92"><circle cx="46" cy="46" r={r} fill="none" stroke="#2c2c31" strokeWidth="5" />
        <circle cx="46" cy="46" r={r} fill="none" stroke="#6b93ff" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} transform="rotate(-90 46 46)" style={{ transition: "stroke-dashoffset .6s" }} /></svg>
      {children}
    </div>
  );
}

/** The fabric swatch of a job: its studio material photo when there is one. */
export function swatch(job?: Job | null, w = 160): React.CSSProperties {
  const slug = job?.material?.slug;
  return slug ? { backgroundImage: `url("${img.material(slug, w)}")` } : {};
}

export const pctText = (j: Job) => `${Math.round(jobPct(j) * 100)}%`;

export function Spinner() { return <span className="spin" />; }

const dims = new Map<string, { w: number; h: number }>();
function useSheet(url: string) {
  const [d, setD] = useState(dims.get(url) || null);
  useEffect(() => {
    if (!url) return;
    if (dims.has(url)) { setD(dims.get(url)!); return; }
    const im = new Image();
    im.onload = () => { const v = { w: im.naturalWidth, h: im.naturalHeight }; dims.set(url, v); setD(v); };
    im.src = url;
  }, [url]);
  return d;
}

/** One look cut out of a job's preview sheet: the looks sit side by side, equal width (the bridge already cut the label band). */
export function Look({ job, part, index, count, label, className = "look", style, sheetW = 1400, onClick }: {
  job: string; part: string; index: number; count?: number; label?: string; className?: string; style?: React.CSSProperties; sheetW?: number; onClick?: () => void;
}) {
  const url = img.preview(job, part, sheetW);
  const d = useSheet(url);
  const n = count || (d ? Math.max(1, Math.round(d.w / d.h / 0.5625)) : 1);
  const x = n > 1 ? (Math.min(index, n - 1) / (n - 1)) * 100 : 0;
  const tile: React.CSSProperties = d ? { aspectRatio: `${d.w / n} / ${d.h}` } : { aspectRatio: "9 / 16" };
  return (
    <div className={className} onClick={onClick} style={{ background: "var(--photo)", ...tile, ...style }}>
      {d && <div style={{ position: "absolute", inset: 0, backgroundImage: `url("${url}")`, backgroundSize: `${n * 100}% 100%`, backgroundPosition: `${x}% 0`, backgroundRepeat: "no-repeat" }} />}
      {label && <span>{label}</span>}
    </div>
  );
}

export const lookName = (k: string) => { const s = k.replace(/^fold_/, "Folded · ").replace(/_/g, " "); return s.charAt(0).toUpperCase() + s.slice(1); };
