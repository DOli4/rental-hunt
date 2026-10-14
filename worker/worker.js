// Rental Hunt save helper: a Cloudflare Worker that reads the data branch and commits people's changes.
// Secrets: GITHUB_TOKEN, PASSCODE.  Vars: REPO ("owner/rental-hunt"), BRANCH ("data"), ALLOWED_ORIGIN
// (comma-separated; http://localhost:* and http://127.0.0.1:* are always allowed for testing).
// GITHUB_API is optional and only used by the local test to point at a mock.

const ID_RE = /^[A-Za-z0-9._~-]+$/;
const STATUSES = ["new", "interested", "contacted", "viewing", "applied", "no"];
const FIELDS = ["status", "phone", "email", "viewing", "note"];
const MAX_TEXT = 2000;
const FILES = ["listings.json", "track.json", "meta.json", "settings.json"];

// Per-isolate memo of the last snapshot. ponytail: in-memory only, a cold isolate refetches (5 GitHub calls).
let memo = null; // { sha, etag, checkedAt, body }

export default {
  async fetch(req, env) {
    const cors = corsHeaders(req, env);
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    const { pathname, searchParams } = new URL(req.url);
    try {
      if (req.method === "GET" && pathname === "/data") return await getData(env, cors, searchParams.get("v"));
      if (req.method === "POST" && pathname === "/op") return await postOp(req, env, cors);
      return json({ error: "not found" }, 404, cors);
    } catch (e) {
      if (!e.status || e.status >= 500) console.error("worker error", pathname, e.status, e.message); // never the body or token
      return json({ error: e.expose || "something went wrong" }, e.status || 500, cors);
    }
  },
};

/* ---------- HTTP helpers ---------- */
function corsHeaders(req, env) {
  const origin = req.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGIN || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "null",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Passcode, X-Name",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}
function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), { status, headers: { ...cors, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });
}
function fail(status, msg) { const e = new Error(msg); e.status = status; e.expose = msg; return e; }

/* ---------- GitHub Contents API ---------- */
function gh(env, path, init = {}) {
  const base = (env.GITHUB_API || "https://api.github.com").replace(/\/$/, "");
  return fetch(`${base}/repos/${env.REPO}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      "User-Agent": "rental-hunt-worker",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
}
async function readRaw(env, file, ref) {
  const r = await gh(env, `/contents/${file}?ref=${encodeURIComponent(ref)}`, { headers: { Accept: "application/vnd.github.raw+json" } });
  if (r.status === 404) return null;
  if (!r.ok) throw fail(502, `GitHub said ${r.status} reading ${file}`);
  return r.json();
}
// track.json with its blob sha (needed to write it back). ponytail: object media type caps at 1 MB, plenty for marks + notes.
async function readTrack(env) {
  const r = await gh(env, `/contents/track.json?ref=${encodeURIComponent(env.BRANCH)}`, { headers: { Accept: "application/vnd.github.object+json" } });
  if (r.status === 404) return { track: {}, sha: undefined };
  if (!r.ok) throw fail(502, `GitHub said ${r.status} reading track.json`);
  const j = await r.json();
  // Over 1 MB GitHub sends no content; reading that as {} would wipe everyone's marks on the next save.
  if (j.encoding !== "base64") throw fail(507, "track.json is too big to edit safely");
  return { track: JSON.parse(b64decode(j.content || "") || "{}"), sha: j.sha };
}
async function writeTrack(env, track, sha, message) {
  const body = { message, branch: env.BRANCH, content: b64encode(JSON.stringify(track, null, 1) + "\n") };
  if (sha) body.sha = sha;
  return gh(env, "/contents/track.json", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}
function b64decode(s) {
  const bin = atob(s.replace(/\s/g, ""));
  return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0)));
}
function b64encode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

/* ---------- GET /data ---------- */
// One cheap call per poll: ask for the branch head with If-None-Match (a 304 doesn't count against the
// rate limit). Only when the head moved do we read the four files, pinned to that commit so they match.
async function snapshot(env) {
  if (memo && Date.now() - memo.checkedAt < 5000) return memo;
  const r = await gh(env, `/commits/${encodeURIComponent(env.BRANCH)}`, {
    headers: { Accept: "application/vnd.github.sha", ...(memo?.etag ? { "If-None-Match": memo.etag } : {}) },
  });
  if (r.status === 304 && memo) { memo.checkedAt = Date.now(); return memo; }
  if (!r.ok) throw fail(502, `GitHub said ${r.status} reading the ${env.BRANCH} branch`);
  const sha = (await r.text()).trim();
  if (memo?.sha === sha) { memo.checkedAt = Date.now(); memo.etag = r.headers.get("ETag"); return memo; }
  const [listings, track, meta, settings] = await Promise.all(FILES.map(f => readRaw(env, f, sha)));
  memo = { sha, etag: r.headers.get("ETag"), checkedAt: Date.now(), body: { listings: listings || { listings: [] }, track: track || {}, meta: meta || {}, settings: settings || {}, sha } };
  return memo;
}
async function getData(env, cors, since) {
  const s = await snapshot(env);
  return json(since && since === s.sha ? { same: true, sha: s.sha } : s.body, 200, cors);
}

/* ---------- POST /op ---------- */
async function sameSecret(a, b) {
  // Hash both so the compare is fixed-length, then compare every byte (no early exit).
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([a, b].map(v => crypto.subtle.digest("SHA-256", enc.encode(String(v)))));
  const p = new Uint8Array(x), q = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < p.length; i++) diff |= p[i] ^ q[i];
  return diff === 0;
}
const header = (req, k) => { try { return decodeURIComponent(req.headers.get(k) || ""); } catch { return ""; } };
const cleanName = s => String(s || "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, 40) || "Someone";
function str(v, what) {
  if (typeof v !== "string") throw fail(400, `${what} must be text`);
  if (v.length > MAX_TEXT) throw fail(400, `${what} is too long (max ${MAX_TEXT} characters)`);
  return v;
}

// One function per op. Each changes the copied entry t in place and returns the commit-message summary.
function noteText(v, empty) {
  const text = str(v, "note").trim();
  if (!text) throw fail(400, empty);
  return text;
}
const OPS = {
  set(t, { fields: f }) {
    if (!f || typeof f !== "object" || Array.isArray(f)) throw fail(400, "fields missing");
    const keys = Object.keys(f);
    if (!keys.length || keys.some(k => !FIELDS.includes(k))) throw fail(400, `only ${FIELDS.join(", ")} can be set`);
    if ("status" in f && !STATUSES.includes(f.status)) throw fail(400, "unknown status");
    for (const k of keys) t[k] = str(f[k], k).trim();
    return keys.length === 1 && keys[0] === "status" ? `marked {id} ${f.status}` : `updated ${keys.join(", ")} on {place}`;
  },
  "note.add"(t, { text, nid }, name, now) {
    text = noteText(text, "a note can't be empty");
    // The page sends its own id so a retried add (lost reply) doesn't post the note twice.
    const id = typeof nid === "string" && /^[\w-]{6,40}$/.test(nid) ? nid : crypto.randomUUID().slice(0, 13);
    if (!t.log.some(x => x.id === id)) t.log.push({ id, by: name, at: now.toISOString(), text });
    return "note on {place}";
  },
  "note.edit"(t, { text, nid }, name, now) {
    text = noteText(text, "a note can't be empty; delete it instead");
    const n = t.log.find(x => x.id === nid);
    if (!n) throw fail(404, "that note was deleted by someone else");
    Object.assign(n, { text, edited: now.toISOString(), editedBy: name });
    return "edited a note on {place}";
  },
  "note.delete"(t, { nid }) {
    t.log = t.log.filter(x => x.id !== nid);
    return "deleted a note on {place}";
  },
};

// Applies one op to a copy of the entry. Returns [entry, summary-for-commit-message].
export function applyOp(entry, op, args, name, now) {
  if (!Object.hasOwn(OPS, op)) throw fail(400, "unknown op");
  const t = structuredClone(entry || {});
  if (!Array.isArray(t.log)) t.log = [];
  const what = OPS[op](t, args, name, now);
  t.updatedAt = now.toISOString();
  t.updatedBy = name;
  return [t, what];
}

async function knownListing(env, id) {
  const find = s => (s.body.listings.listings || []).find(l => l.id === id);
  let hit = memo && find(memo);
  if (!hit) { memo = null; hit = find(await snapshot(env)); } // new listing since the memo? read fresh once
  return hit;
}

async function postOp(req, env, cors) {
  if (!env.PASSCODE || !(await sameSecret(header(req, "X-Passcode"), env.PASSCODE))) return json({ error: "wrong passcode" }, 401, cors);
  const raw = await req.text();
  if (raw.length > 10000) throw fail(413, "too much at once");
  let body;
  try { body = JSON.parse(raw); } catch { throw fail(400, "body must be JSON"); }
  const { id, op, ...args } = body || {};
  if (typeof id !== "string" || !ID_RE.test(id)) throw fail(400, "bad listing id");
  const listing = await knownListing(env, id);
  if (!listing) throw fail(400, "no such listing");
  const name = cleanName(header(req, "X-Name"));
  const place = listing.suburb || id;

  // Up to 10 tries: 2 GitHub calls each + 5 for a cold snapshot stays under the free plan's 50 per request.
  for (let attempt = 0; attempt < 10; attempt++) {
    const { track, sha } = await readTrack(env);
    const [entry, what] = applyOp(track[id], op, args, name, new Date());
    track[id] = entry;
    const r = await writeTrack(env, track, sha, `${name}: ${what.replace("{id}", id).replace("{place}", place)}`);
    if (r.ok) { memo = null; return json({ ok: true, entry }, 200, cors); }
    if (r.status !== 409 && r.status !== 422) throw fail(502, `GitHub said ${r.status} saving`);
    // Someone else saved a moment ago: re-read and re-apply on top of their change.
    // Exponential backoff with full jitter spreads the retries of everyone who collided.
    await new Promise(res => setTimeout(res, Math.random() * Math.min(2000, 100 * 2 ** attempt)));
  }
  throw fail(503, "too many people saving at once, try again");
}
