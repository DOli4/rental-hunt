// Local preview with everything faked: mock GitHub (5602), the worker (5601), the site (5600) and a
// read-only copy of the site that has no worker (5603). Passcode is "test-pass".
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

const env = { REPO: "me/rental-hunt", BRANCH: "data", PASSCODE: "test-pass", GITHUB_TOKEN: "fake", GITHUB_API: "http://127.0.0.1:5602", ALLOWED_ORIGIN: "" };
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
    return res.end(`window.RENTAL_CONFIG = ${JSON.stringify({ workerUrl, rawBase: "http://127.0.0.1:5602/raw/" })};`);
  }
  try {
    const f = normalize(join(ROOT, p === "/" ? "index.html" : p));
    if (!f.startsWith(normalize(ROOT))) throw 0;
    const buf = await readFile(f);
    res.writeHead(200, { "Content-Type": TYPES[extname(f)] || "application/octet-stream" }); res.end(buf);
  } catch { res.writeHead(404); res.end("not found"); }
});
site("http://127.0.0.1:5601").listen(5600, "127.0.0.1");
site("").listen(5603, "127.0.0.1");
console.log("site http://localhost:5600 (+ http://127.0.0.1:5600 as a second person), read-only http://localhost:5603");
