// In-memory stand-in for the bits of the GitHub REST API the worker uses (local testing only).
// Files live in memory, every PUT is a "commit", a stale sha gets 409, and every reply is delayed a
// little at random so concurrent saves really interleave.
import http from "node:http";
import { createHash, createSign, generateKeyPairSync } from "node:crypto";

const sha1 = s => createHash("sha1").update(s).digest("hex");
// A stand-in for Google sign-in: our own RSA key, published like Google's, and a token maker.
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const JWK = { ...publicKey.export({ format: "jwk" }), kid: "test-key", alg: "RS256", use: "sig" };
const b64u = v => Buffer.from(typeof v === "string" ? v : JSON.stringify(v)).toString("base64url");
export function googleToken(claims, aud = "test-client") {
  const h = b64u({ alg: "RS256", kid: "test-key", typ: "JWT" });
  const p = b64u({ iss: "https://accounts.google.com", aud, email_verified: true, exp: Math.floor(Date.now() / 1000) + 3600, ...claims });
  return `${h}.${p}.${createSign("RSA-SHA256").update(`${h}.${p}`).sign(privateKey, "base64url")}`;
}

const wait = () => new Promise(r => setTimeout(r, 10 + Math.random() * 60));

export function startMock(port, files) {
  const state = { files: { ...files }, head: sha1("init"), commits: [] };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://x");
    const send = (code, body, type = "application/json", extra = {}) => {
      res.writeHead(code, { "Content-Type": type, "Access-Control-Allow-Origin": "*", ...extra });
      res.end(typeof body === "string" ? body : JSON.stringify(body));
    };
    await wait();
    let m;
    if (req.method === "GET" && (m = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/commits\/[^/]+$/))) {
      const etag = `"${state.head}"`;
      if (req.headers["if-none-match"] === etag) return send(304, "");
      return send(200, state.head, "text/plain", { ETag: etag });
    }
    if ((m = url.pathname.match(/^\/repos\/[^/]+\/[^/]+\/contents\/(.+)$/))) {
      const path = decodeURIComponent(m[1]);
      if (req.method === "GET") {
        const c = state.files[path];
        if (c == null) return send(404, { message: "Not Found" });
        if (/raw/.test(req.headers.accept || "")) return send(200, c, "text/plain");
        if (c.length > 1e6) return send(200, { path, sha: sha1(c), encoding: "none", content: "" }); // like GitHub over 1 MB
        return send(200, { path, sha: sha1(c), encoding: "base64", content: Buffer.from(c).toString("base64") });
      }
      if (req.method === "PUT") {
        let raw = ""; for await (const ch of req) raw += ch;
        const b = JSON.parse(raw);
        const cur = state.files[path];
        if ((cur == null ? undefined : sha1(cur)) !== b.sha) return send(409, { message: `${path} does not match ${b.sha}` });
        state.files[path] = Buffer.from(b.content, "base64").toString("utf8");
        state.head = sha1(state.head + b.message + Date.now() + Math.random());
        state.commits.push({ sha: state.head, message: b.message });
        return send(200, { content: { sha: sha1(state.files[path]) }, commit: { sha: state.head } });
      }
    }
    if (url.pathname === "/__commits") return send(200, state.commits);
    if (url.pathname === "/__jwks") return send(200, { keys: [JWK] });
    if (url.pathname === "/__google-token") { // dev sign-in for test/dev.mjs
      const email = url.searchParams.get("email") || "";
      return send(200, googleToken({ email, given_name: email.split("@")[0].replace(/^./, c => c.toUpperCase()) }), "text/plain");
    }
    send(404, { message: "Not Found" });
  });
  return new Promise(r => server.listen(port, "127.0.0.1", () => r({ server, state })));
}
