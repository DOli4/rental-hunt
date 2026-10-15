// Centurion Rental Hunt: everything the page does. Loaded by index.html (kept out of the HTML so the
// Content-Security-Policy can forbid inline scripts).
// The two work places come from the private data after sign-in (listings.json -> criteria.anchors),
// so the public page never says where they are.
const ANCHOR_COLORS = { tecwise: "#00F0FF", drive: "#FF5CA8" };
let ANCHORS = {};
function setAnchors(criteria) {
  const src = criteria?.anchors || {};
  ANCHORS = Object.fromEntries(
    Object.entries(src).map(([k, a]) => {
      const sub = String(a.label || "").replace(/^[^·]*·\s*/, "");
      return [k, { name: String(a.name || k), sub, area: sub.split(", ").pop(), lat: +a.lat, lng: +a.lng, color: ANCHOR_COLORS[k] || "#BC6CFF" }];
    }),
  );
  $("lgAnchors").innerHTML = Object.values(ANCHORS)
    .map(a => {
      const area = a.area ? " (" + esc(a.area) + ")" : "";
      return `<div class="li"><span class="sw" style="background:${a.color}"></span>Work · ${esc(a.name)}${area}</div>`;
    })
    .join("");
}
const routeTo = (origin, k) => {
  const a = ANCHORS[k];
  return a ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${a.lat},${a.lng}` : "#";
};
const STATUSES = [
  ["new", "New"],
  ["interested", "Interested"],
  ["contacted", "Contacted"],
  ["viewing", "Viewing booked"],
  ["applied", "Applied"],
  ["no", "Not for us"],
];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const SHORT = new Set(["interested", "contacted", "viewing", "applied"]);
const DEFAULT_TEMPLATE =
  "Hi {agent},\n\nI'm interested in the {beds}-bedroom {type} in {suburb} listed at R{price} pm ({link}).\n\nIs it still available? We have two indoor cats, would the landlord consider them? When could we come and view it?\n\nThanks,\nDieter";
const ICON = {
  ok: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  ask: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 7v6"/><circle cx="12" cy="17" r=".6"/></svg>',
  no: '<svg width="26" height="26" viewBox="0 0 26 26"><path d="M13 3 24 22H2z" fill="#e5534b"/><path d="M13 10v5" stroke="#2a0d0b" stroke-width="2.2"/><circle cx="13" cy="18.3" r="1.1" fill="#2a0d0b"/></svg>',
  box: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8"/></svg>',
};

const S = {
  freshNote: null,
  freshKind: "add",
  editNote: null,
  delArm: null,
  listings: new Map(),
  track: new Map(),
  meta: {},
  settings: {},
  tab: "places",
  tile: null,
  mapMode: "all",
  openId: null,
  popId: null,
  sideId: null,
  flash: new Set(),
  lastSync: 0,
  gaugesShown: false,
  listShown: false,
  prevNums: {},
  me: null,
  pass: "",
  mode: null,
  dataSha: null,
  busy: new Map(),
  savedAt: new Map(),
  loaded: false,
};
const CFG = { workerUrl: "", googleClientId: "", ...globalThis.RENTAL_CONFIG };
while (CFG.workerUrl.endsWith("/")) CFG.workerUrl = CFG.workerUrl.slice(0, -1);
function warnStorage(e) {
  console.warn("[rental] browser storage unavailable", e);
}
S.session = "";
S.email = "";
try {
  S.session = localStorage.getItem("rh-session") || "";
  S.me = S.session ? localStorage.getItem("rh-name") : null;
  S.email = localStorage.getItem("rh-email") || "";
} catch (e) {
  warnStorage(e);
}
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replaceAll(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rand = n => "R" + Number(n).toLocaleString("en-ZA").replaceAll(/[, ]/g, " ");
const pad2 = n => String(n).padStart(2, "0");
const store = {
  get(k, d) {
    try {
      const v = localStorage.getItem("rh:" + k);
      return v == null ? d : JSON.parse(v);
    } catch (e) {
      warnStorage(e);
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem("rh:" + k, JSON.stringify(v));
    } catch (e) {
      warnStorage(e);
    }
  },
};
// Reading layout restarts a CSS animation that is put back on the same element.
function reflow(el) {
  return el.offsetWidth;
}
const TOAST_KIND = {
  like: ["#FF5CA8", "♥"],
  unlike: ["#8b9490", "♡"],
  note: ["#00F0FF", "✎"],
  edit: ["#FFB86B", "✎"],
  del: ["#ff4d5e", "✕"],
  partner: ["#BC6CFF", "●"],
  error: ["#ff4d5e", "!"],
  copy: ["#00F0FF", "⧉"],
  info: ["#BC6CFF", "✦"],
  interested: ["#BC6CFF", "★"],
  contacted: ["#00F0FF", "☏"],
  viewing: ["#FFB86B", "◉"],
  applied: ["#34d399", "✓"],
  no: ["#ff4d5e", "✕"],
  new: ["#8b9490", "○"],
};
function toast(t, kind) {
  const el = $("toast");
  const [c, ic] = TOAST_KIND[kind] || TOAST_KIND.info;
  el.style.setProperty("--tc", c);
  $("toastI").textContent = ic;
  $("toastT").textContent = t;
  $("toastT").title = t;
  el.hidden = false;
  el.classList.remove("go");
  reflow(el);
  el.classList.add("go");
  clearTimeout(toast.t);
  toast.t = setTimeout(
    () => {
      el.hidden = true;
      el.classList.remove("go");
    },
    kind === "partner" ? 4200 : 2600,
  );
}

const tr = id => S.track.get(id) || {};
const plain = v => structuredClone(v ?? null);
const statusOf = id => tr(id).status || "new";
const phoneOf = l => tr(l.id).phone || l.phone || "";
const emailOf = l => tr(l.id).email || l.email || "";
function intl(p) {
  const d = String(p).replaceAll(/\D/g, "");
  if (d.startsWith("0")) return "27" + d.slice(1);
  return d;
}
function prettyPhone(p) {
  const d = String(p).replaceAll(/\D/g, "");
  return d.length === 10 ? d.replace(/(\d{3})(\d{3})(\d{4})/, "$1 $2 $3") : p;
}
function petClass(l) {
  const p = (l.pets || "").toLowerCase();
  if (p.startsWith("yes") || p.includes("small")) return "ok";
  if (p === "no" || p.includes("dogs only")) return "no";
  return "ask";
}
function petLabel(l) {
  const p = (l.pets || "").toLowerCase();
  if (p.includes("dogs only")) return "Dogs only, no cats";
  if (p === "no") return "No pets";
  if (p.includes("small")) return "Small pets OK";
  if (p.startsWith("yes")) return "Pets OK";
  return "Pets: ask";
}
const fibreOk = l => /^(?:yes|ready)/i.test(l.fibre || "") || /free/i.test(l.fibre || "");
const secOk = l => /24|guard|boom|access|estate|gated|electric|cctv|secur/i.test(l.security || "");
const PET_SCORE = { ok: 3, no: -3, ask: 0 };
function score(l) {
  let s = PET_SCORE[petClass(l)];
  if (fibreOk(l)) s += 1;
  if (secOk(l)) s += 1;
  if (l.tier !== "core") s -= 1;
  return s + (16000 - l.price) / 4000 - Math.min(l.min_drive, l.min_tecwise) / 10;
}
const isNew = l => S.meta.last_run && l.first_seen === S.meta.last_run && l.first_seen !== S.meta.first_run;
const activeAll = () => [...S.listings.values()].filter(l => l.active !== false);

/* shared filters (top bar + rail toggles + tiles) */
const pressed = id => $(id).getAttribute("aria-pressed") === "true";
const PET_TEST = { ok: l => petClass(l) === "ok", notno: l => petClass(l) !== "no" };
const TILE_TEST = { ok: l => petClass(l) === "ok", no: l => petClass(l) === "no", ask: l => petClass(l) === "ask", fibre: fibreOk };
function matchesQuery(l, q) {
  if (!q) return true;
  const t = tr(l.id);
  const hay = [l.suburb, l.address, l.agency, l.agent, l.type, l.summary, l.source, t.note, (t.log || []).map(n => n.text).join(" ")]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}
function passesBase(l) {
  const area = $("fArea").value,
    pets = PET_TEST[$("fPets").value],
    tile = TILE_TEST[S.tile];
  if (area !== "all" && l.tier !== area) return false;
  if (l.price > +$("fMax").value) return false;
  if (pets && !pets(l)) return false;
  if (tile && !tile(l)) return false;
  if (pressed("tFibre") && !fibreOk(l)) return false;
  if (pressed("tSec") && !secOk(l)) return false;
  return matchesQuery(l, $("q").value.trim().toLowerCase());
}
function inTab(l, tab, hide) {
  if (tab === "gone") return l.active === false;
  if (l.active === false) return false;
  const st = statusOf(l.id);
  if (tab === "shortlist") return SHORT.has(st) && passesBase(l);
  if (tab === "new" && !isNew(l)) return false;
  if (hide && st === "no") return false;
  return passesBase(l);
}
const sizeOf = l => Number(l.size_m2) || 0;
function bySize(a, b, dir) {
  const x = sizeOf(a),
    y = sizeOf(b);
  if (Boolean(x) !== Boolean(y)) return x ? -1 : 1;
  if (x !== y) return dir * (x - y);
  return dir * ((a.beds || 0) - (b.beds || 0)) || a.price - b.price;
}
const byPrice = (a, b) => a.price - b.price;
const SORTS = {
  price: byPrice,
  price_desc: (a, b) => b.price - a.price,
  drive: (a, b) => a.min_drive - b.min_drive || byPrice(a, b),
  tecwise: (a, b) => a.min_tecwise - b.min_tecwise || byPrice(a, b),
  size_asc: (a, b) => bySize(a, b, 1),
  size_desc: (a, b) => bySize(a, b, -1),
  new: (a, b) => String(b.first_seen).localeCompare(String(a.first_seen)),
};
function listFor(tab) {
  const hide = pressed("tHide");
  return [...S.listings.values()].filter(l => inTab(l, tab, hide)).sort(SORTS[$("sort").value] || ((a, b) => score(b) - score(a)));
}

/* ---------- rail charts ---------- */
function renderCharts() {
  const all = activeAll();
  if (!all.length) {
    $("chPrice").innerHTML = "";
    $("chDrive").innerHTML = "";
    return;
  }
  // rent spread: thin bars per R500 bucket
  const lo = 8000,
    hi = 16000,
    step = 500,
    n = (hi - lo) / step;
  const b = new Array(n).fill(0);
  all.forEach(l => {
    b[Math.min(n - 1, Math.max(0, Math.floor((l.price - lo) / step)))]++;
  });
  const mx = Math.max(...b, 1),
    W = 210,
    base = 46,
    bw = W / n;
  const minP = Math.min(...all.map(l => l.price)),
    maxP = Math.max(...all.map(l => l.price));
  let s = `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="var(--line)"/>`;
  b.forEach((v, i) => {
    const h = (v / mx) * 36;
    const x = i * bw + bw / 2;
    for (let k = 0; k < 3; k++) {
      s += `<line x1="${x - 2 + k * 2}" y1="${base}" x2="${x - 2 + k * 2}" y2="${base - h * (k === 1 ? 1 : 0.55)}" stroke="${k === 1 ? "#00F0FF" : "#5b4a7e"}" stroke-width="1"/>`;
    }
  });
  const px = p => ((p - lo) / (hi - lo)) * W;
  [minP, maxP].forEach(p => {
    s += `<line x1="${px(p)}" y1="6" x2="${px(p)}" y2="${base}" stroke="var(--muted)" stroke-dasharray="1 2"/><circle cx="${px(p)}" cy="6" r="2.2" fill="var(--white)"/><circle cx="${px(p)}" cy="${base}" r="2.2" fill="var(--white)"/>`;
  });
  $("chPrice").innerHTML = s;
  $("chPriceEnds").innerHTML = `<span>${rand(minP)}</span><span>${rand(maxP)}</span>`;
  // minutes to Drive: peaks
  const dl = 3,
    dh = 25,
    m = dh - dl;
  const c = new Array(m + 1).fill(0);
  all.forEach(l => c[Math.min(m, Math.max(0, Math.min(l.min_drive, l.min_tecwise) - dl))]++);
  const cm = Math.max(...c, 1),
    sw = W / (m + 1);
  let t = `<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="var(--line)" stroke-dasharray="1 3"/>`;
  c.forEach((v, i) => {
    if (!v) return;
    const x = i * sw + sw / 2,
      h = 6 + (v / cm) * 30,
      near = i <= 10 - dl;
    t += `<path d="M${x - sw * 0.7} ${base} L${x} ${base - h} L${x + sw * 0.7} ${base}Z" fill="${near ? "#00F0FF" : "#BC6CFF"}" fill-opacity="${near ? 0.9 : 0.55}"/>`;
  });
  const t10 = (10 - dl) * sw + sw / 2;
  t += `<line x1="${t10}" y1="4" x2="${t10}" y2="${base}" stroke="#00F0FF" stroke-dasharray="1 2"/><text x="${t10 + 4}" y="10" font-size="8" fill="#00F0FF" font-family="Lexend">10 min</text>`;
  $("chDrive").innerHTML = t;
  const md = all.map(l => Math.min(l.min_drive, l.min_tecwise));
  $("chDriveEnds").innerHTML = `<span>${Math.min(...md)} min</span><span>${Math.max(...md)} min</span>`;
}

/* ---------- gauges ---------- */
function gauge(label, val, of, hue) {
  const R = 34,
    C = 2 * Math.PI * R,
    frac = of ? Math.min(1, val / of) : 0,
    sweep = 0.78;
  const len = C * sweep * frac,
    ang = ((-90 - (sweep * 360) / 2 + sweep * 360 * frac) * Math.PI) / 180 + Math.PI / 2;
  const nx = 42 + Math.cos(ang - Math.PI / 2) * 24,
    ny = 42 + Math.sin(ang - Math.PI / 2) * 24;
  const id = "g" + label.replaceAll(/\W/g, "");
  return `<div class="gauge"><svg viewBox="0 0 84 84" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${hue[0]}"/><stop offset="1" stop-color="${hue[1]}"/></linearGradient></defs>
    <g transform="rotate(${90 + (1 - sweep) * 180} 42 42)">
      <circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--line)" stroke-width="3" stroke-dasharray="${C * sweep} ${C}" stroke-linecap="round"/>
      <circle cx="42" cy="42" r="${R}" fill="none" class="arc" stroke="url(#${id})" stroke-width="3" stroke-dasharray="${Math.max(0.01, len)} ${C}" stroke-linecap="round"/>
    </g>
    <line x1="42" y1="42" x2="${nx}" y2="${ny}" stroke="var(--fg)" stroke-width="1.2" stroke-linecap="round"/><circle cx="42" cy="42" r="2.4" fill="var(--fg)"/>
  </svg><span class="k">${label}</span><span class="v num"><span data-count="g-${id}" data-to="${val}">${val}</span><small> / ${of}</small></span></div>`;
}
function renderGauges() {
  const all = activeAll(),
    n = all.length;
  const short = all.filter(l => SHORT.has(statusOf(l.id))).length;
  const pets = all.filter(l => petClass(l) === "ok").length;
  const core = all.filter(l => l.tier === "core").length;
  const g = $("gauges"),
    tabs = g.querySelector(".viewtabs").outerHTML;
  g.classList.toggle("anim", !S.gaugesShown && S.loaded);
  if (S.loaded) S.gaugesShown = true;
  g.innerHTML =
    tabs +
    gauge("On our shortlist", short, n, ["#00F0FF", "#BC6CFF"]) +
    gauge("Pet friendly", pets, n, ["#34d399", "#00F0FF"]) +
    gauge("Within 10 min", core, n, ["#BC6CFF", "#FF5CA8"]);
  const on = S.tab === "shortlist" ? "shortlist" : "places";
  g.querySelectorAll("[data-jump]").forEach(b => b.setAttribute("aria-pressed", String(b.dataset.jump === on)));
}

/* ---------- map (drawn from OpenStreetMap roads; drag to pan, scroll / pinch / buttons to zoom) ---------- */
const ROADS_RAW =
  "0~N14~-257704,281877,-13,27,-26,20,-76,-8,-57,-19,-67,-75,-25,-13,-46,-5,-313,36,-58,-1,-58,-17,-109,-74,-293,-75;0~N14~-259119,280288,45,83,26,72,30,231,71,210,14,150,30,156,13,202,18,80,27,73,102,221;0~N14~-258742,281776,-110,-241,-33,-100,-14,-85,-7,-156,-30,-160,-10,-128,-74,-227,-34,-247,-81,-166;0~N14~-258870,281664,319,82,82,59,46,23,33,8,63,1,318,-36,41,6,32,18,61,70,56,17,62,10,36,-21;2~M18~-257781,281938,-34,-4,-80,25,-75,7,-181,59,-137,47,-97,49,-213,85;2~M18~-258598,282204,213,-84,97,-49,298,-105,81,-4,92,-31,19,1;2~R50~-258087,282579,-33,45,-38,3,-71,-27,-15,1,-184,138,-34,46,-49,119,-35,56,-50,44,25,-19;2~R50~-258362,282691,-70,54,-40,63;2~R50~-258086,282579,-38,50,-28,2,-86,-29,-47,31;0~R21~-259824,282520,268,40,276,59,86,-9,154,-57,334,-12,189,-26,118,-29,38,-15,164,-88,143,-104;0~R21~-258053,282281,-143,104,-197,103,-176,40,-206,21,-264,7,-154,57,-98,9,-247,-55,-317,-48;2~M10~-258198,282524,56,-163,-3,-118,37,-35,13,-24,1,-42,-21,-30,-41,-25,-33,-104,-32,-61,3,-103,-11,-154,-37,-110,-44,-68,-26,-132,-40,-122,29,-105;2~M10~-258045,282961,-6,-21,7,20;2~M10~-258135,282228,-12,27;2~M10~-258242,281627,8,23;2~M10~-258150,282399,-47,126;2~M10~-258115,282112,-45,-28,-31,-101,-30,-61;2~R55~-259162,280999,-36,-7,374,70,67,22,286,0,64,15,120,62,44,7,100,-9,151,-69,39,0,119,57,47,-5;2~R55~-259348,280964,-53,-14,-57,-32,70,39,190,35;2~R55~-257787,281144,-43,6,-112,-54,-51,-3,-155,69,-98,9,-41,-8,-114,-59,-69,-17,-292,-2,-61,-20,-277,-55;2~R55~-259215,280989,-102,-19;2~R55~-259528,280876,70,42;1~R21~-257742,281992,-79,15,-22,24,-35,92,-126,124,-49,34;1~R21~-258054,282279,44,-30,133,-131,30,-84,16,-24,88,-24;0~N1~-259530,281346,165,65,158,89;0~N1~-257663,282751,-223,-57,-50,-22,-86,-57,-142,-60,-21,-14,-61,-57,-139,-137,-42,-32,-101,-45,-35,-29,-28,-42,-51,-204,-100,-219;0~N1~-258743,281766,101,222,15,50,20,101,18,59,17,29,18,20,33,24,104,48,40,33,200,192,42,24,116,46,108,69,130,36;0~N1~-258845,281673,-151,-45,-53,-26,-87,-54;0~N1~-259224,281492,-129,-73,-105,-46,-73,-26;0~N1~-259121,281555,110,64,141,45;2~M11~-257839,283004,4,-153,12,-57,26,-57;2~M11~-257800,282746,-31,92,-7,92;2~M11~-257837,282969,-1,35;2~R562~-259432,281446,-45,152,4,138,-30,70;2~R562~-259540,281853,41,-55,24,-59,-3,-94,8,-90,36,-108;2~Solomon Mahlangu Drive~-258197,282525,-16,63,-1,86,12,36,77,95,74,135;2~Solomon Mahlangu Drive~-258133,282794,-71,-83,-11,-30,0,-95,17,-62;2~Solomon Mahlangu Drive~-258044,282960,9,52;2~Solomon Mahlangu Drive~-258041,282976,-4,-15;2~Solomon Mahlangu Drive~-258085,282881,-15,-31;0~N1 section 21 North~-259207,281500,86,55;0~N1 section 21 South~-259136,281548,-88,-56;2~M9~-258082,282571,-4,8;3~M25~-258703,281379,-2,-19,6,41,-4,-22;3~M25~-258698,281407,-1,-6,20,123,-3,-19;3~M25~-258678,281529,-1,-5,9,32,45,41,1,125,42,93,119,105,68,67,8,18;3~M25~-258706,281351,1,9;3~M25~-258706,281353,-1,-2;3~M25~-258545,281851,-37,-34,-41,-96,1,-107,-13,-32;3~M25~-258512,281876,117,111,7,19;3~M34~-258640,282108,110,-90,71,-94,66,-71,6,-60,-10,-56,12,92,-6,23,-68,73,-71,94,-109,90;3~M34~-258418,281632,18,66,-19,-66;3~M34~-258398,281723,0,7,-2,-32,2,25;3~M34~-258397,281737,-1,-7,1,7;3~M36~-258724,281956,-47,-48,49,47,48,92,-50,-91;3~M36~-258674,282047,48,84,7,83;3~M36~-258620,282215,-7,-79,-37,-71;3~M36~-259218,281321,-85,168,30,80,33,14,59,44,96,29,-73,-20;3~M36~-259039,281669,-27,-8,182,61,15,21,1,39,51,78,46,48;3~M36~-258786,281894,-32,-33,-48,-70,-35,-66,-22,-17,-54,-20;3~M36~-259216,281321,-82,157,-1,25;3~M36~-259085,281656,18,5;3~M36~-259181,281627,-16,-10;3~M36~-259273,281569,-17,-39;3~M9~-258081,282560,-6,-11,5,22,1,-11;3~M9~-257900,282390,-28,-2,-21,28,-4,23,-126,46,-11,60;3~M9~-258087,282579,5,-8;3~M28~-258633,282472,48,8,-49,-7;3~M28~-258585,282480,171,-39,13,-11,11,-37,33,-44,72,0,33,20,36,-6,16,11,23,42,20,5;3~M28~-258544,282471,21,-5;3~M28~-258261,282365,20,2;3~M28~-258354,282349,-29,33,-15,43,-16,16;3~M28~-258158,282422,-25,-14;3~Willem Botha Road~-258504,281417,-43,8,-55,51;3~Willem Botha Road~-258428,281442,20,-14,-20,14,-39,0,-36,-24;3~Willem Botha Road~-258627,281591,22,-15,6,-19,-4,-75,6,-10;3~M37~-258605,281358,-17,12,-54,2,-24,14,-114,28,-114,12,-49,-11,-51,24,-21,5,-13,-5;3~M37~-258860,281417,60,-7,99,-25,25,-14,28,0;3~M37~-259236,281318,36,9,-36,-9,-144,-9;3~M37~-259093,281401,-20,-30,-59,-31,29,15;3~R114~-258851,280663,37,193,-10,209,77,102,-32,-44;3~R114~-258747,281167,245,330,33,27,72,19,-28,-7;3~R114~-258821,280950,-2,115,16,21;3~R114~-258397,281543,63,17,19,33;3~M18~-259413,282330,101,-6,108,-55,50,16,142,-33,381,-34,246,-98,97,-49,199,-69;3~M18~-258089,282005,-199,67,-139,67,-204,79;3~M19~-258810,282035,88,-80,69,-44,32,-77,31,-34,22,-8,-31,18,-25,36,-18,51,-21,25,-58,34,-89,82,-44,30;3~M19~-258289,282073,-41,-102,-103,-124,104,124,41,101;3~M19~-258433,281847,-39,-38,-35,-17,35,17;3~M19~-258507,281792,-23,-5,-38,5,32,-5,29,5;3~R101~-258807,281616,57,4,-113,-11,27,4;3~R101~-258915,281603,-87,-12,99,13,-12,-1;3~R101~-259407,281450,103,36,180,105,23,3,44,-10,55,7,-59,-5,-61,7,-39,-16,-36,-29,-108,-59,-95,-33;3~R101~-258631,281628,8,1,-127,-9,49,4;3~R101~-258287,281582,44,-22,-206,84,-174,-15,7,1;3~R101~-258243,281560,22,-5,56,14,190,70,89,41;3~West Avenue~-258502,281882,-30,20,-65,72,-32,-27,-30,12,-11,-4,-14,-24;3~West Avenue~-258683,281931,9,20,14,7,31,-12,32,27,67,-75,26,-17;3~M57~-258369,282514,53,38,76,4,-72,-2,-57,-40,-28,-7,-83,45,-122,34,-64,9,-116,-33,16,5;3~M57~-258782,282562,-67,4,-23,-12,-27,-37,-56,-35,-323,-32,-66,-18,-185,12,-132,-3;3~M57~-258688,282591,86,-5;3~R562~-259309,280528,20,224,-112,198;3~M31~-258767,282137,-10,16,-1,32,14,105,33,35,95,69,11,49,-53,164,12,27,127,87,58,67,15,8;3~M31~-258678,282607,53,-164;3~M31~-258991,281421,66,97,5,126,-5,-126;3~M31~-258927,281764,0,43,9,-140,-9,97;3~M31~-258826,282007,58,107;3~M31~-258926,281858,6,55,-1,-6;3~M31~-258861,281984,-45,-40,-14,-31;3~M26~-258085,280987,-31,-36,66,80,46,29,11,33;3~M26~-258151,280928,35,23,-35,-23,-74,-107,-14,-23,-5,-38;3~M26~-258050,281031,49,30,10,32;3~M24~-258157,281161,10,17,135,123,48,280,6,3,-7,59,16,73,-10,36,-21,16,-112,28,-39,54,16,-27;3~M24~-258131,281850,-60,101;3~M27~-258361,282353,-95,-83,-44,-9,-2,-14,12,-22,29,-16,32,-38,37,-22,-9,-23,-39,-94,-114,-104,-30,-15,-56,-51,-48,-63,-41,-74,-7,-58,-39,-38,-7,-25,-33,-26,-43,-83,26,-56;3~M27~-258782,281604,6,19,48,50,-1,8;3~M27~-258660,281830,49,38,172,164,37,93;3~Estcourt Avenue~-258727,281524,6,98;3~Estcourt Avenue~-258723,281622,1,-35;3~R55~-259162,280999,-36,-7,284,53;3~R55~-259400,280952,202,40;3~R55~-258915,281048,-185,-38;3~Lenchen Avenue~-258725,281197,-26,11,-13,15,-21,81,-29,54,1,28,-12,27;3~Lenchen Avenue~-258826,281413,13,-32,-1,-23;3~Lenchen Avenue~-258792,281316,11,-27;3~M23~-258331,282904,-72,-89,-26,-75;3~M23~-258428,282740,29,81,41,49;3~M30~-257898,282780,-64,75,67,-83;3~M33~-257882,282834,-88,-34,89,33;3~M33~-258132,282775,-13,3,14,-3,19,9,38,35,70,-25,34,6;3~Lever Road~-259407,281297,27,12";
const ROADS = ROADS_RAW.split(";").map(s => {
  const [c, n, nums] = s.split("~");
  const v = nums.split(",").map(Number);
  const p = [];
  let a = v[0],
    b = v[1];
  p.push([a / 1e4, b / 1e4]);
  for (let i = 2; i < v.length; i += 2) {
    a += v[i];
    b += v[i + 1];
    p.push([a / 1e4, b / 1e4]);
  }
  return { c: +c, n, p };
});
const PLACES = [
  ["Wierdapark", -25.8603, 28.1467],
  ["Eldoraigne", -25.8451, 28.1573],
  ["Clubview", -25.8339, 28.1683],
  ["Hennopspark", -25.8497, 28.1742],
  ["Zwartkop", -25.8672, 28.1764],
  ["Lyttelton", -25.8294, 28.2028],
  ["Die Hoewes", -25.846, 28.195],
  ["Doringkloof", -25.8564, 28.2103],
  ["Irene", -25.8684, 28.218],
  ["Highveld", -25.87, 28.23],
  ["Pierre van Ryneveld", -25.8369, 28.2417],
  ["Rooihuiskraal", -25.8933, 28.1514],
  ["The Reeds", -25.8992, 28.1342],
  ["Amberfield", -25.885, 28.1328],
  ["Heuweloord", -25.8822, 28.1131],
  ["Celtisdal", -25.8711, 28.1297],
  ["Raslouw", -25.8529, 28.1187],
  ["Thatchfield", -25.8975, 28.1137],
  ["Valhalla", -25.8069, 28.1511],
  ["Glen Lauriston", -25.8253, 28.1558],
  ["Golden Fields", -25.908, 28.1691],
  ["Midstream", -25.9111, 28.1934],
  ["Kosmosdal", -25.925, 28.135],
  ["Monavoni", -25.856, 28.1],
];
const VIEW = { z: 1, tx: 0, ty: 0 };
let raf = 0;
function hash2(x, y) {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 4294967295;
}
function vnoise(x, y) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    s = t => t * t * (3 - 2 * t);
  const a = hash2(xi, yi),
    b = hash2(xi + 1, yi),
    c = hash2(xi, yi + 1),
    d = hash2(xi + 1, yi + 1),
    u = s(xf),
    v = s(yf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function baseGeom(w, h) {
  const pts = activeAll()
    .filter(l => l.tier === "core")
    .concat(Object.values(ANCHORS));
  if (!pts.length) pts.push({ lat: -25.86, lng: 28.19 }); // nothing loaded yet: centre on Centurion
  let minLat = Math.min(...pts.map(p => p.lat)),
    maxLat = Math.max(...pts.map(p => p.lat)),
    minLng = Math.min(...pts.map(p => p.lng)),
    maxLng = Math.max(...pts.map(p => p.lng));
  const k = Math.cos((-25.86 * Math.PI) / 180),
    padLat = (maxLat - minLat) * 0.18 + 0.01,
    padLng = (maxLng - minLng) * 0.1 + 0.008;
  minLat -= padLat;
  maxLat += padLat;
  minLng -= padLng;
  maxLng += padLng;
  const sc = Math.min(w / ((maxLng - minLng) * k), (h - 40) / (maxLat - minLat));
  const ox = (w - (maxLng - minLng) * k * sc) / 2,
    oy = (h - 40 - (maxLat - minLat) * sc) / 2;
  return { x: lng => ox + (lng - minLng) * k * sc, y: lat => oy + (maxLat - lat) * sc, kmPx: sc / 111.32 };
}
function geomNow(w, h) {
  const b = baseGeom(w, h);
  return { x: lng => b.x(lng) * VIEW.z + VIEW.tx, y: lat => b.y(lat) * VIEW.z + VIEW.ty, kmPx: b.kmPx * VIEW.z };
}
function jit(id) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.codePointAt(0)) >>> 0;
  return [((h & 255) / 255 - 0.5) * 26, (((h >> 8) & 255) / 255 - 0.5) * 26];
}
function markerVisible(l) {
  if (!passesBase(l)) return false;
  const st = statusOf(l.id);
  if (S.mapMode === "ok" && petClass(l) !== "ok") return false;
  if (S.mapMode === "saved" && !SHORT.has(st)) return false;
  return !(pressed("tHide") && st === "no");
}
// heat map: how "hot" one dot is (nearby places + the 10-minute zones + a little noise), then its colour and size
function heatAt(x, y, vis, anchors, ring, sig) {
  let v = 0;
  for (const p of vis) {
    const dx = x - p.x,
      dy = y - p.y,
      d2 = dx * dx + dy * dy;
    if (d2 < sig * sig * 9) v += Math.exp(-d2 / (2 * sig * sig));
  }
  let z = 0;
  for (const a of anchors) {
    const d = Math.hypot(x - a.x, y - a.y);
    if (d < ring) z = Math.max(z, 0.16 + 0.16 * (1 - d / ring));
  }
  const nx = (x - VIEW.tx) / VIEW.z,
    ny = (y - VIEW.ty) / VIEW.z,
    nz = vnoise(nx / 38, ny / 38) * 0.7 + vnoise(nx / 11, ny / 11) * 0.3;
  return [Math.min(1.4, v * 0.45 + z + (nz - 0.45) * 0.3), nz];
}
function heatDot(t, nz) {
  if (t < 0.18) return [`rgba(90,100,96,${0.2 + nz * 0.18})`, 0.7];
  if (t < 0.75) {
    const a = (t - 0.18) / 0.57;
    return [`rgba(${Math.round(90 + a * 98)},${Math.round(60 + a * 48)},${Math.round(160 + a * 95)},${0.25 + a * 0.3})`, 0.9 + a * 0.9];
  }
  const a = Math.min(1, (t - 0.75) / 0.6);
  return [`rgba(${Math.round(188 + a * 67)},${Math.round(108 - a * 16)},${Math.round(255 - a * 87)},.6)`, 1.7 + a * 0.4];
}
function drawHeat(ctx, w, h, vis, anchors, ring, sig) {
  const sp = 7;
  for (let y = sp / 2; y < h; y += sp) {
    for (let x = sp / 2; x < w; x += sp) {
      const [t, nz] = heatAt(x, y, vis, anchors, ring, sig),
        [col, r] = heatDot(t, nz);
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
const ROAD_STYLE = [
  [3.2, 0.62],
  [2.6, 0.5],
  [1.7, 0.36],
  [1.1, 0.24],
];
function drawRoads(ctx, G) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const zoomW = Math.min(1.6, Math.max(0.8, VIEW.z * 0.8));
  for (const cls of [3, 2, 1, 0]) {
    ctx.strokeStyle = `rgba(233,238,235,${ROAD_STYLE[cls][1]})`;
    ctx.lineWidth = ROAD_STYLE[cls][0] * zoomW;
    for (const r of ROADS.filter(q => q.c === cls)) {
      ctx.beginPath();
      r.p.forEach((q, i) => {
        const X = G.x(q[1]),
          Y = G.y(q[0]);
        if (i) ctx.lineTo(X, Y);
        else ctx.moveTo(X, Y);
      });
      ctx.stroke();
    }
  }
}
// road labels: one per name, longest piece, placed mid-segment when on screen
const labelled = r => r.n && r.p.length >= 2 && !/section/i.test(r.n) && !(r.c === 3 && VIEW.z < 1.6 && !/^[NRM]\d/.test(r.n));
function roadLabelSpots(G, w, h) {
  const best = {};
  for (const r of ROADS.filter(labelled)) {
    const mid = r.p[Math.floor(r.p.length / 2)],
      X = G.x(mid[1]),
      Y = G.y(mid[0]),
      len = r.p.length;
    const onScreen = X >= 20 && X <= w - 20 && Y >= 20 && Y <= h - 50;
    if (onScreen && (!best[r.n] || best[r.n].len < len)) best[r.n] = { X, Y, len, c: r.c };
  }
  return best;
}
function drawRoadLabels(ctx, G, w, h) {
  ctx.font = "500 10px Lexend, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const [n, b] of Object.entries(roadLabelSpots(G, w, h))) {
    const major = b.c <= 1,
      short = n.replace(" Avenue", " Ave").replace(" Road", " Rd").replace(" Drive", " Dr"),
      tw = ctx.measureText(short).width + 10;
    ctx.fillStyle = major ? "rgba(233,238,235,.92)" : "rgba(37,41,40,.92)";
    ctx.strokeStyle = "rgba(233,238,235,.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(b.X - tw / 2, b.Y - 8, tw, 16, 4);
    else ctx.rect(b.X - tw / 2, b.Y - 8, tw, 16);
    ctx.fill();
    if (!major) ctx.stroke();
    ctx.fillStyle = major ? "#111" : "rgba(233,238,235,.85)";
    ctx.fillText(short, b.X, b.Y + 0.5);
  }
}
function drawPlaces(ctx, G, w, h) {
  ctx.font = "300 11px Lexend, sans-serif";
  ctx.fillStyle = "rgba(200,210,205,.55)";
  for (const [n, la, lo] of PLACES) {
    const X = G.x(lo),
      Y = G.y(la);
    if (X > 30 && X < w - 30 && Y > 16 && Y < h - 50) ctx.fillText(n, X, Y - 14);
  }
}
// the 10-minute zones around each work place
function drawZones(ctx, anchors, ring) {
  for (const a of anchors) {
    ctx.strokeStyle = a.a.color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 6]);
    ctx.beginPath();
    ctx.arc(a.x, a.y, ring, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = a.a.color;
    ctx.beginPath();
    ctx.arc(a.x, a.y, ring, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = "500 10px Lexend, sans-serif";
    ctx.fillStyle = a.a.color;
    ctx.fillText("10 min from " + a.a.name, a.x, a.y - ring - 9);
  }
}
const radarHtml = a =>
  `<span class="radar" style="left:${a.x}px;top:${a.y}px;--c:${a.a.color}"></span><span class="radar r2" style="left:${a.x}px;top:${a.y}px;--c:${a.a.color}"></span>`;
const anchorHtml = a =>
  `<div class="anchor" style="left:${a.x}px;top:${a.y}px;--c:${a.a.color}"><div class="tag"><b>Work · ${esc(a.a.name)}</b><span>${esc(a.a.sub)}</span></div><div class="pinA"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg></div></div>`;
function markerHtml(p) {
  const l = p.l,
    pc = petClass(l),
    st = statusOf(l.id),
    v = markerVisible(l);
  const cls = [
    pc,
    SHORT.has(st) && "saved",
    !v && "dimmed",
    isNew(l) && "fresh",
    S.flash.has(l.id) && "flashm",
    (S.popId === l.id || S.sideId === l.id) && "on",
  ]
    .filter(Boolean)
    .join(" ");
  return `<button class="marker ${cls}" style="left:${p.x}px;top:${p.y}px" data-pop="${esc(l.id)}" aria-label="${esc(l.type + " in " + l.suburb + ", " + rand(l.price))}" ${v ? "" : 'tabindex="-1"'}>${ICON[pc]}</button>`;
}
function overlayHtml(pos, anchors, w, h) {
  const onScreen = p => p.x >= -20 && p.x <= w + 20 && p.y >= -20 && p.y <= h + 20;
  let html = anchors.map(radarHtml).join("") + anchors.map(anchorHtml).join("") + pos.filter(onScreen).map(markerHtml).join("");
  const pop = S.popId && pos.find(q => q.l.id === S.popId);
  if (pop) html += popHtml(pop, w, h);
  return html;
}
function renderMap(light) {
  const area = $("mapArea"),
    cv = $("map"),
    w = area.clientWidth,
    h = area.clientHeight;
  if (!w || !h) return;
  const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
  if (cv.width !== w * dpr || cv.height !== h * dpr) {
    cv.width = w * dpr;
    cv.height = h * dpr;
  }
  const ctx = cv.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  const G = geomNow(w, h),
    jz = Math.min(1, (1 / VIEW.z) * 1.6);
  const pos = activeAll().map(l => {
    const [jx, jy] = l.geo === "exact" ? [0, 0] : jit(l.id);
    return { l, x: G.x(l.lng) + jx * jz, y: G.y(l.lat) + jy * jz };
  });
  const anchors = Object.entries(ANCHORS).map(([k, a]) => ({ k, a, x: G.x(a.lng), y: G.y(a.lat) }));
  const ring = 4.94 * G.kmPx,
    vis = pos.filter(p => markerVisible(p.l));
  if (!light) drawHeat(ctx, w, h, vis, anchors, ring, Math.max(16, G.kmPx));
  drawRoads(ctx, G);
  drawRoadLabels(ctx, G, w, h);
  drawPlaces(ctx, G, w, h);
  drawZones(ctx, anchors, ring);
  $("overlay").innerHTML = overlayHtml(pos, anchors, w, h);
  $("dCount").textContent = `${vis.length} place${vis.length === 1 ? "" : "s"}`;
}
const statusBadge = st => (st === "new" ? "" : `<span class="status st-${st}">${STATUS_LABEL[st]}</span>`);
const heartLabel = st => (SHORT.has(st) ? "♥ Saved" : "♡ Interested");
function popHtml(p, w, h) {
  const l = p.l,
    st = statusOf(l.id),
    pc = petClass(l);
  let left = p.x + 20,
    top = p.y - 30;
  if (left + 270 > w) left = p.x - 280;
  if (top + 190 > h - 60) top = h - 250;
  top = Math.max(8, top);
  return `<div class="pop" style="left:${Math.max(8, left)}px;top:${top}px">
    <div class="ph"><span class="marker ${pc}" style="position:static;transform:none;width:18px;height:18px;box-shadow:none">${ICON[pc].replace(/width="(13|26)" height="(13|26)"/, 'width="11" height="11"')}</span>${esc(l.type)} · ${esc(l.suburb)}</div>
    <div class="row2"><span>${rand(l.price)} pm</span><span class="muted">${l.beds} bed · ${l.baths} bath</span></div>
    <div class="row2"><span class="muted">TecWise ~${l.min_tecwise} min</span><span class="muted">Drive ~${l.min_drive} min</span></div>
    <div class="row2"><span class="muted">${esc(petLabel(l))}</span>${statusBadge(st)}</div>
    <div class="act"><button class="btn small primary" data-side="${esc(l.id)}" title="Show this place in a side panel">Expand ⤢</button><button class="btn small" data-heart="${esc(l.id)}">${heartLabel(st)}</button><button class="btn small" data-closepop>Close</button></div>
  </div>`;
}
function zoomAt(f, cx, cy) {
  const nz = Math.max(0.7, Math.min(6, VIEW.z * f));
  const k = nz / VIEW.z;
  VIEW.tx = cx - (cx - VIEW.tx) * k;
  VIEW.ty = cy - (cy - VIEW.ty) * k;
  VIEW.z = nz;
  renderMap();
}
function schedule(light) {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => renderMap(light));
}
(function mapInput() {
  const area = $("mapArea");
  const pts = new Map();
  let pinch = null,
    moved = 0;
  area.addEventListener("pointerdown", e => {
    if (e.target.closest(".marker,.pop,.dock,.mapLegend,.mapSide")) return;
    area.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    moved = 0;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y) };
    }
  });
  const pinchTo = (a, b) => {
    const d = Math.hypot(a.x - b.x, a.y - b.y),
      r = area.getBoundingClientRect(),
      f = d / pinch.d;
    pinch.d = d;
    const nz = Math.max(0.7, Math.min(6, VIEW.z * f)),
      k = nz / VIEW.z,
      cx = (a.x + b.x) / 2 - r.left,
      cy = (a.y + b.y) / 2 - r.top;
    VIEW.tx = cx - (cx - VIEW.tx) * k;
    VIEW.ty = cy - (cy - VIEW.ty) * k;
    VIEW.z = nz;
    schedule(true);
  };
  area.addEventListener("pointermove", e => {
    if (!pts.has(e.pointerId)) return;
    const prev = pts.get(e.pointerId),
      cur = { x: e.clientX, y: e.clientY };
    pts.set(e.pointerId, cur);
    if (pts.size === 2 && pinch) {
      const [a, b] = [...pts.values()];
      pinchTo(a, b);
      return;
    }
    VIEW.tx += cur.x - prev.x;
    VIEW.ty += cur.y - prev.y;
    moved += Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
    if (moved > 3) {
      area.classList.add("dragging");
      schedule(true);
    }
  });
  const end = e => {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (pts.size < 2) pinch = null;
    if (pts.size) return;
    area.classList.remove("dragging");
    if (moved > 3) renderMap();
  };
  area.addEventListener("pointerup", end);
  area.addEventListener("pointercancel", end);
  area.addEventListener(
    "wheel",
    e => {
      if (e.target.closest(".mapSide,.pop")) return;
      e.preventDefault();
      const r = area.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.18 : 1 / 1.18, e.clientX - r.left, e.clientY - r.top);
    },
    { passive: false },
  );
})();

/* ---------- lower panels ---------- */
const BOARD_ROWS = [
  ["interested", "Interested"],
  ["contacted", "Contacted"],
  ["viewing", "Viewing"],
  ["applied", "Applied"],
  ["no", "Not for us"],
];
const boardDot = (l, k) =>
  `<button class="d ${k}" data-open="${esc(l.id)}" title="${esc(l.type + " · " + l.suburb + " · " + rand(l.price))}"></button>`;
function boardRow([k, lab], all) {
  const items = all.filter(l => statusOf(l.id) === k);
  const dots = items.map(l => boardDot(l, k)).join("") + '<span class="d"></span>'.repeat(Math.max(0, 22 - items.length * 2));
  return `<span class="rl">${lab} <span class="num" style="color:var(--fg)">${items.length}</span></span><div class="dots">${dots}</div>`;
}
function renderBoard() {
  const all = activeAll();
  const hint =
    all.length && all.every(l => statusOf(l.id) === "new")
      ? '<span></span><span class="muted" style="font-size:12px">Nothing marked yet. Tap ♡ Interested on a place and it lands here.</span>'
      : "";
  $("board").innerHTML = BOARD_ROWS.map(r => boardRow(r, all)).join("") + hint;
}
function renderTiles() {
  const all = activeAll(),
    n = all.length;
  const t = [
    ["ok", "Pet friendly", "var(--pet)", ICON.ok, all.filter(l => petClass(l) === "ok").length],
    [
      "no",
      "No cats / no pets",
      "var(--red)",
      '<svg width="14" height="14" viewBox="0 0 26 26"><path d="M13 3 24 22H2z" fill="#e5534b"/></svg>',
      all.filter(l => petClass(l) === "no").length,
    ],
    ["ask", "Pets: ask agent", "var(--purple)", ICON.ask, all.filter(l => petClass(l) === "ask").length],
    ["fibre", "Fibre mentioned", "var(--muted)", ICON.box, all.filter(fibreOk).length],
  ];
  $("tiles").innerHTML = t
    .map(
      ([k, lab, c, ic, v]) =>
        `<button class="tile" data-tile="${k}" aria-pressed="${S.tile === k}" data-glow data-glow-color="miami"><span class="glowInner" data-glow aria-hidden="true"></span><span class="t"><span style="color:${c};display:grid;place-items:center">${ic}</span>${lab}</span><span><span class="s">Places</span><br><span class="big num"><span data-count="t-${k}" data-to="${v}">${v}</span><small> / ${n}</small></span></span></button>`,
    )
    .join("");
}

/* ---------- places list ---------- */
function renderTabs() {
  const all = [...S.listings.values()];
  const live = l => l.active !== false;
  const tabs = [
    ["places", "All matching", listFor("places").length],
    ["shortlist", "Our shortlist", all.filter(l => live(l) && SHORT.has(statusOf(l.id))).length],
    ["new", "New today", all.filter(l => live(l) && isNew(l)).length],
    ["gone", "No longer listed", all.filter(l => !live(l)).length],
  ];
  $("tabs").innerHTML = tabs
    .map(
      ([k, t, c]) =>
        `<button class="pill tab" role="tab" aria-pressed="${S.tab === k}" aria-selected="${S.tab === k}" data-tab="${k}">${t}<span class="c num">${c}</span></button>`,
    )
    .join("");
}
// Re-rendering replaces textareas, so keep what's typed, the focus and the caret across it.
function grabTA(root) {
  const o = { vals: {}, focus: null, sel: null };
  if (!root) return o;
  root.querySelectorAll("textarea[data-key]").forEach(ta => {
    o.vals[ta.dataset.key] = ta.value;
    if (ta === document.activeElement) {
      o.focus = ta.dataset.key;
      o.sel = [ta.selectionStart, ta.selectionEnd];
    }
  });
  return o;
}
function putTA(root, o) {
  if (!root) return;
  root.querySelectorAll("textarea[data-key]").forEach(ta => {
    const k = ta.dataset.key;
    if (o.vals[k] != null) ta.value = o.vals[k];
    if (o.focus === k) {
      ta.focus();
      ta.setSelectionRange(o.sel[0], o.sel[1]);
    }
  });
  if (!S.editNote)
    root.querySelectorAll(".nList").forEach(nl => {
      nl.scrollTop = nl.scrollHeight;
    });
}
function rerenderNotes() {
  renderList();
  if (S.openId) renderDrawer();
}
function ago(iso) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (Number.isNaN(d) || d < 0) return "";
  if (d < 60) return "just now";
  if (d < 3600) return Math.round(d / 60) + " min ago";
  if (d < 86400) return Math.round(d / 3600) + " h ago";
  if (d < 86400 * 7) return Math.round(d / 86400) + " d ago";
  return new Date(iso).toLocaleDateString("en-ZA", { day: "numeric", month: "short" });
}
function whoIs(by) {
  if (!by) return "Someone";
  return S.me && by === S.me ? "You" : by;
}
function notesOf(id) {
  return (tr(id).log || []).slice().sort((a, b) => String(a.at).localeCompare(String(b.at)));
}
const EDIT_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>';
const DEL_ICON =
  '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
function noteActs(key, armed) {
  const del = armed ? "Delete?" : DEL_ICON + "Delete";
  const title = armed ? "Click again to delete" : "Delete this note",
    label = armed ? "Confirm delete" : "Delete this note";
  return `<span class="nActs"><button class="nAct" data-editnote="${esc(key)}" title="Edit this note" aria-label="Edit this note">${EDIT_ICON}Edit</button><button class="nAct del ${armed ? "armed" : ""}" data-delnote="${esc(key)}" title="${title}" aria-label="${label}">${del}</button></span>`;
}
function editedTag(n) {
  if (!n.edited) return "";
  const by = n.editedBy ? " by " + esc(whoIs(n.editedBy)) : "";
  return `<span class="nEdited" title="Edited ${esc(ago(n.edited))}${by}">· edited</span>`;
}
function noteClass(n) {
  const mine = n.by && n.by === S.me ? "mine" : "";
  if (S.freshNote !== n.id) return mine;
  return mine + " " + (S.freshKind === "edit" ? "shine" : "fresh");
}
function noteBody(key, n, editing) {
  if (!editing) return `<div class="nText">${esc(n.text)}</div>`;
  return `<div class="nEdit"><textarea data-key="edit:${esc(key)}" data-nedit="${esc(key)}" aria-label="Edit note">${esc(n.text)}</textarea><div class="row"><button class="btn small" data-canceledit="1">Cancel</button><button class="btn small primary" data-saveedit="${esc(key)}">Save</button></div></div>`;
}
function noteItem(id, n) {
  const key = id + "|" + n.id,
    editing = S.editNote === key,
    acts = editing ? "" : noteActs(key, S.delArm === key);
  return `<div class="nItem ${noteClass(n)}" data-nid="${esc(n.id)}"><div class="nMeta"><b>${esc(whoIs(n.by))}</b><span>${esc(ago(n.at))}</span>${editedTag(n)}
        ${acts}</div>
        ${noteBody(key, n, editing)}</div>`;
}
function notesBlock(id, where) {
  const log = notesOf(id);
  const items = log.length
    ? log.map(n => noteItem(id, n)).join("")
    : `<div class="nEmpty">No notes yet. Jot down what the agent said, viewing times, deposit, anything.</div>`;
  return `<div class="notesBox" data-notes="${esc(id)}">
    <div class="nList">${items}</div>
    <div class="nAdd"><textarea data-key="add:${esc(id)}" data-nin="${esc(id)}" data-where="${where}" rows="1" placeholder="Add a note…" title="Enter to save · Shift+Enter for a new line"></textarea><button class="btn small primary" data-addnote="${esc(id)}" data-where="${where}">Add</button></div>
  </div>`;
}
async function addNote(id, text) {
  text = text.trim();
  if (!text) return false;
  // the id goes to the server too, so a retry after a lost reply can't post the note twice
  const n = {
    id: "n" + Date.now().toString(36) + crypto.getRandomValues(new Uint32Array(1))[0].toString(36),
    by: S.me || null,
    at: new Date().toISOString(),
    text: text.slice(0, 2000),
  };
  S.freshNote = n.id;
  S.freshKind = "add";
  setTimeout(() => {
    if (S.freshNote === n.id) S.freshNote = null;
  }, 1500);
  return saveTrack(id, { log: [...(tr(id).log || []), n] }, { op: "note.add", nid: n.id, text: n.text });
}
const safeUrl = u => (/^https:\/\//i.test(u || "") ? esc(u) : "#");
const photosOf = l => (Array.isArray(l.photos) ? l.photos : []).filter(u => /^https:\/\//i.test(u)).slice(0, 12);
const photoImg = u => `<img class="lp" src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
document.addEventListener(
  "error",
  e => {
    const t = e.target;
    if (t.classList?.contains("lp")) (t.closest(".galThumb") || t).remove();
  },
  true,
); // hide broken photos
// Panel card in the "poster" style: a deep-blue upper block holding the photo (glowing purple frame) steps down
// into a lighter steel-blue lower block along a dark band and a thin circuit line; below sit the price tag, three
// meter bars and a bordered info box. Labels are darker blue, values glow light blue. One SVG (200x300 box) draws
// the shapes; the card keeps a 2:3 shape so the content boxes (same numbers, in %) line up with it.
const PET_SHORT = { "Pets OK": "OK", "No pets": "No", "Small pets OK": "Small", "Dogs only, no cats": "No cats", "Pets: ask": "Ask" };
// one of four designs, picked from the id so a place keeps its look across refreshes
const cardVariant = id => 1 + ([...id].reduce((h, ch) => (h * 31 + ch.codePointAt(0)) >>> 0, 7) % 4);
const pct = v => Math.round(Math.max(0.04, Math.min(1, v)) * 100);
const cardBar = (k, v, f) => `<div class="pcBar"><span class="micro">${k}</span><b>${v}</b><i><s style="width:${f}%"></s></i></div>`;
function cardKV(k, v, cls) {
  const c = cls ? ' class="' + cls + '"' : "";
  return `<span><em>${k}</em><b${c}>${v}</b></span>`;
}
function cardPlate(l, st) {
  const parts = [
    isNew(l) && '<span class="micro">New</span>',
    st !== "new" && `<span class="micro st-${st}">${STATUS_LABEL[st]}</span>`,
    l.note && '<span class="micro warn">Check note</span>',
  ].filter(Boolean);
  return parts.length ? `<span class="pcPlate">${parts.join("")}</span>` : "";
}
function cardWin(l, st) {
  const ph = photosOf(l);
  const img = ph.length ? `<img class="lp pcImg" src="${esc(ph[0])}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : "";
  const count = ph.length ? '<span class="pcCount micro">01 / ' + pad2(ph.length) + "</span>" : "";
  return `<div class="pcWin">
      ${img}
      <span class="pcEmpty micro">No photo yet</span><span class="pcShade"></span>
      ${cardPlate(l, st)}
      <span class="pcTicks"></span>
      ${count}
    </div>`;
}
function cardFacts(l) {
  const pc = petClass(l),
    pets = PET_SHORT[petLabel(l)] || petLabel(l);
  return (
    cardKV("Bed", l.beds) +
    cardKV("Bath", l.baths) +
    cardKV("Size", l.size_m2 ? l.size_m2 + "m²" : "—") +
    cardKV("Avail", esc(l.available || "Ask")) +
    cardKV("Pets", esc(pets), "pet-" + pc) +
    cardKV("Fibre", fibreOk(l) ? "Yes" : "Ask") +
    cardKV("Security", secOk(l) ? "Yes" : "Ask")
  );
}
function panelCard(l, i) {
  const st = statusOf(l.id),
    fav = SHORT.has(st),
    notes = (tr(l.id).log || []).length;
  const noteCount = notes ? '<span class="c">' + notes + "</span>" : "";
  return `<article class="pcard ${l.active === false ? "gone" : ""}" data-id="${esc(l.id)}" data-v="${cardVariant(l.id)}" tabindex="0" aria-label="${esc(l.type + " in " + l.suburb + ", " + rand(l.price) + " a month")}">
    <svg class="pcShape" viewBox="0 0 200 300" preserveAspectRatio="none" aria-hidden="true">
      <path class="o" d="M8 0H120L130 10H192L200 18V138L196 142V246L200 250V292L192 300H8L0 292V156L4 152V116L0 112V8Z"/><path class="u" d="M8 0H120L130 10H192L200 18V138L196 142V204H150L140 214H60L50 204H0V156L4 152V116L0 112V8Z"/><path class="d" d="M46 204H60L68 212H138L148 202H196V212H152L142 222H64L54 212H46Z"/>
      <path class="c" d="M28 198H48L58 208H136L148 196H184"/><circle class="cd" cx="28" cy="198" r="1.6"/><circle class="cd" cx="184" cy="196" r="1.6"/>
      <path class="t" d="M0 226L8 232V276L0 282Z"/><path class="w" d="M14 96H110L118 104H186V180L176 190H24L14 180Z"/>
      <g class="x"><circle cx="10" cy="11" r="3"/><path d="M10 5.5v11M4.5 11h11"/></g>
      <g class="xb"><path d="M12 276h12v12H12zM12 276l12 12M24 276l-12 12"/><path d="M176 276h12v12h-12zM176 276l12 12M188 276l-12 12"/></g>
    </svg>
    <span class="pcGrain"></span>
    ${cardWin(l, st)}
    <div class="pcHead"><div class="pcRow"><span class="pcNo micro"><b>${pad2(i + 1)}</b>${esc(l.type)}</span><span class="pcDate micro">${esc(l.first_seen || "")}</span></div>
      <h3>${esc(l.suburb)}</h3><div class="pcWhere micro">${esc(l.address || "Address on request")}</div></div>
    <span class="pcTab micro">${esc(l.source)}</span>
    <div class="pcPriceTag"><i class="pcHatch"></i><span class="pcPrice num">${rand(l.price)}</span><span class="micro">per month</span></div>
    <div class="pcBars">
      ${cardBar("Rent", pct(l.price / 16000) + "%", pct(l.price / 16000))}${cardBar("TecWise", "~" + l.min_tecwise + "m", pct(1 - l.min_tecwise / 20))}${cardBar("Drive", "~" + l.min_drive + "m", pct(1 - l.min_drive / 20))}
    </div>
    <div class="pcBox">
      <div class="pcKV">${cardFacts(l)}</div>
    </div>
    <div class="pcFoot">
      <button class="pcHeart" data-heart="${esc(l.id)}" aria-pressed="${fav}" aria-label="${fav ? "Remove from shortlist" : "Add to shortlist"}">${fav ? "♥" : "♡"}</button>
      <button class="nBtn" data-opennotes="${esc(l.id)}" title="Notes"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>Notes${noteCount}</button>
    </div>
  </article>`;
}
const EMPTY_WHY = {
  shortlist: "Tap ♡ Interested on a place to add it to your shortlist.",
  new: "Nothing new came in on the last search.",
  gone: "Every place is still listed.",
};
const emptyView = (title, text) => `<div class="empty"><h3>${title}</h3>${text}</div>`;
function renderList() {
  const view = $("view");
  if (!S.session) {
    view.innerHTML = emptyView(
      "Sign in to see the places",
      'This list is private. <button class="btn small primary" data-signin>Sign in with Google</button>',
    );
    return;
  }
  if (!S.lastSync) {
    view.innerHTML = emptyView("Loading the shared list…", "Places, saved marks and notes appear once the server answers.");
    return;
  }
  if (!S.listings.size) {
    view.innerHTML = emptyView("No places yet", "The 6pm search adds places here every evening.");
    return;
  }
  const arr = listFor(S.tab);
  if (!arr.length) {
    view.innerHTML = emptyView(
      "Nothing to show",
      EMPTY_WHY[S.tab] || "No places match these filters. Try a higher max, another area, or switch a filter off.",
    );
    return;
  }
  const kept = grabTA(view),
    enter = !S.listShown;
  S.listShown = true;
  view.innerHTML = `<div class="pGrid ${enter ? "enter" : ""}">${arr.map((l, i) => panelCard(l, i)).join("")}</div>`;
  view.querySelectorAll(".pcard").forEach((c, i) => {
    c.style.setProperty("--i", Math.min(i, 30));
    if (S.flash.has(c.dataset.id)) c.classList.add("flash");
    if (S.openId === c.dataset.id) c.classList.add("launch");
  });
  putTA(view, kept);
}
function renderHeader() {
  if (!S.session) {
    $("updated").textContent = "Private list · sign in to see the places";
    return;
  }
  if (S.meta.last_run) {
    $("updated").innerHTML =
      `Data from the <span class="num">${esc(S.meta.last_run)}</span> search · 3 bed · 2 bath · ≤ R16 000 · within ~10 min of TecWise or Drive`;
    return;
  }
  $("updated").textContent = S.loaded ? "No search results yet" : "Loading listings…";
}
// shared by the side panel and the dossier
const tierTag = l => (l.tier === "nearby" ? " · just outside" : "");
const waLink = (phone, msg) => (intl(phone) ? `https://wa.me/${intl(phone)}?text=${encodeURIComponent(msg)}` : "");
const statusButtons = (attr, st) => STATUSES.map(([k, v]) => `<button data-${attr}="${k}" aria-pressed="${st === k}">${v}</button>`).join("");
function factsHtml(l, fibreText) {
  const pc = petClass(l);
  const fibre = fibreOk(l) ? `<span class="fact teal">${fibreText}</span>` : '<span class="fact ask">Fibre: ask</span>';
  const sec = secOk(l) ? '<span class="fact">Security</span>' : '<span class="fact ask">Security: ask</span>';
  return `<span class="fact ${pc === "ask" ? "pet-ask" : pc}">${petLabel(l)}</span>${fibre}${sec}`;
}
function sideExtras(l) {
  const avail = l.available ? '<span class="fact">Available <b>' + esc(l.available) + "</b></span>" : "";
  const size = l.size_m2 ? '<span class="fact"><b>' + l.size_m2 + "</b> m²</span>" : "";
  return avail + size;
}
function sideContact(l, phone) {
  const agent = l.agent ? " · " + esc(l.agent) : "";
  const num = phone
    ? `<div class="num" style="margin-top:2px">${esc(prettyPhone(phone))}</div>`
    : '<div class="muted" style="font-size:12px;margin-top:2px">No number yet. Open the listing, tap "Show number", then add it under Full details.</div>';
  return `<div><div class="label" style="margin-bottom:6px">Contact</div><div>${esc(l.agency || "Agency not shown")}${agent}</div>${num}</div>`;
}
function renderSide() {
  const box = $("mapSide"),
    l = S.sideId && S.listings.get(S.sideId);
  $("mapArea").classList.toggle("withSide", !!l);
  if (!l) {
    box.hidden = true;
    box.innerHTML = "";
    return;
  }
  const st = statusOf(l.id),
    t = tr(l.id),
    phone = phoneOf(l),
    wa = waLink(phone, fillTemplate(l));
  const summary = l.summary ? `<div>${esc(l.summary)}</div>` : '<div class="muted">No description saved yet. Open the listing for the full ad.</div>';
  const note = l.note ? `<div class="banner">${esc(l.note)}</div>` : "";
  const ours = t.note ? `<div><div class="label" style="margin-bottom:6px">Our notes</div><div class="note">${esc(t.note)}</div></div>` : "";
  const waBtn = wa ? `<a class="btn small wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>` : "";
  box.hidden = false;
  box.innerHTML = `<div class="sh"><div style="min-width:0"><div class="label">${esc(l.source)}${tierTag(l)}</div><h3>${esc(l.type)} · ${esc(l.suburb)}</h3><div class="muted" style="font-size:12px">${esc(l.address || "Address on request")}</div></div>
      <button class="iconbtn" data-closeside aria-label="Close panel">×</button></div>
    <div class="sb">
      <div class="grid2">
        <div class="cell"><div class="k">Rent</div><div class="v num">${rand(l.price)}</div></div>
        <div class="cell"><div class="k">Size</div><div class="v num">${l.beds} bed · ${l.baths} bath</div></div>
        <div class="cell"><div class="k">To TecWise</div><div class="v num" style="color:#00F0FF">~${l.min_tecwise} min</div></div>
        <div class="cell"><div class="k">To Drive</div><div class="v num" style="color:#FF5CA8">~${l.min_drive} min</div></div>
      </div>
      <div class="facts">${factsHtml(l, "Fibre")}${sideExtras(l)}</div>
      ${summary}
      ${note}
      <div><div class="label" style="margin-bottom:6px">Where we are with it</div><div class="statusPick">${statusButtons("sidestatus", st)}</div></div>
      ${sideContact(l, phone)}
      ${ours}
      <div class="row"><a class="btn small" href="${safeUrl(l.url)}" target="_blank" rel="noopener">Open listing</a>${waBtn}<a class="btn small" href="${safeUrl(l.maps_url)}" target="_blank" rel="noopener">Google Maps</a></div>
    </div>
    <div class="sf"><button class="btn primary" data-open="${esc(l.id)}">Full details ⤢</button><button class="btn" data-heart="${esc(l.id)}">${heartLabel(st)}</button></div>`;
}
function render() {
  renderHeader();
  renderCharts();
  renderGauges();
  renderMap();
  renderBoard();
  renderTiles();
  renderTabs();
  renderList();
  renderSide();
  if (S.openId) renderDrawer();
  countUps();
}

/* ---------- drawer ---------- */
function fillTemplate(l) {
  const tpl = S.settings.template || DEFAULT_TEMPLATE,
    first = (l.agent || "").split(" ")[0];
  const vals = {
    agent: first || "there",
    beds: l.beds,
    type: (l.type || "place").toLowerCase(),
    suburb: l.suburb,
    price: rand(l.price).slice(1),
    link: l.url,
  };
  return tpl.replaceAll(/\{(agent|beds|type|suburb|price|link)\}/g, (m, k) => String(vals[k]));
}
// Swap just the gallery's photo, count and thumbnail state (a full re-render would drop typed text and focus).
function showGal(ph) {
  const g = $("drawer").querySelector(".gal");
  if (!g) return;
  const i = S.galIdx || 0,
    main = g.querySelector(".galMain");
  const img = document.createElement("img");
  img.className = "lp";
  img.alt = "";
  img.decoding = "async";
  img.referrerPolicy = "no-referrer";
  img.src = ph[i];
  const old = main.querySelector("img.lp");
  if (old) old.replaceWith(img);
  else main.prepend(img);
  const c = g.querySelector(".galCount");
  if (c) c.textContent = `${pad2(i + 1)} / ${pad2(ph.length)}`;
  g.querySelectorAll("[data-gal]").forEach((b, k) => b.setAttribute("aria-pressed", String(k === i)));
}
const hashId = id => id.replaceAll(/[^\w.~-]/g, "_");
function setHash(h) {
  try {
    history.replaceState(null, "", h);
  } catch (e) {
    console.warn("[rental] couldn't update the address bar", e);
  }
}
const cardFor = id => document.querySelector(`#view .pcard[data-id="${CSS.escape(id)}"]`);
function openDrawer(id) {
  const d = $("drawer");
  S.openId = id;
  S.popId = null;
  S.galIdx = 0;
  d.classList.remove("closing");
  document.querySelectorAll("#view .pcard.launch").forEach(c => c.classList.remove("launch"));
  $("scrim").hidden = false;
  d.hidden = false;
  renderDrawer(true);
  renderMap();
  cardFor(id)?.classList.add("launch");
  d.classList.remove("opening");
  reflow(d);
  d.classList.add("opening");
  // drop the class once powered up, so re-renders of the drawer don't replay the HUD corners
  setTimeout(() => {
    if (S.openId === id) d.classList.remove("opening");
  }, 950);
  setHash("#" + hashId(id));
}
function closeDrawer() {
  const d = $("drawer"),
    id = S.openId;
  if (!id) {
    d.hidden = true;
    $("scrim").hidden = true;
    return;
  }
  S.openId = null;
  setHash(location.pathname + location.search);
  const done = () => {
    if (S.openId) return;
    d.hidden = true;
    d.classList.remove("closing", "opening");
    $("scrim").hidden = true;
    cardFor(id)?.classList.remove("launch");
  };
  if (calmNow() || d.hidden) {
    done();
    return;
  }
  d.classList.remove("opening");
  d.classList.add("closing");
  setTimeout(done, 360);
}
const galThumb = (u, k, gi) =>
  `<button class="galThumb" data-gal="${k}" aria-pressed="${k === gi}" aria-label="Photo ${k + 1}"><img class="lp" src="${esc(u)}" alt="" loading="lazy" referrerpolicy="no-referrer"></button>`;
function galleryHtml(ph, gi) {
  if (!ph.length) return '<div class="gal galNone"><span class="micro">No photos yet · the nightly search adds them</span></div>';
  const many = ph.length > 1;
  const nav = many
    ? '<button class="galNav prev" data-galstep="-1" aria-label="Previous photo">‹</button><button class="galNav next" data-galstep="1" aria-label="Next photo">›</button>'
    : "";
  const thumbs = many ? `<div class="galThumbs">${ph.map((u, k) => galThumb(u, k, gi)).join("")}</div>` : "";
  return `<div class="gal"><div class="galMain">${photoImg(ph[gi])}
      ${nav}
      <span class="micro galCount">${pad2(gi + 1)} / ${pad2(ph.length)}</span></div>
      ${thumbs}</div>`;
}
const hudHtml = l => `<div class="hud" aria-hidden="true"><i class="hc tl"></i><i class="hc tr"></i><i class="hc bl"></i><i class="hc br"></i>
     <i class="hd tl"></i><i class="hd tr"></i><i class="hd bl"></i><i class="hd br"></i><i class="hbar hb1"></i><i class="hbar hb2"></i>
     <i class="hplus p1"></i><i class="hplus p2"></i><i class="hplus p3"></i><span class="hbarcode"></span>
     <span class="micro hcode hc1">REF · ${esc(l.id)}</span><span class="micro hcode hc2">${esc(l.first_seen || "")} · ${esc(l.source)}</span></div>`;
function drawerHead(l) {
  const dep = l.deposit ? " · deposit " + esc(l.deposit) : "";
  return `<div class="dHead"><div style="min-width:0"><div class="label">${esc(l.source)}${tierTag(l)}</div><h2 id="dTitle">${esc(l.type)} in ${esc(l.suburb)}</h2>
     <div class="muted" style="margin-top:2px;font-size:13px">${esc(l.address || "Address on request")}</div>
     <div class="price num" style="margin-top:8px">${rand(l.price)}<small> pm${dep}</small></div></div>
     <button class="iconbtn x" id="dClose" aria-label="Close">×</button></div>`;
}
function statusSec(t, st) {
  let changed = "";
  if (t.updatedBy) {
    const when = t.updatedAt ? " · " + new Date(t.updatedAt).toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" }) : "";
    changed = `<div class="muted" style="font-size:11px">Last changed by ${esc(whoIs(t.updatedBy))}${when}</div>`;
  }
  return `<div class="sec"><div class="label">Where we are with it</div>
       <div class="statusPick">${statusButtons("status", st)}</div>
       ${changed}</div>`;
}
const mailtoHref = (l, email, msg) =>
  `mailto:${esc(email)}?subject=${encodeURIComponent("Rental enquiry: " + l.beds + "-bed " + l.type + " in " + l.suburb)}&body=${encodeURIComponent(msg)}`;
function copyRow(phone, email) {
  if (!phone) return "";
  const em = email ? ` · <span style="color:var(--fg)">${esc(email)}</span> <button class="btn small" data-copy="${esc(email)}">Copy</button>` : "";
  return `<div class="muted" style="font-size:12px">Number <span class="num" style="color:var(--fg)">${esc(prettyPhone(phone))}</span> <button class="btn small" data-copy="${esc(prettyPhone(phone))}">Copy</button>${em}</div>`;
}
function contactSec(l, phone, email, msg, keep) {
  const wa = waLink(phone, msg);
  const office = l.phone_work ? `<dt>Office</dt><dd class="num">${esc(prettyPhone(l.phone_work))}</dd>` : "";
  const hint = phone
    ? ""
    : '<div class="muted" style="font-size:12px">The site hides the number behind "Show number". Open the listing, tap it, then paste the number here so you both have it.</div>';
  const tel = phone ? "tel:" + intl(phone).replace(/^27/, "0") : "#";
  const mail = email ? mailtoHref(l, email, msg) : "#";
  return `<div class="sec"><div class="label">Contact</div>
       <dl class="kv"><dt>Agency</dt><dd>${esc(l.agency || "Not shown on listing")}</dd><dt>Agent</dt><dd>${esc(l.agent || "Not shown on listing")}</dd>${office}</dl>
       <div class="row">
         <div class="field" style="flex:1 1 160px"><label class="label" for="dPhone">Phone / WhatsApp</label><input id="dPhone" inputmode="tel" placeholder="e.g. 082 123 4567" value="${esc(keep.dPhone ?? prettyPhone(phone))}"></div>
         <div class="field" style="flex:1 1 200px"><label class="label" for="dEmail">Email</label><input id="dEmail" type="email" placeholder="agent@agency.co.za" value="${esc(keep.dEmail ?? email)}"></div></div>
       ${hint}
       <div class="row">
         <a class="btn wa" href="${wa || "#"}" target="_blank" rel="noopener" aria-disabled="${!wa}">WhatsApp</a>
         <a class="btn" href="${tel}" aria-disabled="${!phone}">Call</a>
         <a class="btn" href="${mail}" aria-disabled="${!email}">Email</a>
         <a class="btn primary" href="${safeUrl(l.url)}" target="_blank" rel="noopener">Open listing</a></div>
       ${copyRow(phone, email)}
     </div>`;
}
function messageSec(msg, wa) {
  const send = wa ? `<a class="btn wa" href="${wa}" target="_blank" rel="noopener">Send on WhatsApp</a>` : "";
  return `<div class="sec"><div class="label">Message for this place</div><div class="msg" id="dMsg">${esc(msg)}</div>
       <div class="row"><button class="btn" id="dCopyMsg">Copy message</button>${send}</div></div>`;
}
function originOf(l) {
  if (l.geo === "exact") return encodeURIComponent(l.lat + "," + l.lng);
  const street = l.address ? l.address + ", " : "";
  return encodeURIComponent(street + l.suburb + ", Centurion");
}
const priceLine = p => `${esc(p.date)}: ${rand(p.price)}`;
const routeBtn = (origin, k) => `<a class="btn" href="${routeTo(origin, k)}" target="_blank" rel="noopener">Route to ${esc(ANCHORS[k].name)}</a>`;
function detailsSec(l) {
  const size = l.size_m2 ? ` · <span class="num">${l.size_m2}</span> m²` : "";
  const hist = (l.price_history || []).length > 1 ? `<dt>Price history</dt><dd class="num">${l.price_history.map(priceLine).join("<br>")}</dd>` : "";
  const summary = l.summary ? `<p style="margin:0;font-size:13px">${esc(l.summary)}</p>` : "";
  const note = l.note ? `<div class="banner">${esc(l.note)}</div>` : "";
  const dupes = (l.dupes || []).length ? '<div class="muted" style="font-size:11px">Also listed on another site.</div>' : "";
  const origin = originOf(l),
    routes = ["drive", "tecwise"]
      .filter(k => ANCHORS[k])
      .map(k => routeBtn(origin, k))
      .join("");
  return `<div class="sec"><div class="label">Details</div>
       <div class="facts">${factsHtml(l, "Fibre " + esc(l.fibre))}</div>
       <dl class="kv"><dt>Size</dt><dd><span class="num">${l.beds}</span> bed · <span class="num">${l.baths}</span> bath${size}</dd>
         <dt>Available</dt><dd>${esc(l.available || "Ask")}</dd><dt>Security</dt><dd>${esc(l.security || "Not described")}</dd><dt>Pets</dt><dd>${esc(l.pets || "unknown")}</dd>
         <dt>Drive time</dt><dd>TecWise ~<span class="num">${l.min_tecwise}</span> min · Drive ~<span class="num">${l.min_drive}</span> min <span class="muted">(estimate)</span></dd>
         <dt>First seen</dt><dd class="num">${esc(l.first_seen || "")}</dd>
         ${hist}</dl>
       ${summary}
       ${note}
       ${dupes}
       <div class="row"><a class="btn" href="${safeUrl(l.maps_url)}" target="_blank" rel="noopener">Open in Google Maps</a>
         ${routes}</div></div>`;
}
const ourNotesSec = (t, keep) => `<div class="sec"><div class="label">Our notes</div>
       <div class="field"><label class="label" for="dView">Viewing date / time</label><input id="dView" placeholder="e.g. Sat 18 Oct, 10:00" value="${esc(keep.dView ?? (t.viewing || ""))}"></div>
       <div class="field"><label class="label" for="dNote">Notes</label><textarea id="dNote" placeholder="What did the agent say? What did we like?">${esc(keep.dNote ?? (t.note || ""))}</textarea></div>
       <div class="row"><button class="btn primary" id="dSave">Save contact &amp; notes</button><span class="saved" id="dSavedMsg"></span></div></div>`;
function renderDrawer(first) {
  const l = S.listings.get(S.openId);
  if (!l) {
    closeDrawer();
    return;
  }
  const dr = $("drawer"),
    t = tr(l.id),
    phone = phoneOf(l),
    msg = fillTemplate(l);
  const activeId = document.activeElement?.closest?.("#drawer") ? document.activeElement.id : null;
  const keep = {};
  ["dPhone", "dEmail", "dNote", "dView"].forEach(k => {
    const el = $(k);
    if (el && el === document.activeElement) keep[k] = el.value;
  });
  const kept = grabTA(dr),
    ph = photosOf(l),
    gi = Math.min(S.galIdx || 0, Math.max(0, ph.length - 1));
  dr.innerHTML = `
   ${hudHtml(l)}
   ${drawerHead(l)}
   <div class="dBody">
     ${galleryHtml(ph, gi)}
     ${statusSec(t, statusOf(l.id))}
     ${contactSec(l, phone, emailOf(l), msg, keep)}
     ${messageSec(msg, waLink(phone, msg))}
     ${detailsSec(l)}
     ${ourNotesSec(t, keep)}
     <div class="sec"><div class="label">Notes log · who said what</div>${notesBlock(l.id, "drawer")}</div>
   </div>`;
  if (activeId) $(activeId)?.focus();
  putTA(dr, kept);
  if (first) $("dClose").focus();
}
// Shows the change straight away, sends one op to the save helper, then swaps in what the server kept.
// body defaults to {op:"set", fields:patch}; notes pass their own op. Server-side ops mean two people
// saving at once never overwrite each other.
async function postOp(payload) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await fetch(CFG.workerUrl + "/op", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
    } catch (e) {
      console.warn("[rental] save attempt failed", e);
      if (attempt === 0) await new Promise(res => setTimeout(res, 700));
    }
  }
  return null;
}
// what to say when the save helper turns a session away: [toast, home-screen message]
const DENIED = {
  401: ["Please sign in again", "Your sign-in expired. Please sign in again."],
  403: ["You're not on the invite list any more", "You're not on the invite list any more. Ask Dieter to add you."],
};
async function saveTrack(id, patch, body) {
  if (!S.session) {
    openWho("Sign in to save changes.");
    return false;
  }
  const sess = S.session,
    prev = tr(id);
  S.track.set(id, plain({ ...prev, ...patch, updatedAt: new Date().toISOString(), updatedBy: S.me }));
  render();
  S.busy.set(id, (S.busy.get(id) || 0) + 1);
  const undo = msg => {
    if (S.busy.get(id) === 1) S.track.set(id, prev);
    S.savedAt.delete(id);
    S.dataSha = null;
    render();
    toast(msg, "error");
    return false;
  };
  try {
    const r = await postOp(plain({ id, ...(body || { op: "set", fields: patch }) }));
    if (S.session !== sess) return false; // signed out while this was on its way
    if (!r) return undo("Couldn't reach the save helper. Check your connection and try again.");
    const denied = DENIED[r.status];
    if (denied) {
      undo(denied[0]);
      signOut(denied[1]);
      return false;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.entry) return undo(`Couldn't save: ${j.error || "error " + r.status}`);
    if (S.busy.get(id) === 1) S.track.set(id, j.entry);
    S.savedAt.set(id, Date.now());
    S.lastSync = Date.now();
    updSync();
    render();
    return true;
  } finally {
    const left = S.busy.get(id) - 1;
    if (left) S.busy.set(id, left);
    else S.busy.delete(id);
  }
}
async function copy(text) {
  try {
    await navigator.clipboard.writeText(text);
    toast("Copied", "copy");
  } catch (e) {
    console.warn("[rental] clipboard blocked", e);
    toast("Select the text and copy it", "error");
  }
}

/* ---------- events: one click listener, first matching selector wins (a handler returns SKIP to pass) ---------- */
const SKIP = Symbol("skip");
async function onHeart(heart, e) {
  e.stopPropagation();
  const id = heart.dataset.heart,
    was = SHORT.has(statusOf(id)),
    rc = heart.getBoundingClientRect();
  if (was) puff(rc);
  else hearts(rc);
  if (!(await saveTrack(id, { status: was ? "new" : "interested" }))) return;
  const now = SHORT.has(statusOf(id));
  toast(now ? "Added to your shortlist" : "Removed from shortlist", now ? "like" : "unlike");
}
async function onAddNote(an, e) {
  e.stopPropagation();
  const ta = an.closest(".notesBox")?.querySelector("textarea[data-nin]");
  if (!ta) return;
  const v = ta.value;
  if (!v.trim()) {
    ta.focus();
    return;
  }
  ta.value = "";
  if (await addNote(an.dataset.addnote, v)) {
    noteAdded(an.getBoundingClientRect());
    toast("Note saved for both of you", "note");
  } else ta.value = v;
}
function armDelete(key) {
  S.delArm = key;
  clearTimeout(S.delT);
  S.delT = setTimeout(() => {
    if (S.delArm === key) {
      S.delArm = null;
      rerenderNotes();
    }
  }, 3500);
  rerenderNotes();
}
async function onDelNote(dn, e) {
  e.stopPropagation();
  const key = dn.dataset.delnote,
    [id, nid] = key.split("|");
  if (S.delArm !== key) {
    armDelete(key);
    return;
  }
  S.delArm = null;
  const item = dn.closest(".nItem"),
    log = (tr(id).log || []).filter(n => n.id !== nid);
  noteDeleted((item || dn).getBoundingClientRect());
  if (item && !calmNow()) {
    item.classList.add("nGone");
    await new Promise(r => setTimeout(r, 380));
  }
  if (await saveTrack(id, { log }, { op: "note.delete", nid })) toast("Note deleted", "del");
}
function onEditNote(ed, e) {
  e.stopPropagation();
  S.editNote = ed.dataset.editnote;
  S.delArm = null;
  rerenderNotes();
  const ta = document.querySelector(`textarea[data-nedit="${CSS.escape(S.editNote)}"]`);
  if (ta) {
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }
}
function onCancelEdit(_, e) {
  e.stopPropagation();
  S.editNote = null;
  rerenderNotes();
}
async function onSaveEdit(se, e) {
  e.stopPropagation();
  const key = se.dataset.saveedit,
    [id, nid] = key.split("|"),
    ta = se.closest(".nEdit").querySelector("textarea"),
    v = (ta?.value || "").trim();
  if (!v) {
    ta?.focus();
    toast("A note can't be empty. Use Delete to remove it.", "error");
    return;
  }
  const text = v.slice(0, 2000);
  const log = (tr(id).log || []).map(n => (n.id === nid ? { ...n, text, edited: new Date().toISOString(), editedBy: S.me || null } : n));
  const rc = se.getBoundingClientRect();
  S.editNote = null;
  S.freshNote = nid;
  S.freshKind = "edit";
  setTimeout(() => {
    if (S.freshNote === nid) S.freshNote = null;
  }, 1500);
  noteEdited(rc);
  if (await saveTrack(id, { log }, { op: "note.edit", nid, text })) toast("Note updated", "edit");
}
function focusNotes(id) {
  if (S.openId !== id) return;
  const n = $("drawer").querySelector(".notesBox");
  if (!n) return;
  n.scrollIntoView({ block: "start", behavior: calmNow() ? "auto" : "smooth" });
  n.querySelector("textarea[data-nin]")?.focus({ preventScroll: true });
}
function onOpenNotes(on, e) {
  e.stopPropagation();
  const id = on.dataset.opennotes;
  openDrawer(id);
  clearTimeout(S.notesT);
  S.notesT = setTimeout(() => focusNotes(id), 800);
}
function onGal(gs) {
  if (!S.openId) return SKIP;
  const ph = photosOf(S.listings.get(S.openId) || {}),
    n = ph.length;
  if (!n) return;
  S.galIdx = gs.dataset.gal == null ? ((S.galIdx || 0) + +gs.dataset.galstep + n) % n : +gs.dataset.gal;
  showGal(ph);
}
function onPop(pop) {
  S.popId = S.popId === pop.dataset.pop ? null : pop.dataset.pop;
  renderMap();
}
function onClosePop() {
  S.popId = null;
  renderMap();
}
function onSide(sd) {
  S.sideId = sd.dataset.side;
  S.popId = null;
  renderMap();
  renderSide();
}
function onCloseSide() {
  S.sideId = null;
  renderSide();
  renderMap();
}
async function setStatus(id, el, st) {
  sparkle(el.getBoundingClientRect(), st);
  if (await saveTrack(id, { status: st })) toast("Marked " + STATUS_LABEL[st].toLowerCase(), st);
}
const onSideStatus = ss => (S.sideId ? setStatus(S.sideId, ss, ss.dataset.sidestatus) : SKIP);
const onStatus = sp => (S.openId ? setStatus(S.openId, sp, sp.dataset.status) : SKIP);
function onTab(tab) {
  S.tab = tab.dataset.tab;
  store.set("tab", S.tab);
  render();
}
function onJump(j) {
  S.tab = j.dataset.jump;
  render();
  $("placesSec").scrollIntoView({ behavior: "smooth", block: "start" });
}
function onTile(tile) {
  S.tile = S.tile === tile.dataset.tile ? null : tile.dataset.tile;
  render();
}
const onCard = (c, e) => (e.target.closest("a,button") ? SKIP : openDrawer(c.dataset.id));
async function onSaveDetails() {
  if (!S.openId) return SKIP;
  const v = id => $(id).value.trim();
  const ok = await saveTrack(S.openId, { phone: v("dPhone"), email: v("dEmail"), note: v("dNote"), viewing: v("dView") });
  if (ok && $("dSavedMsg")) $("dSavedMsg").textContent = "Saved for both of you";
}
function onToggle(tog) {
  tog.setAttribute("aria-pressed", String(!pressed(tog.id)));
  store.set(tog.id, tog.getAttribute("aria-pressed"));
  render();
}
function onZoom(zb) {
  const a = $("mapArea");
  if (zb.id === "zReset") {
    VIEW.z = 1;
    VIEW.tx = 0;
    VIEW.ty = 0;
    renderMap();
  } else zoomAt(zb.id === "zIn" ? 1.35 : 1 / 1.35, a.clientWidth / 2, a.clientHeight / 2);
}
const DOCK = { dAll: "all", dOk: "ok", dSaved: "saved" };
function onDock(dk) {
  S.mapMode = DOCK[dk.id];
  Object.keys(DOCK).forEach(i => $(i).setAttribute("aria-pressed", String(i === dk.id)));
  renderMap();
}
const CLICKS = [
  ["[data-heart]", onHeart],
  ["[data-addnote]", onAddNote],
  ["[data-delnote]", onDelNote],
  ["[data-editnote]", onEditNote],
  ["[data-canceledit]", onCancelEdit],
  ["[data-saveedit]", onSaveEdit],
  [".notesBox", () => {}],
  ["[data-signin]", () => openWho("")],
  ["[data-opennotes]", onOpenNotes],
  ["[data-gal],[data-galstep]", onGal],
  ["[data-open]", el => openDrawer(el.dataset.open)],
  ["[data-pop]", onPop],
  ["[data-closepop]", onClosePop],
  ["[data-side]", onSide],
  ["[data-closeside]", onCloseSide],
  ["[data-sidestatus]", onSideStatus],
  ["[data-tab]", onTab],
  ["[data-jump]", onJump],
  ["[data-tile]", onTile],
  [".pcard", onCard],
  ["#dClose,#scrim", () => closeDrawer()],
  ["[data-status]", onStatus],
  ["[data-copy]", cp => copy(cp.dataset.copy)],
  ["#dCopyMsg", () => copy($("dMsg").textContent)],
  ["#dSave", onSaveDetails],
  ["#tFibre,#tSec,#tHide", onToggle],
  ["#zIn,#zOut,#zReset", onZoom],
  ["#dAll,#dOk,#dSaved", onDock],
];
document.addEventListener("click", async e => {
  for (const [sel, fn] of CLICKS) {
    const m = e.target.closest(sel);
    if (m && (await fn(m, e)) !== SKIP) return;
  }
});
const plainEnter = e => e.key === "Enter" && !e.shiftKey && !e.isComposing;
function onNoteEditKey(e, et) {
  if (plainEnter(e)) {
    e.preventDefault();
    et.closest(".nEdit").querySelector("[data-saveedit]")?.click();
  } else if (e.key === "Escape") {
    e.preventDefault();
    e.stopPropagation();
    S.editNote = null;
    rerenderNotes();
  }
}
function onEscape() {
  if (S.openId) closeDrawer();
  else if (S.popId) {
    S.popId = null;
    renderMap();
  } else if (S.sideId) {
    S.sideId = null;
    renderSide();
    renderMap();
  }
}
document.addEventListener("keydown", e => {
  const t = e.target,
    et = t.closest?.("textarea[data-nedit]");
  if (et) {
    onNoteEditKey(e, et);
    return;
  }
  const ta = t.closest?.("textarea[data-nin]");
  if (ta && e.key === "Enter") {
    if (plainEnter(e)) {
      e.preventDefault();
      ta.closest(".notesBox").querySelector("[data-addnote]")?.click();
    }
    return;
  }
  if (e.key === "Escape") onEscape();
  if (e.key === "Enter" && t.classList?.contains("pcard")) openDrawer(t.dataset.id);
});
["fArea", "fMax", "fPets", "sort"].forEach(id =>
  $(id).addEventListener("change", () => {
    store.set(id, $(id).value);
    render();
  }),
);
$("q").addEventListener("input", () => render());
let rz;
globalThis.addEventListener("resize", () => {
  clearTimeout(rz);
  rz = setTimeout(renderMap, 120);
});

/* ---------- motion helpers ---------- */
const RM_SYS = !!globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
const calmNow = () => RM_SYS || document.documentElement.classList.contains("calm");
const PAL = ["#FF5CA8", "#BC6CFF", "#00F0FF", "#FFB86B"];
function fx(char, x, y, o) {
  const e = document.createElement("span");
  e.className = "fx";
  e.textContent = char;
  e.style.left = x + "px";
  e.style.top = y + "px";
  e.style.color = o.c;
  e.style.setProperty("--dx", o.dx + "px");
  e.style.setProperty("--dy", o.dy + "px");
  e.style.setProperty("--s", o.s);
  e.style.setProperty("--r", o.r + "deg");
  e.style.setProperty("--fs", o.fs + "px");
  e.style.setProperty("--t", o.t + "ms");
  document.body.appendChild(e);
  setTimeout(() => e.remove(), o.t + 60);
}
function ring(x, y, c) {
  const e = document.createElement("span");
  e.className = "ringfx";
  e.style.left = x + "px";
  e.style.top = y + "px";
  e.style.setProperty("--c", c);
  document.body.appendChild(e);
  setTimeout(() => e.remove(), 700);
}
const mid = rc => [rc.left + rc.width / 2, rc.top + rc.height / 2];
function hearts(rc) {
  if (calmNow()) return;
  const [x, y] = mid(rc);
  ring(x, y, "#FF5CA8");
  setTimeout(() => ring(x, y, "#BC6CFF"), 90);
  for (let i = 0; i < 14; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.25,
      d = 50 + Math.random() * 80;
    fx(i % 4 === 3 ? "✦" : "♥", x, y, {
      c: PAL[i % PAL.length],
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d - 20,
      s: (0.8 + Math.random() * 0.9).toFixed(2),
      r: Math.round((Math.random() - 0.5) * 70),
      fs: 12 + Math.random() * 12,
      t: 800 + Math.random() * 500,
    });
  }
}
function noteAdded(rc) {
  if (calmNow()) return;
  const [x, y] = mid(rc);
  ring(x, y, "#00F0FF");
  fx("✈", x, y, { c: "#00F0FF", dx: 70, dy: -90, s: 1.5, r: -20, fs: 18, t: 950 });
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI,
      d = 35 + Math.random() * 55;
    fx(["✎", "✦", "♪", "•"][i % 4], x, y, {
      c: PAL[i % PAL.length],
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d - 10,
      s: (0.7 + Math.random() * 0.6).toFixed(2),
      r: Math.round((Math.random() - 0.5) * 60),
      fs: 10 + Math.random() * 9,
      t: 700 + Math.random() * 400,
    });
  }
}
function noteEdited(rc) {
  if (calmNow()) return;
  const [x, y] = mid(rc);
  ring(x, y, "#FFB86B");
  for (let i = 0; i < 7; i++) {
    const a = Math.random() * Math.PI * 2,
      d = 25 + Math.random() * 40;
    fx(i % 3 === 0 ? "✎" : "✧", x, y, {
      c: i % 2 ? "#FFB86B" : "#BC6CFF",
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      s: (0.8 + Math.random() * 0.5).toFixed(2),
      r: Math.round(Math.random() * 120 - 60),
      fs: 11 + Math.random() * 8,
      t: 650 + Math.random() * 300,
    });
  }
}
function noteDeleted(rc) {
  if (calmNow()) return;
  const x = rc.right - 30,
    y = rc.top + rc.height / 2;
  for (let i = 0; i < 10; i++) {
    const a = (Math.random() - 0.5) * Math.PI * 0.9,
      d = 30 + Math.random() * 60;
    fx(i % 3 === 0 ? "✕" : "•", x, y, {
      c: i % 2 ? "#ff4d5e" : "#8b9490",
      dx: Math.cos(a) * d + 20,
      dy: Math.sin(a) * d + 18,
      s: (0.5 + Math.random() * 0.6).toFixed(2),
      r: Math.round(Math.random() * 200),
      fs: 9 + Math.random() * 9,
      t: 550 + Math.random() * 350,
    });
  }
}
function puff(rc) {
  if (calmNow()) return;
  const [x, y] = mid(rc);
  for (let i = 0; i < 5; i++)
    fx("·", x, y, { c: "#8b9490", dx: (Math.random() - 0.5) * 60, dy: 20 + Math.random() * 30, s: 1.4, r: 0, fs: 22, t: 600 });
}
const SPARK_COLOR = { interested: "#BC6CFF", contacted: "#00F0FF", viewing: "#FFB86B", applied: "#f4f7f5", no: "#ff4d5e" };
const SPARK_CHARS = { applied: ["🎉", "✦", "✦"], viewing: ["🔑", "✦"], no: ["✕"] };
function sparkle(rc, st) {
  if (calmNow()) return;
  const [x, y] = mid(rc),
    c = SPARK_COLOR[st] || "#BC6CFF",
    chars = SPARK_CHARS[st] || ["✦", "✧"];
  ring(x, y, c);
  for (let i = 0; i < (st === "no" ? 4 : 10); i++) {
    const a = Math.random() * Math.PI * 2,
      d = 30 + Math.random() * 50;
    fx(chars[i % chars.length], x, y, {
      c: i % 2 ? c : PAL[i % 4],
      dx: Math.cos(a) * d,
      dy: Math.sin(a) * d,
      s: (0.7 + Math.random() * 0.6).toFixed(2),
      r: Math.round(Math.random() * 180),
      fs: 10 + Math.random() * 10,
      t: 700 + Math.random() * 300,
    });
  }
}
function syncText(s) {
  if (s < 10) return "synced just now";
  if (s < 60) return `synced ${s}s ago`;
  return `synced ${Math.round(s / 60)} min ago`;
}
function updSync() {
  const el = $("sync");
  if (!el) return;
  el.textContent = S.lastSync ? syncText(Math.round((Date.now() - S.lastSync) / 1000)) : "connecting…";
}
setInterval(updSync, 10000);
// count-up numbers after each render
function countUp(el) {
  const k = el.dataset.count,
    to = +el.dataset.to,
    from = S.prevNums[k];
  S.prevNums[k] = to;
  if (calmNow() || (from === undefined && !S.loaded) || from === to) return;
  const f = from ?? 0,
    t0 = performance.now(),
    dur = 700;
  const step = t => {
    const p = Math.min(1, (t - t0) / dur),
      e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(f + (to - f) * e);
    if (p < 1) requestAnimationFrame(step);
  };
  step(t0);
}
function countUps() {
  document.querySelectorAll("[data-count]").forEach(countUp);
}
/* legend minimise */
(function () {
  const lg = $("mapLegend"),
    bt = $("lgToggle");
  if (!lg || !bt) return;
  const set = m => {
    lg.classList.toggle("min", m);
    bt.setAttribute("aria-expanded", String(!m));
    bt.title = m ? "Show legend" : "Minimise legend";
  };
  let m = globalThis.innerWidth < 700;
  try {
    const v = localStorage.getItem("rh-legend-min");
    if (v !== null) m = v === "1";
  } catch (e) {
    warnStorage(e);
  }
  set(m);
  bt.addEventListener("click", () => {
    m = !m;
    set(m);
    remember("rh-legend-min", m ? "1" : "0");
  });
})();

/* ---------- data: only through the save helper, only once signed in ---------- */
const authHeaders = () => ({ Authorization: "Bearer " + S.session });
async function fetchData() {
  if (!CFG.workerUrl || !S.session) return [null, null];
  try {
    const r = await fetch(CFG.workerUrl + "/data" + (S.dataSha ? "?v=" + encodeURIComponent(S.dataSha) : ""), {
      cache: "no-store",
      headers: authHeaders(),
    });
    if (r.ok) return [await r.json(), null];
    if (r.status === 401 || r.status === 403) return [null, r.status];
    const j = await r.json().catch(() => ({}));
    return [null, null, j.error || `error ${r.status}`];
  } catch (e) {
    console.warn("[rental] poll failed", e);
  }
  return [null, null, ""];
}
// A poll that left before one of our saves landed would undo it on screen, so keep our copy for a few seconds.
// Returns true when it did, so the caller re-reads the full snapshot next time instead of trusting its sha.
function applyTrack(obj, started, quiet) {
  const before = S.track,
    next = new Map(Object.entries(obj || {}).map(([k, v]) => [k, plain(v)]));
  let kept = false;
  for (const [id, at] of S.savedAt) {
    if (at < Date.now() - 60000) S.savedAt.delete(id);
  }
  for (const id of new Set([...S.busy.keys(), ...S.savedAt.keys()])) {
    const mine = before.get(id);
    if (mine && (S.busy.has(id) || S.savedAt.get(id) > started - 8000)) {
      next.set(id, mine);
      kept = true;
    }
  }
  S.track = next;
  if (!quiet) {
    for (const [id, t] of S.track) partnerChanged(id, t, before.get(id) || {});
  } // first load after sign-in: nothing is "new" yet
  return kept;
}
function partnerToast(who, l, t, o, logN, oldN) {
  if (t.status !== o.status) return `${who} marked ${l.type.toLowerCase()} in ${l.suburb} as ${STATUS_LABEL[t.status || "new"].toLowerCase()}`;
  if (logN <= oldN) return `${who} updated ${l.type.toLowerCase()} in ${l.suburb}`;
  const text = String(t.log[logN - 1].text),
    more = text.length > 60 ? "…" : "";
  return `${who} added a note on ${l.suburb}: “${text.slice(0, 60)}${more}”`;
}
// Someone else changed a place: flash it, say what they did, and burst hearts if they shortlisted it.
function partnerChanged(id, t, o) {
  const logN = (t.log || []).length,
    oldN = (o.log || []).length;
  if (!t.updatedBy || t.updatedBy === S.me) return;
  if (t.status === o.status && t.note === o.note && t.phone === o.phone && logN <= oldN) return;
  const l = S.listings.get(id);
  S.flash.add(id);
  setTimeout(() => {
    S.flash.delete(id);
  }, 2600);
  if (!l) return;
  if (!store.get("pfToasts", true)) return; // pop-ups switched off in the profile
  toast(partnerToast(t.updatedBy, l, t, o, logN, oldN), "partner");
  if (SHORT.has(t.status) && !SHORT.has(o.status)) {
    const m = cardFor(id)?.querySelector(".pcHeart");
    if (m) hearts(m.getBoundingClientRect());
  }
}
// listings come from scraped sites: force numeric fields to numbers before they meet any template
const NUM = ["price", "beds", "baths", "size_m2", "min_tecwise", "min_drive", "lat", "lng"];
function numeric(l) {
  for (const k of NUM) l[k] = l[k] == null || l[k] === "" ? null : Number(l[k]);
  return l;
}
function loadFailed(why) {
  if (S.listings.size) {
    $("sync").textContent = "reconnecting…";
    return;
  }
  if (!CFG.workerUrl) {
    banner("The site's server isn't set up yet.");
    return;
  }
  const reason = why ? " (" + why + ")" : "";
  banner(`Couldn't load places${reason}. It keeps trying every few seconds.`);
}
function openFromHash() {
  const h = location.hash.slice(1);
  if (!h) return;
  const hit = [...S.listings.keys()].find(k => hashId(k) === h);
  if (hit) openDrawer(hit);
}
function applySnapshot(d, started) {
  const first = !S.listings.size;
  S.listings = new Map((d.listings?.listings || []).map(l => [String(l.id), numeric(l)]));
  S.meta = d.meta || {};
  S.settings = d.settings || {};
  setAnchors(d.listings?.criteria);
  S.dataSha = applyTrack(d.track, started, first) ? null : d.sha || null;
  S.loaded = true;
  render();
  if (first) openFromHash();
}
let loading = false;
async function load() {
  if (loading || !S.session) return;
  loading = true;
  const started = Date.now(),
    sess = S.session;
  try {
    const [d, denied, why] = await fetchData();
    if (S.session !== sess) return;
    if (denied) {
      signOut(DENIED[denied][1]);
      return;
    }
    if (!d) {
      loadFailed(why);
      return;
    }
    banner("");
    S.lastSync = Date.now();
    updSync();
    if (!d.same) applySnapshot(d, started);
  } finally {
    loading = false;
  }
}
setInterval(() => {
  if (document.visibilityState === "visible") load();
}, 15000);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") load();
});

/* ---------- sign-in: Google, then the save helper checks the invite list and hands back a 30-day session ---------- */
function banner(msg) {
  $("banner").hidden = !msg;
  $("banner").textContent = msg || "";
}
function updWho() {
  const on = !!S.session;
  $("whoName").textContent = on ? S.me : "Profile";
  $("whoAvatar").textContent = on ? String(S.me || "?").charAt(0) : "";
  $("liveChip").hidden = !on;
}
function remember(k, v) {
  try {
    if (v) localStorage.setItem(k, v);
    else localStorage.removeItem(k);
  } catch (e) {
    warnStorage(e);
  }
}
function signOut(msg) {
  S.session = "";
  S.me = null;
  S.email = "";
  ["rh-session", "rh-name", "rh-email"].forEach(k => remember(k, ""));
  S.listings = new Map();
  S.track = new Map();
  S.dataSha = null;
  S.meta = {};
  S.lastSync = 0;
  setAnchors(null);
  closeDrawer();
  render();
  updWho();
  openWho(msg || "");
}
let gis = null;
function homeMsg(text, busy) {
  $("homeErr").textContent = text || "";
  $("homeErr").classList.toggle("busy", !!busy);
}
function loadGis() {
  return new Promise((res, rej) => {
    const sc = document.createElement("script");
    sc.src = "https://accounts.google.com/gsi/client";
    sc.async = true;
    sc.onload = res;
    sc.onerror = rej;
    document.head.appendChild(sc);
  }).then(() =>
    google.accounts.id.initialize({ client_id: CFG.googleClientId, callback: r => signIn(r.credential), ux_mode: "popup", context: "signin" }),
  );
}
function showGoogle() {
  if (!CFG.googleClientId) {
    homeMsg("Sign-in isn't set up yet.");
    return;
  }
  if (CFG.googleClientId === "dev") return; // local preview uses the dev form instead
  gis = gis || loadGis();
  gis
    .then(() =>
      google.accounts.id.renderButton($("gBtn"), {
        theme: "outline",
        size: "large",
        shape: "pill",
        text: "continue_with",
        logo_alignment: "left",
        width: 280,
      }),
    )
    .catch(err => {
      console.warn("[rental] Google sign-in didn't load", err);
      gis = null;
      homeMsg("Couldn't load Google sign-in. Check your connection and try again.");
    });
}
async function signIn(credential) {
  homeMsg("Signing in…", true);
  try {
    const r = await fetch(CFG.workerUrl + "/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 403) {
      homeMsg(`${j.email || "That account"} isn't on the invite list. Ask Dieter to add it.`);
      return;
    }
    if (!r.ok || !j.session) {
      homeMsg(j.error || "Sign-in didn't work, try again.");
      return;
    }
    S.session = j.session;
    S.me = j.name;
    S.email = j.email;
    remember("rh-session", j.session);
    remember("rh-name", j.name);
    remember("rh-email", j.email);
    homeMsg("");
    document.documentElement.classList.remove("locked");
    updWho();
    S.dataSha = null;
    render();
    toast(`Hi ${j.name}`, "info");
    load();
  } catch (e) {
    console.warn("[rental] sign-in failed", e);
    homeMsg("Couldn't reach the site's server. Try again in a minute.");
  }
}
// Signed out: the home screen. Signed in: a small account panel with sign-out.
function showHome(msg) {
  document.documentElement.classList.add("locked");
  $("whoBox").hidden = true;
  homeMsg(msg);
  $("devForm").hidden = CFG.googleClientId !== "dev";
  showGoogle();
  // local preview only: ?devlogin=anna@x.com signs straight in (for screenshots / tests)
  const devLogin = CFG.googleClientId === "dev" && new URLSearchParams(location.search).get("devlogin");
  if (devLogin && !msg) {
    $("devEmail").value = devLogin;
    $("devForm").requestSubmit();
  }
}
function openWho(msg) {
  if (!S.session) {
    showHome(msg);
    return;
  }
  $("whoTitle").textContent = S.me;
  $("whoMsg").textContent = S.email || "Signed in";
  $("pfAvatar").textContent = String(S.me || "?").charAt(0);
  $("pfToasts").checked = store.get("pfToasts", true);
  $("pfCalm").checked = store.get("pfCalm", false);
  $("pfStart").value = store.get("pfStart", "last");
  $("whoBox").hidden = false;
  $("whoClose").focus();
}
function closeWho() {
  $("whoBox").hidden = true;
}
$("whoChip").addEventListener("click", () => openWho(""));
$("whoClose").addEventListener("click", closeWho);
$("whoSignOut").addEventListener("click", () => {
  signOut("");
  toast("Signed out", "info");
});
// profile settings live in this browser only
$("pfToasts").addEventListener("change", e => store.set("pfToasts", e.target.checked));
$("pfCalm").addEventListener("change", e => {
  store.set("pfCalm", e.target.checked);
  document.documentElement.classList.toggle("calm", e.target.checked);
});
$("pfStart").addEventListener("change", e => store.set("pfStart", e.target.value));
$("whoBox").addEventListener("click", e => {
  if (e.target.id === "whoBox") closeWho();
});
$("whoBox").addEventListener("keydown", e => {
  if (e.key === "Escape") {
    e.stopPropagation();
    closeWho();
  }
});
// Local preview only (googleClientId "dev"): the mock in test/dev.mjs plays Google.
$("devForm").addEventListener("submit", async e => {
  e.preventDefault();
  try {
    signIn(await (await fetch(CFG.devTokenUrl + "?email=" + encodeURIComponent($("devEmail").value.trim()))).text());
  } catch (err) {
    console.warn("[rental] dev sign-in failed", err);
    homeMsg("Dev sign-in failed");
  }
});

/* ---------- background HUD symbols: a few readouts tick over while the page is visible ---------- */
(function () {
  const nums = [...document.querySelectorAll(".bgGlyphs [data-tick]")];
  if (!nums.length) return;
  setInterval(() => {
    if (calmNow() || document.visibilityState !== "visible" || document.documentElement.classList.contains("locked")) return;
    const el = nums[Math.floor(Math.random() * nums.length)],
      w = +el.dataset.tick;
    el.textContent = String(Math.floor(Math.random() * 10 ** w)).padStart(w, "0");
  }, 1400);
})();

/* ---------- GlowCard pointer tracking (the component's syncPointer): one listener, once per frame, read every
   on-screen card's box then write --x/--y inside it (and --xp/--yp across the screen) ---------- */
(function () {
  if (!globalThis.matchMedia?.("(hover:hover) and (pointer:fine)").matches) return;
  let f = 0,
    x = -1e4,
    y = -1e4;
  const paint = () => {
    f = 0;
    const cards = [...document.querySelectorAll(".tile[data-glow]")],
      rs = cards.map(c => c.getBoundingClientRect());
    cards.forEach((c, i) => {
      const r = rs[i];
      if (r.bottom < 0 || r.top > innerHeight) return;
      c.style.setProperty("--x", (x - r.left).toFixed(1) + "px");
      c.style.setProperty("--y", (y - r.top).toFixed(1) + "px");
    });
    $("view").style.setProperty("--xp", (x / innerWidth).toFixed(3));
    $("view").style.setProperty("--yp", (y / innerHeight).toFixed(3));
  };
  const kick = () => {
    if (!f) f = requestAnimationFrame(paint);
  };
  document.addEventListener(
    "pointermove",
    e => {
      x = e.clientX;
      y = e.clientY;
      kick();
    },
    { passive: true },
  );
  globalThis.addEventListener("scroll", kick, { passive: true });
  new MutationObserver(kick).observe($("tiles"), { childList: true });
})();

/* restore per-viewer view prefs, then start */
S.tab = store.get("pfStart", "last") === "last" ? store.get("tab", "places") : store.get("pfStart", "places");
["fArea", "fMax", "fPets", "sort"].forEach(id => {
  const v = store.get(id, null);
  if (v != null) $(id).value = v;
});
["tFibre", "tSec", "tHide"].forEach(id => {
  const v = store.get(id, null);
  if (v != null) $(id).setAttribute("aria-pressed", v);
});
updWho();
render();
if (S.session) {
  document.documentElement.classList.remove("locked");
  load();
} else {
  S.loaded = true;
  showHome("");
}
