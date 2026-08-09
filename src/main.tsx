import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App";
import { resolveConvexUrl } from "./lib/convexUrl";
import "./index.css";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = document.getElementById("root")!;

if (!url) {
  root.innerHTML = `
    <div style="min-height:100dvh;display:grid;place-items:center;padding:2rem;
                font-family:Inter,system-ui,sans-serif;color:#fff;text-align:center">
      <div style="max-width:34rem">
        <h1 style="font-size:1.6rem;margin-bottom:.75rem">Convex is not connected</h1>
        <p style="opacity:.7;line-height:1.6">
          Run <code style="background:#1a1145;padding:.15rem .4rem;border-radius:.35rem">npx convex dev</code>
          in this folder once to create a deployment. It writes
          <code style="background:#1a1145;padding:.15rem .4rem;border-radius:.35rem">VITE_CONVEX_URL</code>
          into <code>.env.local</code>, then restart <code>npm run dev</code>.
        </p>
      </div>
    </div>`;
} else {
  const convex = new ConvexReactClient(
    resolveConvexUrl(url, window.location.hostname),
  );
  createRoot(root).render(
    <StrictMode>
      <ConvexProvider client={convex}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ConvexProvider>
    </StrictMode>,
  );
}
