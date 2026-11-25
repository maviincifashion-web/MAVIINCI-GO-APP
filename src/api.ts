// Talks to the MAVIINCI FARM desktop app two ways (app/electron/mobile.js and relay.js in the MAVIINCI-GO repo):
//   - anywhere: signed in with an admin panel login, through Firebase (cloud.ts)
//   - office Wi-Fi: straight to the studio server, paired once with a 6-digit code (faster; used whenever it answers)
import * as cloud from "./cloud";

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
export interface Activity { t: number; tone: string; title: string; text: string; job: string }
export interface State { pc: string; version: string; time: number; uploadMode: "auto" | "review"; farm: FarmPC[]; jobs: Job[]; activity?: Activity[] }
export interface StudioMaterial { slug: string; name: string; material: string; version: number; hasSwatch: boolean }
export interface Template { key: string; name: string; recipe: string; active: number }
export interface LibraryFabric { id: string; name: string; brand: string; src: string; colorCode: string }
export interface LiveOutfit { garment: string; id: string; fabric: string; fabricID?: string; fabricImg: string; price: string; created: number; updated: number; madeBy: string; studioJob: string }

// ---- the connection ----
export interface Lan { base: string; token: string; pc: string }
export interface Conn { device: string; lan?: Lan | null; cloud?: { email: string } | null }
const KEY = "farm.conn";
export function getConn(): Conn | null {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || "null");
    if (c && c.base && c.token) return { device: c.device || "My phone", lan: { base: c.base, token: c.token, pc: c.pc } };   // saved by the first version
    return c;
  } catch { return null; }
}
export function setConn(c: Conn | null) { if (c && (c.lan || c.cloud)) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); }
export function patchConn(p: Partial<Conn>) { const c = getConn() || { device: "My phone" }; setConn({ ...c, ...p }); }

export class NotPaired extends Error {}
export { CloudDenied } from "./cloud";

// ---- which way: the office Wi-Fi when it answers, else Firebase ----
export type Route = "lan" | "cloud";
let route: Route | null = null;
export const getRoute = () => route;
async function lanAlive(base: string) {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 1500);
  try { const r = await fetch(base + "/api/ping", { signal: ctl.signal }); return r.ok; } catch { return false; } finally { clearTimeout(t); }
}
/** Chooses the way to the farm: the office Wi-Fi when it answers, else Firebase. */
export async function pickRoute(): Promise<Route | null> {
  const c = getConn();
  if (c?.lan && await lanAlive(c.lan.base)) route = "lan";
  else if (c?.cloud && cloud.currentUser()) route = "cloud";
  else route = c?.lan ? "lan" : null;
  return route;
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  const c = getConn();
  if (!c || !route) throw new NotPaired("Not connected");
  const method = body === undefined ? "GET" : "POST";
  if (route === "cloud") {
    const u = new URL(path, "http://x");
    return cloud.request<T>(method, u.pathname, Object.fromEntries(u.searchParams), body, c.device);
  }
  const lan = c.lan!;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  try {
    const r = await fetch(lan.base + path, {
      method, signal: ctl.signal,
      headers: { Authorization: `Bearer ${lan.token}`, ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = await r.json().catch(() => ({}));
    if (r.status === 401) throw new NotPaired(data.error || "Not paired");
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    return data as T;
  } catch (e) {
    if ((e as Error).name === "AbortError") throw new Error("The farm did not answer on the office Wi-Fi.");
    throw e;
  } finally { clearTimeout(timer); }
}

/** The latest activity that came with the farm snapshot (anywhere mode sends it along, saving a request). */
let snapActivity: Activity[] | null = null;
export const setSnapActivity = (a: Activity[] | null) => { snapActivity = a; };

const trim = (b: string) => b.replace(/\/$/, "");
export const api = {
  async ping(base: string) {
    const r = await fetch(trim(base) + "/api/ping");
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json() as Promise<{ app: string; pc: string; version: string }>;
  },
  async pair(base: string, code: string, device: string) {
    const b = trim(base);
    const r = await fetch(b + "/api/pair", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, device }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
    patchConn({ device, lan: { base: b, token: data.token, pc: data.pc } });
    route = "lan";
    return data;
  },
  async signIn(email: string, password: string, device: string) {
    await cloud.signIn(email, password);
    patchConn({ device, cloud: { email: email.trim().toLowerCase() } });
    await pickRoute();
  },
  async signOut() { await cloud.signOutCloud(); patchConn({ cloud: null }); await pickRoute(); },
  async forgetLan() { patchConn({ lan: null }); await pickRoute(); },
  state: () => call<State>("/api/state"),
  job: (id: string) => call<JobDetail>(`/api/jobs/${encodeURIComponent(id)}`),
  activity: () => (route === "cloud" && snapActivity ? Promise.resolve(snapActivity) : call<Activity[]>("/api/activity")),
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

// ---- photos ----
// Office Wi-Fi: a plain URL (an <img> cannot send headers, so the token rides along as ?t=).
// Anywhere: the studio server puts the photo in Storage and answers with its link; links are cached here and the
// screens redraw when one arrives (onImages).
const cache = new Map<string, { url: string; t: number }>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
export function onImages(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function photo(path: string, query: Record<string, string>) {
  const c = getConn();
  if (!c || !route) return "";
  if (route === "lan") return `${c.lan!.base}${path}?${new URLSearchParams({ ...query, t: c.lan!.token })}`;
  const key = path + "?" + new URLSearchParams(query);
  const hit = cache.get(key);
  if ((!hit || Date.now() - hit.t > 5 * 60_000) && !pending.has(key)) {
    pending.add(key);
    cloud.request<{ url: string }>("GET", path, query, undefined, c.device)
      .then((r) => { cache.set(key, { url: r.url, t: Date.now() }); pending.delete(key); listeners.forEach((f) => f()); })
      .catch(() => { setTimeout(() => pending.delete(key), 30_000); });
  }
  return hit?.url || "";
}
export const img = {
  preview: (job: string, part: string, w = 1400) => photo("/api/img/preview", { job, part, w: String(w) }),
  material: (slug: string, w = 400) => photo("/api/img/material", { slug, w: String(w) }),
};
