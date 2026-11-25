// "From anywhere": the farm through Firebase. The studio server (MAVIINCI3) keeps studioFarm/state up to date and answers
// requests written to studioFarmCmds (app/electron/relay.js in MAVIINCI-GO). Only the admin panel's own logins get in
// (the chabi() rule in the website's Firestore rules).
import { initializeApp } from "firebase/app";
import { browserLocalPersistence, indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { collection, doc, initializeFirestore, onSnapshot, setDoc } from "firebase/firestore";
import config from "./firebase.config.json";

const app = initializeApp(config, "farm");
export const auth = initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence] });
const db = initializeFirestore(app, { experimentalAutoDetectLongPolling: true });

export class CloudDenied extends Error {}

export function currentUser(): User | null { return auth.currentUser; }
export function onUser(cb: (u: User | null) => void) { return onAuthStateChanged(auth, cb); }

export async function signIn(email: string, password: string) {
  try { return (await signInWithEmailAndPassword(auth, email.trim(), password)).user; }
  catch (e) {
    const code = (e as { code?: string }).code || "";
    if (/invalid-credential|wrong-password|user-not-found|invalid-email/.test(code)) throw new Error("Wrong email or password.");
    if (/too-many-requests/.test(code)) throw new Error("Too many tries. Wait a few minutes.");
    if (/network/.test(code)) throw new Error("No internet connection.");
    throw new Error(String((e as Error).message || e));
  }
}
export const signOutCloud = () => signOut(auth);

const denied = (e: unknown) => /permission/i.test(String((e as { code?: string }).code || (e as Error).message || ""));
const DENIED = "This login cannot use the farm. Sign in with your admin panel login.";

/** Live farm snapshot. */
export function subscribeState(cb: (state: unknown, time: number) => void, fail: (e: Error) => void) {
  return onSnapshot(doc(db, "studioFarm", "state"), (d) => {
    const v = d.data();
    if (!v) { fail(new Error("The farm has not sent anything yet. Is the app open on MAVIINCI3?")); return; }
    try { cb(JSON.parse(v.data), Number(v.time || 0)); } catch (e) { fail(e as Error); }
  }, (e) => fail(denied(e) ? new CloudDenied(DENIED) : new Error(String(e.message || e))));
}

/** Tell the studio server a phone is looking, so it sends updates every few seconds instead of once a minute. */
export async function watch(device: string) {
  try { await setDoc(doc(db, "studioFarm", "watch"), { until: Date.now() + 90_000, by: device.slice(0, 40) }); } catch { /* next time */ }
}

/** One request to the farm (the same paths as the office Wi-Fi bridge); the studio server answers within seconds. */
export async function request<T>(method: "GET" | "POST", path: string, query: Record<string, string> = {}, body?: unknown, device = "phone"): Promise<T> {
  const u = auth.currentUser;
  if (!u) throw new CloudDenied("Signed out");
  const ref = doc(collection(db, "studioFarmCmds"));
  try {
    await setDoc(ref, { uid: u.uid, device: device.slice(0, 40), method, path, query, body: body === undefined ? null : JSON.stringify(body), status: "new", created: Date.now() });
  } catch (e) { throw denied(e) ? new CloudDenied(DENIED) : e; }
  return new Promise<T>((resolve, reject) => {
    let stop = () => {};
    const timer = setTimeout(() => { stop(); reject(new Error("The farm did not answer. Is MAVIINCI3 on with the app open?")); }, 30_000);
    stop = onSnapshot(ref, (d) => {
      const v = d.data();
      if (!v || v.status === "new" || v.status === "running") return;
      clearTimeout(timer); stop();
      let r: { error?: string } = {};
      try { r = JSON.parse(v.result || "{}"); } catch { /* empty */ }
      if (v.status === "done") resolve(r as T); else reject(new Error(r.error || `Error ${v.code}`));
    }, (e) => { clearTimeout(timer); reject(denied(e) ? new CloudDenied(DENIED) : e); });
  });
}
