// Shared helpers, same rules as the desktop app (app/renderer/src/jobs.ts in MAVIINCI-GO).
import type { FarmPC, Job, JobPart, PartState, StudioMaterial, LiveOutfit, Template } from "./api";

const PART_NAME: Record<string, string> = { display: "Model layers", style: "Folded photos" };
const KEY_NAME: Record<string, string> = { pajama: "Pajama layers + style photos" };
export const partName = (p?: Pick<JobPart, "role" | "key"> | null) => (p ? KEY_NAME[p.key] || PART_NAME[p.role] || p.key : "");
export const partNameByKey = (job: Job | undefined, key?: string | null) =>
  partName(job?.parts?.find((p) => p.key === key) || (key ? { key, role: key.endsWith("_fold") ? "style" : "display" } : null));

const STAGE: Record<string, string> = {
  queued: "Queued", starting: "Starting", render: "Rendering", layers: "Building layers", checked: "Checking",
  "copying template": "Syncing template", upload: "Uploading", "ready for review": "Ready for review",
  "needs attention": "Needs attention", "waiting for upload PC": "Waiting for the upload PC", done: "Done", failed: "Failed", cancelled: "Cancelled", "upload failed": "Upload failed",
};
export const stageLabel = (s?: string) => (s ? STAGE[s] || s : "");

export const STATUS_LABEL: Record<Job["status"], string> = {
  queued: "Queued", running: "Rendering", review: "Review", uploading: "Uploading", done: "Live", failed: "Failed", cancelled: "Cancelled",
};
export const STATUS_TONE: Record<Job["status"], string> = {
  queued: "", running: "run", review: "warn", uploading: "run", done: "ok", failed: "bad", cancelled: "",
};

export function partPct(st?: PartState | null) {
  if (!st) return 0;
  if (st.status === "done") return 1;
  if (st.status !== "running") return 0;
  const p = st.progress;
  if (!p) return 0.01;
  if (p.stage === "render" && p.total) return 0.02 + 0.93 * ((p.done || 0) / p.total);
  if (p.stage === "layers") return 0.97;
  return 0.01;
}
export function jobPct(j: Job) {
  if (["done", "review"].includes(j.status)) return 1;
  if (j.partState && j.parts?.length) return j.parts.reduce((a, p) => a + partPct(j.partState![p.key]), 0) / j.parts.length;
  const p = j.progress;
  if (!p) return 0;
  return p.stage === "render" && p.total ? (p.done || 0) / p.total : p.stage === "layers" ? 0.97 : 0;
}
export const jobWorkers = (j: Job) => (j.workers && j.workers.length ? j.workers : j.worker ? j.worker.split(" + ") : []);
export function pinNote(pc: string | null | undefined, farm: FarmPC[]) {
  if (!pc) return null;
  const f = farm.find((x) => x.name === pc);
  if (!f || !f.online) return `${pc} is offline`;
  if (!f.workerEnabled || f.state === "stopped") return `${pc} is not taking jobs`;
  return null;
}

export const jobName = (j: Job) => j.outfit?.fabricName || j.material?.name || j.id;
export const garmentOf = (j: Job) => {
  const keys = (j.parts || []).map((p) => p.key);
  const kurta = keys.some((k) => k.startsWith("kurta")) || (!keys.length && j.template?.startsWith("kurta"));
  const pajama = keys.includes("pajama") || j.template === "pajama";
  return kurta && pajama ? "Kurta + Pajama" : pajama ? "Pajama" : "Kurta";
};
export const isUpdate = (j: Job) => !!j.update?.outfits && Object.keys(j.update.outfits).length > 0;

export function ago(t: number | string | undefined) {
  if (!t) return "";
  const ms = Date.now() - (typeof t === "string" ? Date.parse(t) : t);
  const m = Math.round(ms / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  return `${Math.round(h / 24)} d ago`;
}
export const clock = (t: number) => new Date(t).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
export const short = (gpu: string) => (gpu || "").replace(/^NVIDIA (GeForce )?/, "");

/** Remaining time of a running part from its render speed so far. */
export function eta(st?: PartState | null) {
  const p = st?.progress;
  if (!st?.startedAt || !p || p.stage !== "render" || !p.total || !p.done) return "";
  const spent = (Date.now() - Date.parse(st.startedAt)) / 1000;
  const left = (spent / p.done) * (p.total - p.done);
  if (!isFinite(left) || left <= 0) return "";
  return left < 90 ? "about 1 min left" : left < 3600 ? `${Math.round(left / 60)} min left` : `${(left / 3600).toFixed(1)} h left`;
}

// ---- website re-render (same rules as the desktop Website page) ----
export const TEMPLATE: Record<string, string> = { Kurta: "kurta", Pajama: "pajama" };
export function materialFor(mats: StudioMaterial[], jobs: Job[]) {
  const by = new Map<string, StudioMaterial>();
  for (const m of mats) by.set(m.name.trim().toLowerCase(), m);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  return (o: LiveOutfit): string | undefined => {
    const m = by.get(o.fabric.toLowerCase());
    if (m) return `Material ready · v${m.version}`;
    const j = o.studioJob ? byId.get(o.studioJob) : undefined;
    if (j && j.material && j.material.type !== "keep") return "Same material as its FARM render";
    return undefined;
  };
}
export function busyOutfits(jobs: Job[]) {
  const ids = new Map<string, Job>();
  for (const j of jobs) if (j.update?.outfits && ["queued", "running", "review", "uploading"].includes(j.status))
    for (const id of Object.values(j.update.outfits)) ids.set(id, j);
  return ids;
}
export const hasTemplate = (templates: Template[], o: LiveOutfit) => templates.some((t) => t.key === TEMPLATE[o.garment]);
