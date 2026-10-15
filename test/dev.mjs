// Local preview with everything faked: mock GitHub + Google (5602), the worker (5601) and the site (5600).
// Sign in with the dev form as anna@x.com or dieter@x.com (the invite list); anything else is turned away.
// Open http://localhost:5600 and http://127.0.0.1:5600 side by side to be two different people.
import http from "node:http";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { extname, join, normalize } from "node:path";
import { startMock } from "./mock-github.mjs";
import worker from "../worker/worker.js";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const show = f => { try { return execFileSync("git", ["show", `data:${f}`], { cwd: ROOT, encoding: "utf8" }); } catch { return null; } };
const files = Object.fromEntries(["listings.json", "track.json", "meta.json", "settings.json"].map(f => [f, show(f)]).filter(([, c]) => c != null));
await startMock(5602, files);

const env = { REPO: "me/rental-hunt-data", BRANCH: "data", GITHUB_TOKEN: "fake", GITHUB_API: "http://127.0.0.1:5602", ALLOWED_ORIGIN: "",
  GOOGLE_CLIENT_ID: "test-client", GOOGLE_JWKS_URL: "http://127.0.0.1:5602/__jwks", SESSION_SECRET: "dev-secret-0123456789abcdef",
  ALLOWED_EMAILS: "anna@x.com, dieter@x.com" };
http.createServer(async (req, res) => {
  let body = ""; for await (const c of req) body += c;
  const r = await worker.fetch(new Request("http://127.0.0.1:5601" + req.url, { method: req.method, headers: req.headers, body: body || undefined }), env);
  res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer()));
}).listen(5601, "127.0.0.1");

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };
const site = workerUrl => http.createServer(async (req, res) => {
  const p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p === "/config.js") {
    res.writeHead(200, { "Content-Type": TYPES[".js"] });
    return res.end(`window.RENTAL_CONFIG = ${JSON.stringify({ workerUrl, googleClientId: "dev", devTokenUrl: "http://127.0.0.1:5602/__google-token" })};`);
  }
  try {
    const f = normalize(join(ROOT, p === "/" ? "index.html" : p));
    if (!f.startsWith(normalize(ROOT))) throw 0;
    let buf = await readFile(f);
    // local preview talks to the fake worker + fake Google on 127.0.0.1, so widen the page's connect-src for it
    if (f.endsWith("index.html")) buf = Buffer.from(String(buf).replace("connect-src 'self'", "connect-src 'self' http://127.0.0.1:5601 http://127.0.0.1:5602"));
    res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream" }); res.end(buf);
  } catch { res.writeHead(404); res.end("not found"); }
});
site("http://127.0.0.1:5601").listen(5600, "127.0.0.1");
console.log("site http://localhost:5600 (+ http://127.0.0.1:5600 as a second person); dev sign-in as anna@x.com or dieter@x.com");
