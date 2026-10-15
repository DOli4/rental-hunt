// Runs the worker against the mock GitHub API and hammers it with simultaneous saves from two people.
// Usage: node test/worker.test.mjs        (needs git: seeds from the data branch)
import assert from "node:assert/strict";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { startMock, googleToken } from "./mock-github.mjs";
import worker, { applyOp } from "../worker/worker.js";

test("worker: sign-in, reads and simultaneous saves from two people", async () => {
  const show = f => { try { return execFileSync("git", ["show", `data:${f}`], { encoding: "utf8" }); } catch { return null; } };
  const files = Object.fromEntries(["listings.json", "track.json", "meta.json", "settings.json"].map(f => [f, show(f)]).filter(([, c]) => c != null));
  const { server, state } = await startMock(5699, files);
  const env = { REPO: "me/rental-hunt-data", BRANCH: "data", GITHUB_TOKEN: "fake", GITHUB_API: "http://127.0.0.1:5699", ALLOWED_ORIGIN: "https://me.github.io",
    GOOGLE_CLIENT_ID: "test-client", GOOGLE_JWKS_URL: "http://127.0.0.1:5699/__jwks", SESSION_SECRET: "test-secret-0123456789abcdef",
    ALLOWED_EMAILS: "anna@x.com, Dieter@x.com; anya@x.com" };
  const ids = JSON.parse(files["listings.json"]).listings.map(l => l.id);
  const [A, B] = ids;

  const sessions = {};
  const call = (path, { body, name = "Anna", session = sessions[name], origin = "https://me.github.io" } = {}) =>
    worker.fetch(new Request("https://w.dev" + path, {
      method: body ? "POST" : "GET",
      headers: { Origin: origin, "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session}` } : {}) },
      body: body && JSON.stringify(body),
    }), env);
  const login = (claims, aud) => call("/login", { body: { credential: googleToken(claims, aud) }, session: "" });

  try {
    // sign-in: only invited, verified Google accounts for our client id get a session
    for (const [n, email] of [["Anna", "anna@x.com"], ["Dieter", "dieter@x.com"], ["Ånna Ñ", "anya@x.com"]]) {
      const r = await login({ email, given_name: n });
      assert.equal(r.status, 200); const j = await r.json(); assert.equal(j.name, n); sessions[n] = j.session;
    }
    assert.equal((await login({ email: "eve@x.com", given_name: "Eve" })).status, 403);
    assert.equal((await login({ email: "anna@x.com" }, "someone-elses-app")).status, 401);
    assert.equal((await login({ email: "anna@x.com", email_verified: false })).status, 401);
    assert.equal((await login({ email: "anna@x.com", exp: 1 })).status, 401);
    const forged = googleToken({ email: "anna@x.com" }).replace(/\.[^.]+$/, ".AAAA");
    assert.equal((await call("/login", { body: { credential: forged }, session: "" })).status, 401);
    assert.equal((await call("/data", { session: "" })).status, 401);
    for (const junk of ["a.b.!!!", "a.b.AAAAA", "bnVsbA.bnVsbA.AAAA", "x", ""]) assert.equal((await call("/login", { body: { credential: junk }, session: "" })).status, 401, junk);
    assert.equal((await login({ email: "anna@x.com", exp: undefined })).status, 401, "token without expiry");
    const [pl, sg] = sessions.Anna.split(".");
    const evil = Buffer.from(JSON.stringify({ e: "eve@x.com", n: "Eve", x: Date.now() + 1e9 })).toString("base64url");
    assert.equal((await call("/data", { session: `${evil}.${sg}` })).status, 401, "tampered session");
    assert.ok(pl);


    // read
    let r = await call("/data"); const d = await r.json();
    assert.equal(r.status, 200); assert.equal(d.listings.listings.length, ids.length); assert.ok(d.sha);
    assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://me.github.io");
    assert.deepEqual(await (await call("/data?v=" + d.sha)).json(), { same: true, sha: d.sha });
    assert.equal((await call("/data", { origin: "http://localhost:5600" })).headers.get("Access-Control-Allow-Origin"), "http://localhost:5600");

    // guards
    assert.equal((await call("/op", { body: { id: A, op: "note.add", text: "x" }, session: "" })).status, 401);
    assert.equal((await call("/op", { body: { id: "../etc", op: "note.add", text: "x" } })).status, 400);
    assert.equal((await call("/op", { body: { id: "p24-0", op: "note.add", text: "x" } })).status, 400);
    assert.equal((await call("/op", { body: { id: A, op: "set", fields: { status: "maybe" } } })).status, 400);
    assert.equal((await call("/op", { body: { id: A, op: "set", fields: { updatedBy: "x" } } })).status, 400);
    assert.equal((await call("/op", { body: { id: A, op: "note.add", text: "y".repeat(2001) } })).status, 400);
    assert.equal((await call("/nope")).status, 404);

    // 24 saves at the same moment from two people on two places: nothing may be lost
    const before = state.commits.length;
    const jobs = [];
    for (let i = 0; i < 10; i++) jobs.push(call("/op", { body: { id: i % 2 ? A : B, op: "note.add", text: `note ${i}` }, name: i % 2 ? "Anna" : "Dieter" }));
    jobs.push(call("/op", { body: { id: A, op: "set", fields: { status: "viewing" } }, name: "Dieter" }));
    jobs.push(call("/op", { body: { id: A, op: "set", fields: { phone: "082 123 4567", email: "a@b.co" } }, name: "Anna" }));
    for (let i = 10; i < 22; i++) jobs.push(call("/op", { body: { id: B, op: "note.add", text: `note ${i}` }, name: "Ånna Ñ" }));
    const res = await Promise.all(jobs);
    assert.deepEqual(res.map(x => x.status), res.map(() => 200));
    const track = JSON.parse(state.files["track.json"]);
    const texts = [...(track[A].log || []), ...(track[B].log || [])].map(n => n.text).sort();
    assert.deepEqual(texts, Array.from({ length: 22 }, (_, i) => `note ${i}`).sort());
    assert.equal(track[A].status, "viewing"); assert.equal(track[A].phone, "082 123 4567");
    assert.equal(state.commits.length - before, 24);
    assert.ok(state.commits.some(c => /^Ånna Ñ: note on /.test(c.message)), "unicode name in commit message");
    assert.ok(state.commits.some(c => c.message === `Dieter: marked ${A} viewing`));

    // edit + delete, anyone can touch anyone's note
    const n = track[B].log.find(x => x.by === "Dieter");
    r = await call("/op", { body: { id: B, op: "note.edit", nid: n.id, text: "fixed" }, name: "Anna" });
    const e = (await r.json()).entry.log.find(x => x.id === n.id);
    assert.equal(e.text, "fixed"); assert.equal(e.editedBy, "Anna"); assert.ok(e.edited);
    assert.equal((await call("/op", { body: { id: B, op: "note.edit", nid: n.id, text: "  " } })).status, 400);
    r = await call("/op", { body: { id: B, op: "note.delete", nid: n.id } });
    assert.ok(!(await r.json()).entry.log.some(x => x.id === n.id));
    assert.equal((await call("/op", { body: { id: B, op: "note.edit", nid: n.id, text: "gone" } })).status, 404);

    // the reader sees the new head after a save
    const d2 = await (await call("/data?v=" + d.sha)).json();
    assert.ok(!d2.same); assert.equal(d2.track[A].status, "viewing");

    // a retried note.add with the same id lands once
    for (let i = 0; i < 2; i++) assert.equal((await call("/op", { body: { id: A, op: "note.add", nid: "nRetry123", text: "once" } })).status, 200);
    assert.equal(JSON.parse(state.files["track.json"])[A].log.filter(x => x.id === "nRetry123").length, 1);

    // track.json over 1 MB: refuse instead of reading it as empty and wiping it
    const big = JSON.stringify({ ...JSON.parse(state.files["track.json"]), pad: { log: [{ text: "x".repeat(1_100_000) }] } });
    state.files["track.json"] = big;
    assert.equal((await call("/op", { body: { id: A, op: "set", fields: { status: "no" } } })).status, 507);
    assert.equal(state.files["track.json"], big);

    // taking someone off the invite list locks them out straight away
    const list = env.ALLOWED_EMAILS; env.ALLOWED_EMAILS = "dieter@x.com";
    assert.equal((await call("/data")).status, 403);
    env.ALLOWED_EMAILS = list;

    // pure op logic
    const [t] = applyOp({ status: "new", log: [] }, "set", { fields: { status: "no" } }, "X", new Date(0));
    assert.equal(t.status, "no"); assert.equal(t.updatedBy, "X");
    console.log("worker tests passed:", state.commits.length, "commits, none lost");
  } finally {
    server.close();
  }
});
