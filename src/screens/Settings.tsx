import { getConn } from "../api";
import { Icon } from "../icons";
import { useStore } from "../store";
import { TopBar } from "../ui";
import { clock } from "../util";

/** The phone's connection to the farm. */
export default function SettingsScreen() {
  const { state, error, lastOk, unpaired, refresh } = useStore();
  const c = getConn();
  return (
    <>
      <TopBar title="Connection" />
      <div className="body">
        <div className={`conn${error ? " off" : ""}`}>
          <span className="big"><Icon name="wifi" size={22} /></span>
          <div style={{ flex: 1 }}><b>{error ? "Cannot reach the farm" : `Connected to ${state?.pc || c?.pc}`}</b>
            <small>{error || (lastOk ? `Last update ${clock(lastOk)} · every 3 s while open` : "Connecting…")}</small></div>
        </div>
        <div className="set">
          <div className="r"><div>Farm address<small>{c?.base}</small></div></div>
          <div className="r"><div>Studio server<small>{state?.pc || c?.pc} · app v{state?.version || "?"}</small></div></div>
          <div className="r"><div>This phone<small>{c?.device}</small></div></div>
        </div>
        <button className="btn" onClick={refresh}><Icon name="refresh" size={16} />Check now</button>
        <div className="info">The phone works on the office Wi-Fi. To remove this phone, use Settings → Phone app on the studio server, or disconnect here.</div>
        <button className="btn danger" onClick={() => confirm("Disconnect this phone? You need a new code to pair again.") && unpaired()}>Disconnect this phone</button>
      </div>
    </>
  );
}
