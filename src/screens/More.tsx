import { useEffect, useState } from "react";
import { api, getConn, StudioMaterial, Template } from "../api";
import { Icon } from "../icons";
import { useStore } from "../store";
import { TopBar } from "../ui";

/** More: website outfits, materials and templates at a glance, and the phone's settings. */
export default function More() {
  const { push, state } = useStore();
  const [mats, setMats] = useState<StudioMaterial[]>([]);
  const [tpls, setTpls] = useState<Template[]>([]);
  useEffect(() => { api.materials().then(setMats).catch(() => {}); api.templates().then(setTpls).catch(() => {}); }, []);
  const c = getConn();
  const live = (state?.jobs || []).filter((j) => j.status === "done").length;
  return (
    <>
      <TopBar />
      <div className="body">
        <h2>More</h2>
        <div className="set">
          <button className="r" onClick={() => push({ name: "website" })}><Icon name="live" /><div>Website outfits<small>Re-render live outfits with the current lighting</small></div><Icon name="chev" size={16} /></button>
          <button className="r" onClick={() => push({ name: "activity" })}><Icon name="clock" /><div>Activity<small>Everything that happened on the farm</small></div><Icon name="chev" size={16} /></button>
        </div>
        <div className="glbl">Studio</div>
        <div className="set">
          <div className="r"><Icon name="render" /><div>Materials<small>Made in the Lab on a PC</small></div><em>{mats.length}</em></div>
          <div className="r"><Icon name="farm" /><div>Templates<small>{tpls.map((t) => `${t.name} v${t.active}`).join(" · ") || "—"}</small></div><em>{tpls.length}</em></div>
          <div className="r"><Icon name="upload" /><div>Publishing<small>{state?.uploadMode === "auto" ? "Automatic when every check passes" : "Every job waits for review"} · change it on a PC</small></div></div>
          <div className="r"><Icon name="check" /><div>Jobs published by the farm</div><em>{live}</em></div>
        </div>
        <div className="glbl">This phone</div>
        <div className="set">
          <button className="r" onClick={() => push({ name: "settings" })}><Icon name="wifi" /><div>Connection<small>{c ? `${c.pc} · ${c.base.replace(/^https?:\/\//, "")}` : "Not paired"}</small></div><Icon name="chev" size={16} /></button>
        </div>
        <div className="sub" style={{ textAlign: "center", marginTop: 8 }}>MAVIINCI FARM mobile · farm app v{state?.version || "?"}</div>
      </div>
    </>
  );
}
