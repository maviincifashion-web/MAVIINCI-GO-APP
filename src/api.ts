// Talks to the phone bridge of the MAVIINCI FARM desktop app (app/electron/mobile.js in the MAVIINCI-GO repo).
// The connection (address + device token) is kept on the phone after pairing once.

export type Status = "queued" | "running" | "review" | "uploading" | "done" | "failed" | "cancelled";
export interface Progress { stage: string; done?: number; total?: number; detail?: string }
export interface PartState { status: "queued" | "running" | "done" | "failed" | "cancelled"; worker?: string | null; startedAt?: string; progress?: Progress | null; error?: string | null }
export interface JobPart { key: string; role: "display" | "style"; recipe: string; worker?: string | null; group?: string }
export interface PartResult { complete: boolean; empty: string[]; missing_required: string[]; render_seconds?: number; worker?: string; stitch?: string | null; buttons?: { complete?: boolean; written: number; icon: boolean } }
export interface Material { type: string; slug?: string; name?: string }
export interface Job {
  id: string; created: string; createdBy: string; template: string; templateVersion: number; recipe: string; quality: string;
  status: Status; material?: Material; uploadMode: "auto" | "review";
  outfit?: { fabricName?: string; price?: string; pajamaPrice?: string; fabricLibraryId?: string; colorCode?: string };
  parts?: JobPart[]; partState?: Record<string, PartState>; results?: Record<string, PartResult>;
  worker?: string | null; workers?: string[] | null; startedAt?: string; finishedAt?: string; error?: string | null;
  progress?: Progress; priority?: number; awaitingUpload?: boolean;
  update?: { outfits: Record<string, string> } | null; published?: Record<string, { outfitId: string; updated?: boolean }> | null;
  upload?: { outfitId: string; outfits?: { garment: string; outfitId: string }[] } | null; restored?: string | null;
}
export interface JobDetail extends Job { log: string[]; previews: { part: string; role: string; looks: string[] }[] }
export interface FarmPC {
  name: string; state: string; workerEnabled: boolean; job: string | null; part?: string | null; progress: Progress | null;
  gpu: string; gpuStats?: { util: number; memUsed: number; memTotal: number; temp: number } | null; uploader?: boolean;
  version: string; time: number; online: boolean;
}
export interface State { pc: string; version: string; time: number; uploadMode: "auto" | "review"; farm: FarmPC[]; jobs: Job[] }
export interface Activity { t: number; tone: string; title: string; text: string; job: string }
export interface StudioMaterial { slug: string; name: string; material: string; version: number; hasSwatch: boolean }
export interface Template { key: string; name: string; recipe: string; active: number }
export interface LibraryFabric { id: string; name: string; brand: string; src: string; colorCode: string }
export interface LiveOutfit { garment: string; id: string; fabric: string; fabricImg: string; price: string; created: number; updated: number; madeBy: string; studioJob: string }

export interface Conn { base: string; token: string; pc: string; device: string }
const KEY = "farm.conn";
export function getConn(): Conn | null { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; } }
export function setConn(c: Conn | null) { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); }

export class NotPaired extends Error {}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const c = getConn();
  if (!c) throw new NotPaired("Not paired");
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(c.base + path, {
      method: body === undefined ? "GET" : "POST", signal: ctl.signal,
      headers: { Authorization: `Bearer ${c.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) throw new NotPaired(data.error || "Not paired");
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The farm did not answer. Is the phone on the office Wi-Fi?");
    throw e;
  } finally { clearTimeout(timer); }
}

export const api = {
  async ping(base: string) {
    const r = await fetch(base.replace(/\/$/, "") + "/api/ping");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<{ app: string; pc: string; version: string }>;
  },
  async pair(base: string, code: string, device: string) {
    const b = base.replace(/\/$/, "");
    const r = await fetch(b + "/api/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, device }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    setConn({ base: b, token: data.token, pc: data.pc, device });
    return data;
  },
  state: () => call<State>("/api/state"),
  job: (id: string) => call<JobDetail>(`/api/jobs/${encodeURIComponent(id)}`),
  activity: () => call<Activity[]>("/api/activity"),
  materials: () => call<StudioMaterial[]>("/api/materials"),
  templates: () => call<Template[]>("/api/templates"),
  fabrics: () => call<{ fabrics: LibraryFabric[] }>("/api/fabrics"),
  outfits: () => call<{ outfits: LiveOutfit[]; time: number }>("/api/outfits"),
  retry: (id: string, onlyFailed = false) => call(`/api/jobs/${encodeURIComponent(id)}/retry`, { onlyFailed }),
  cancel: (id: string) => call(`/api/jobs/${encodeURIComponent(id)}/cancel`, {}),
  approve: (id: string) => call(`/api/jobs/${encodeURIComponent(id)}/approve`, {}),
  restore: (id: string) => call(`/api/jobs/${encodeURIComponent(id)}/restore`, {}),
  move: (id: string, dir: "up" | "down") => call(`/api/jobs/${encodeURIComponent(id)}/move`, { dir }),
  assign: (id: string, key: string | null, pc: string | null) => call(`/api/jobs/${encodeURIComponent(id)}/assign`, { key, pc }),
  createJob: (spec: Record<string, unknown>) => call<Job>("/api/jobs", spec),
  rerender: (ids: string[], quality: string) => call<{ queued: string[] }>("/api/outfits/rerender", { ids, quality }),
  setWorker: (pc: string, enabled: boolean) => call(`/api/workers/${encodeURIComponent(pc)}`, { enabled }),
};

/** Image URLs (an <img> cannot send headers, so the token rides along as ?t=). */
export const img = {
  preview: (job: string, part: string, w = 1400) => { const c = getConn(); return c ? `${c.base}/api/img/preview?job=${encodeURIComponent(job)}&part=${encodeURIComponent(part)}&w=${w}&t=${c.token}` : ""; },
  material: (slug: string, w = 400) => { const c = getConn(); return c ? `${c.base}/api/img/material?slug=${encodeURIComponent(slug)}&w=${w}&t=${c.token}` : ""; },
};
