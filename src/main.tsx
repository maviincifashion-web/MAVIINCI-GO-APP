import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./theme.css";
import { setConn } from "./api";

// dev only: #pair=<base>|<token>&tab=queue&screen=new opens a screen directly (used for screenshots)
if (import.meta.env.DEV && location.hash.includes("pair=")) {
  const h = new URLSearchParams(location.hash.slice(1));
  const [base, token] = (h.get("pair") || "").split("|");
  setConn({ base, token, pc: "dev", device: "dev" });
  (window as unknown as { __dev: URLSearchParams }).__dev = h;
}

createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
