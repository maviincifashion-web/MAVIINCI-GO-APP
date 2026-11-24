import { useEffect, useState } from "react";
import { Activity as Act, api } from "../api";
import { Icon } from "../icons";
import { useStore } from "../store";
import { TopBar } from "../ui";
import { ago } from "../util";

const TONE_ICON: Record<string, "render" | "live" | "review" | "alert" | "clock"> = { run: "render", ok: "live", gold: "review", bad: "alert", "": "clock" };

/** Everything that happened on the farm, newest first. */
export default function Activity() {
  const { push, state } = useStore();
  const [acts, setActs] = useState<Act[] | null>(null);
  const [err, setErr] = useState("");
  useEffect(() => { api.activity().then(setActs).catch((e) => setErr(String(e.message || e))); }, [state?.time && Math.floor(state.time / 10000)]);
  const day = (t: number) => { const d = new Date(t); const n = new Date(); return d.toDateString() === n.toDateString() ? "Today" : d.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" }); };
  let last = "";
  return (
    <>
      <TopBar title="Activity" />
      <div className="body">
        {err && <div className="err">{err}</div>}
        {!acts && !err && <div className="empty"><span className="spin" /></div>}
        <div>
          {(acts || []).map((a, i) => {
            const d = day(a.t); const head = d !== last; last = d;
            return (
              <div key={i}>
                {head && <div className="glbl" style={{ margin: "14px 2px 2px" }}>{d}</div>}
                <button className="act" onClick={() => push({ name: "job", id: a.job })}>
                  <span className={`ic ${a.tone}`}><Icon name={TONE_ICON[a.tone] || "clock"} size={17} /></span>
                  <div><b>{a.title}</b><small>{a.text}</small></div><time>{ago(a.t)}</time>
                </button>
              </div>
            );
          })}
        </div>
        {acts && !acts.length && <div className="empty">Nothing has happened yet.</div>}
      </div>
    </>
  );
}
