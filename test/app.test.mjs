// Runs the real page (index.html + boot.js + app.js) in jsdom against the real worker and the mock GitHub,
// signs in with the dev form and clicks through what people actually do: hearts, statuses, notes, the map,
// filters, tabs, the profile panel, a partner's changes arriving, and the error paths.
// Usage: node --test test/app.test.mjs     (needs git: seeds from the data branch)
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import vm from "node:vm";
import { fileURLToPath, pathToFileURL } from "node:url";
import { JSDOM } from "jsdom";
import { startMock, googleToken } from "./mock-github.mjs";
import worker from "../worker/worker.js";

const MOCK = 5697, WORKER = "http://w.test";
const show = f => { try { return execFileSync("git", ["show", `data:${f}`], { encoding: "utf8" }); } catch { return null; } };
const files = Object.fromEntries(["listings.json", "track.json", "meta.json", "settings.json"].map(f => [f, show(f)]).filter(([, c]) => c != null));
// a dozen places is plenty and keeps jsdom quick (the one with the most photos first, so the gallery has pages)
const doc = JSON.parse(files["listings.json"]);
doc.listings = doc.listings.sort((a, b) => (b.photos || []).length - (a.photos || []).length).slice(0, 12);
files["listings.json"] = JSON.stringify(doc);
const listings = doc.listings;
const env = { REPO: "me/rental-hunt-data", BRANCH: "data", GITHUB_TOKEN: "fake", GITHUB_API: `http://127.0.0.1:${MOCK}`, ALLOWED_ORIGIN: "",
  GOOGLE_CLIENT_ID: "test-client", GOOGLE_JWKS_URL: `http://127.0.0.1:${MOCK}/__jwks`, SESSION_SECRET: "test-secret-0123456789abcdef",
  ALLOWED_EMAILS: "anna@x.com, dieter@x.com" };

const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
async function until(fn, what, ms = 6000) {
  const t0 = Date.now(); if (process.env.TIMING) console.log(String(t0 - T0).padStart(6), what);
  while (!fn()) { if (Date.now() - t0 > ms) throw new Error("timed out waiting for " + what); await sleep(15); }
}

// one page, wired like the browser: fetches to the worker go straight into worker.fetch
function page(url, net) {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8").replaceAll(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, "");
  const dom = new JSDOM(html, { url, pretendToBeVisual: true, runScripts: "outside-only" });
  const w = dom.window;
  w.RENTAL_CONFIG = { workerUrl: WORKER + "/", googleClientId: "dev", devTokenUrl: `http://127.0.0.1:${MOCK}/__google-token` };
  w.fetch = async (u, init = {}) => {
    if (net.down) throw new TypeError("network down");
    const { signal, ...rest } = init; // jsdom's AbortSignal isn't node's
    return String(u).startsWith(WORKER) ? worker.fetch(new Request(u, rest), env) : fetch(u, rest);
  };
  w.matchMedia = q => ({ matches: q.includes("hover"), media: q });
  w.CSS ??= { escape: s => String(s).replaceAll(/["\\]/g, "\\$&") };
  w.structuredClone ??= structuredClone;
  w.AbortSignal.timeout ??= () => undefined;
  Object.defineProperty(w.navigator, "clipboard", { value: { writeText: async t => { net.copied = t; } } });
  w.Element.prototype.scrollIntoView = () => {};
  w.Element.prototype.setPointerCapture = () => {};
  for (const [k, v] of [["clientWidth", 320], ["clientHeight", 240]]) Object.defineProperty(w.HTMLElement.prototype, k, { get: () => v });
  const ctx2d = new Proxy({}, { get: (o, k) => k in o ? o[k] : k === "measureText" ? () => ({ width: 40 }) : () => {}, set: (o, k, v) => { o[k] = v; return true; } });
  w.HTMLCanvasElement.prototype.getContext = () => ctx2d;
  const ctx = dom.getInternalVMContext();
  for (const f of ["../boot.js", "../app.js"]) {
    const path = fileURLToPath(new URL(f, import.meta.url));
    new vm.Script(readFileSync(path, "utf8"), { filename: pathToFileURL(path).href }).runInContext(ctx);
  }
  const d = w.document, $ = s => d.querySelector(s), $$ = s => [...d.querySelectorAll(s)];
  const click = el => { assert.ok(el, "nothing to click"); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };
  const key = (el, k, o = {}) => el.dispatchEvent(new w.KeyboardEvent("keydown", { key: k, bubbles: true, ...o }));
  const change = (sel, v) => { $(sel).value = v; $(sel).dispatchEvent(new w.Event("change", { bubbles: true })); };
  const pointer = (type, x, y, id, target = $("#mapArea")) => {
    const e = new w.MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
    Object.defineProperty(e, "pointerId", { value: id });
    target.dispatchEvent(e);
  };
  const toast = () => $("#toastT").textContent;
  const state = expr => vm.runInContext(expr, ctx);
  return { dom, w, d, $, $$, click, key, change, pointer, toast, state };
}

test("app: sign in, browse, save, notes, map, filters, partner changes, errors", async () => {
  const { server, state: gh } = await startMock(MOCK, files);
  server.keepAliveTimeout = 60000; // node's fetch reuses sockets; don't let the mock drop them mid-test
  const withPhotos = listings.find(l => (l.photos || []).length > 1) || listings[0];
  const net = {};
  const p = page(`http://127.0.0.1:5600/?devlogin=dieter@x.com#${withPhotos.id}`, net);
  const { w, d, $, $$, click, key, change, pointer, toast, state } = p;
  try {
    // dev sign-in -> session -> first load opens the place named in the address bar
    await until(() => $$("#view .pcard").length > 0, "cards");
    assert.ok($$("#view .pcard").length <= listings.filter(l => l.active !== false).length);
    assert.match($("#updated").textContent, /Data from the/);
    assert.equal(state("S.openId"), withPhotos.id);
    assert.ok($("#drawer .galMain img"));
    click($('[data-galstep="1"]')); click($('[data-galstep="-1"]')); click($('[data-gal="1"]'));
    assert.match($(".galCount").textContent, /^02 \/ /);
    key(d.body, "Escape");
    await until(() => $("#drawer").hidden, "drawer closed");

    // heart a place, then take it off again
    const card = $$("#view .pcard").find(c => c.querySelector('.pcHeart[aria-pressed="false"]'));
    const id = card.dataset.id;
    click(card.querySelector(".pcHeart"));
    await until(() => toast() === "Added to your shortlist", "shortlist toast");
    click($(`#view .pcard[data-id="${id}"] .pcHeart`));
    await until(() => toast() === "Removed from shortlist", "unshortlist toast");

    // the dossier: status, contact fields, copy, message
    click($(`#view .pcard[data-id="${id}"] .pcWin`));
    assert.equal(state("S.openId"), id);
    click($('[data-status="viewing"]'));
    await until(() => toast() === "Marked viewing booked", "status toast");
    $("#dPhone").value = "082 123 4567"; $("#dEmail").value = "agent@x.co.za"; $("#dView").value = "Sat 10:00";
    click($("#dSave"));
    await until(() => $("#dSavedMsg")?.textContent === "Saved for both of you", "details saved");
    assert.equal(JSON.parse(gh.files["track.json"])[id].phone, "082 123 4567");
    click($("[data-copy]")); await until(() => toast() === "Copied", "copy toast");
    click($("#dCopyMsg")); await until(() => net.copied?.startsWith("Hi "), "message copied");

    // notes: add (button and Enter), edit (Enter, Escape, Cancel, empty), delete (arm, confirm)
    const ta = () => $("#drawer textarea[data-nin]");
    click($("#drawer [data-addnote]")); // empty: just focuses
    ta().value = "first note"; click($("#drawer [data-addnote]"));
    await until(() => toast() === "Note saved for both of you", "note added");
    ta().value = "second note"; key(ta(), "Enter");
    await until(() => $$("#drawer .nItem").length === 2, "two notes");
    key(ta(), "Enter", { shiftKey: true });
    assert.equal(state("S.openId"), id, "Shift+Enter keeps the dossier open");
    click($("#drawer [data-editnote]"));
    const ed = () => $("#drawer textarea[data-nedit]");
    ed().value = "first note, edited"; key(ed(), "Enter");
    await until(() => toast() === "Note updated", "note edited");
    click($("#drawer [data-editnote]")); key(ed(), "Escape"); assert.equal(ed(), null);
    click($("#drawer [data-editnote]")); click($("#drawer [data-canceledit]")); assert.equal(ed(), null);
    click($("#drawer [data-editnote]")); ed().value = "  "; click($("#drawer [data-saveedit]"));
    assert.match(toast(), /can't be empty/);
    click($("#drawer [data-canceledit]"));
    click($("#drawer [data-delnote]")); assert.ok($("#drawer .nAct.armed"));
    click($("#drawer [data-delnote]"));
    await until(() => toast() === "Note deleted", "note deleted");
    assert.equal(JSON.parse(gh.files["track.json"])[id].log.length, 1);
    key(ta(), "Escape"); // Escape in the note box still closes the dossier
    await until(() => $("#drawer").hidden, "drawer closed from the note box");
    click($(`#view .pcard[data-id="${id}"] .pcWin`));
    click($("#dClose"));
    await until(() => $("#drawer").hidden, "drawer closed by button");

    // unsaved contact text survives a refresh, but never follows you to another place
    click($(`#view .pcard[data-id="${id}"] .pcWin`));
    $("#dEmail").value = "draft@x.co.za";
    state("renderDrawer()"); state("renderDrawer()");
    assert.equal($("#dEmail").value, "draft@x.co.za");
    click($("#dClose"));
    await until(() => $("#drawer").hidden, "drawer closed with a draft");
    const other = $$("#view .pcard").find(c => c.dataset.id !== id).dataset.id;
    click($(`#view .pcard[data-id="${other}"] .pcWin`));
    assert.notEqual($("#dEmail").value, "draft@x.co.za");
    click($("#dClose"));
    await until(() => $("#drawer").hidden, "other drawer closed");

    // notes button on a card opens the dossier and scrolls to the notes
    click($(`#view .pcard[data-id="${id}"] [data-opennotes]`));
    await sleep(850);
    click($("#scrim"));
    await until(() => $("#drawer").hidden, "drawer closed by scrim");

    // keyboard: Enter on a focused card opens it
    key($(`#view .pcard[data-id="${id}"]`), "Enter");
    assert.equal(state("S.openId"), id);
    key(d.body, "Escape");

    // map: marker pop-up, side panel, its status + heart, zoom, dock, drag, pinch, wheel
    click($(`.marker[data-pop="${id}"]`)); assert.ok($(".pop"));
    click($(".pop [data-closepop]")); assert.equal($(".pop"), null);
    click($(`.marker[data-pop="${id}"]`)); key(d.body, "Escape"); assert.equal($(".pop"), null);
    click($(`.marker[data-pop="${id}"]`)); click($(".pop [data-side]"));
    assert.equal($("#mapSide").hidden, false);
    click($('#mapSide [data-sidestatus="contacted"]'));
    await until(() => toast() === "Marked contacted", "side status");
    click($("#mapSide [data-heart]")); await until(() => /shortlist/.test(toast()), "side heart");
    click($("#mapSide [data-closeside]")); assert.equal($("#mapSide").hidden, true);
    click($(`.marker[data-pop="${id}"]`)); click($(".pop [data-side]")); key(d.body, "Escape"); key(d.body, "Escape");
    assert.equal($("#mapSide").hidden, true);
    for (const z of ["#zIn", "#zOut", "#zReset"]) click($(z));
    for (const m of ["#dOk", "#dSaved", "#dAll"]) click($(m));
    pointer("pointerdown", 100, 100, 1); pointer("pointermove", 140, 130, 1); pointer("pointerup", 140, 130, 1);
    pointer("pointerdown", 100, 100, 1); pointer("pointerdown", 200, 200, 2); pointer("pointermove", 250, 250, 2);
    pointer("pointerup", 250, 250, 2); pointer("pointercancel", 100, 100, 1); pointer("pointermove", 1, 1, 9);
    pointer("pointerdown", 10, 10, 3, $(".marker"));
    $("#mapArea").dispatchEvent(new w.WheelEvent("wheel", { deltaY: -50, bubbles: true, cancelable: true }));
    $("#mapArea").dispatchEvent(new w.WheelEvent("wheel", { deltaY: 50, bubbles: true, cancelable: true }));
    await sleep(40);
    assert.match($("#dCount").textContent, /place/);

    // filters, sort, search, toggles, tiles, tabs
    for (const s of ["price", "price_desc", "drive", "tecwise", "size_asc", "size_desc", "new", "best"]) change("#sort", s);
    change("#fArea", "core"); change("#fArea", "all");
    change("#fPets", "ok"); change("#fPets", "notno"); change("#fPets", "any");
    change("#fMax", "9000"); change("#fMax", "16000");
    $("#q").value = "zzzz-nothing"; $("#q").dispatchEvent(new w.Event("input"));
    assert.match($("#view").textContent, /Nothing to show/);
    $("#q").value = ""; $("#q").dispatchEvent(new w.Event("input"));
    for (const t of ["#tFibre", "#tSec", "#tHide", "#tFibre", "#tSec", "#tHide"]) click($(t));
    for (const t of ["ok", "no", "ask", "fibre", "fibre"]) click($(`[data-tile="${t}"]`));
    for (const t of ["shortlist", "new", "gone", "places"]) click($(`[data-tab="${t}"]`));
    click($('[data-jump="shortlist"]')); click($('[data-jump="places"]'));
    click($("#board [data-open]")); assert.ok(state("S.openId")); key(d.body, "Escape");
    click($("#lgToggle")); click($("#lgToggle"));
    d.dispatchEvent(new w.MouseEvent("pointermove", { clientX: 50, clientY: 50 }));
    w.dispatchEvent(new w.Event("resize")); w.dispatchEvent(new w.Event("scroll"));
    const img = $("img.lp"); img?.dispatchEvent(new w.Event("error"));

    // the other person changes things: a note, a shortlist mark and a phone number arrive on the next poll
    const anna = await (await worker.fetch(new Request(WORKER + "/login", { method: "POST", body: JSON.stringify({ credential: googleToken({ email: "anna@x.com", given_name: "Anna" }) }) }), env)).json();
    const [o1, o2, o3] = listings.filter(l => l.id !== id && l.active !== false).map(l => l.id);
    const op = body => worker.fetch(new Request(WORKER + "/op", { method: "POST", headers: { Authorization: "Bearer " + anna.session }, body: JSON.stringify(body) }), env);
    await op({ id: o1, op: "note.add", nid: "anna-note-1", text: "Called them, still available and they allow cats in the complex" });
    await op({ id: o2, op: "set", fields: { status: "interested" } });
    await op({ id: o3, op: "set", fields: { phone: "0821112222" } });
    d.dispatchEvent(new w.Event("visibilitychange"));
    await until(() => /^Anna /.test(toast()), "partner toast");

    // profile panel: settings, calm mode, close by Escape and backdrop
    click($("#whoChip")); assert.equal($("#whoBox").hidden, false);
    $("#pfToasts").checked = false; $("#pfToasts").dispatchEvent(new w.Event("change"));
    $("#pfCalm").checked = true; $("#pfCalm").dispatchEvent(new w.Event("change"));
    change("#pfStart", "shortlist");
    key($("#whoBox"), "Escape"); assert.equal($("#whoBox").hidden, true);
    click($("#whoChip")); click($("#whoBox")); assert.equal($("#whoBox").hidden, true);
    assert.ok(d.documentElement.classList.contains("calm"));
    click($(`#view .pcard[data-id="${id}"] .pcHeart`)); // calm: no bursts, still saves
    await until(() => /shortlist/.test(toast()), "calm heart");
    click($(`#view .pcard[data-id="${id}"] .pcWin`)); click($("#dClose")); assert.equal($("#drawer").hidden, true);
    $("#pfCalm").checked = false; $("#pfCalm").dispatchEvent(new w.Event("change"));

    // network down: a save is retried, then undone with a message; a poll says it's reconnecting
    net.down = true;
    click($(`#view .pcard[data-id="${id}"] .pcHeart`));
    await until(() => /Couldn't reach the save helper/.test(toast()), "offline save");
    d.dispatchEvent(new w.Event("visibilitychange"));
    await until(() => $("#sync").textContent === "reconnecting…", "reconnecting");
    net.down = false;


    // a session that no longer checks out signs you out
    state(`S.session="bad.token"`);
    click($(`#view .pcard[data-id="${id}"] .pcHeart`));
    await until(() => d.documentElement.classList.contains("locked"), "signed out");
    assert.match($("#homeErr").textContent, /sign-in expired/);

    // not on the invite list, then back in and out with the profile button
    $("#devEmail").value = "eve@x.com"; $("#devForm").requestSubmit();
    await until(() => /isn't on the invite list/.test($("#homeErr").textContent), "uninvited");
    $("#devEmail").value = "dieter@x.com"; $("#devForm").requestSubmit();
    await until(() => !d.documentElement.classList.contains("locked") && $$("#view .pcard").length > 0, "signed back in");
    click($("#whoChip")); click($("#whoSignOut"));
    assert.ok(d.documentElement.classList.contains("locked"));
    assert.match($("#view").textContent, /Sign in to see the places/);
    // ?devlogin is still in the address, so the home screen signs straight back in
    await until(() => !d.documentElement.classList.contains("locked") && $$("#view .pcard").length > 0, "signed in again");
  } finally {
    p.dom.window.close();
    server.close();
  }
});
