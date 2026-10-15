// Centurion Rental Hunt: everything the page does. Loaded by index.html (kept out of the HTML so the
// Content-Security-Policy can forbid inline scripts).
// The two work places come from the private data after sign-in (listings.json -> criteria.anchors),
// so the public page never says where they are.
const ANCHOR_COLORS = { tecwise:"#00F0FF", drive:"#FF5CA8" };
let ANCHORS = {};
function setAnchors(criteria){
  const src=(criteria&&criteria.anchors)||{};
  ANCHORS=Object.fromEntries(Object.entries(src).map(([k,a])=>{
    const sub=String(a.label||"").replace(/^[^·]*·\s*/,"");
    return [k,{ name:String(a.name||k), sub, area:sub.split(", ").pop(), lat:+a.lat, lng:+a.lng, color:ANCHOR_COLORS[k]||"#BC6CFF" }];
  }));
  $("lgAnchors").innerHTML=Object.values(ANCHORS).map(a=>`<div class="li"><span class="sw" style="background:${a.color}"></span>Work · ${esc(a.name)}${a.area?` (${esc(a.area)})`:""}</div>`).join("");
}
const routeTo=(origin,k)=>{ const a=ANCHORS[k]; return a ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${a.lat},${a.lng}` : "#"; };
const STATUSES = [["new","New"],["interested","Interested"],["contacted","Contacted"],["viewing","Viewing booked"],["applied","Applied"],["no","Not for us"]];
const STATUS_LABEL = Object.fromEntries(STATUSES);
const SHORT = ["interested","contacted","viewing","applied"];
const DEFAULT_TEMPLATE = "Hi {agent},\n\nI'm interested in the {beds}-bedroom {type} in {suburb} listed at R{price} pm ({link}).\n\nIs it still available? We have two indoor cats, would the landlord consider them? When could we come and view it?\n\nThanks,\nDieter";
const ICON = {
  ok:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
  ask:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M12 7v6"/><circle cx="12" cy="17" r=".6"/></svg>',
  no:'<svg width="26" height="26" viewBox="0 0 26 26"><path d="M13 3 24 22H2z" fill="#e5534b"/><path d="M13 10v5" stroke="#2a0d0b" stroke-width="2.2"/><circle cx="13" cy="18.3" r="1.1" fill="#2a0d0b"/></svg>',
  box:'<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12h8"/></svg>'
};

const S = { notesOpen:new Set(), freshNote:null, freshKind:"add", editNote:null, delArm:null, listings:new Map(), track:new Map(), meta:{}, settings:{}, tab:"places", tile:null, mapMode:"all", openId:null, popId:null, sideId:null, flash:new Set(), lastSync:0, gaugesShown:false, listShown:false, prevNums:{}, me:null, pass:"", mode:null, dataSha:null, busy:new Map(), savedAt:new Map(), loaded:false };
const CFG = { workerUrl:"", googleClientId:"", ...globalThis.RENTAL_CONFIG };
while(CFG.workerUrl.endsWith("/")) CFG.workerUrl=CFG.workerUrl.slice(0,-1);
S.session=""; S.email="";
try{ S.session=localStorage.getItem("rh-session")||""; S.me=S.session?localStorage.getItem("rh-name"):null; S.email=localStorage.getItem("rh-email")||""; }catch(e){}
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const rand = n => "R" + Number(n).toLocaleString("en-ZA").replace(/[, ]/g," ");
const store = { get(k,d){ try{ const v=localStorage.getItem("rh:"+k); return v==null?d:JSON.parse(v);}catch(e){return d} }, set(k,v){ try{localStorage.setItem("rh:"+k,JSON.stringify(v))}catch(e){} } };
const TOAST_KIND={like:["#FF5CA8","♥"],unlike:["#8b9490","♡"],note:["#00F0FF","✎"],edit:["#FFB86B","✎"],del:["#ff4d5e","✕"],partner:["#BC6CFF","●"],error:["#ff4d5e","!"],copy:["#00F0FF","⧉"],info:["#BC6CFF","✦"],
  interested:["#BC6CFF","★"],contacted:["#00F0FF","☏"],viewing:["#FFB86B","◉"],applied:["#34d399","✓"],no:["#ff4d5e","✕"],new:["#8b9490","○"]};
function toast(t,kind){ const el=$("toast"); const [c,ic]=TOAST_KIND[kind]||TOAST_KIND.info; el.style.setProperty("--tc",c); $("toastI").textContent=ic; $("toastT").textContent=t; $("toastT").title=t;
  el.hidden=false; el.classList.remove("go"); void el.offsetWidth; el.classList.add("go"); clearTimeout(toast.t); toast.t=setTimeout(()=>{ el.hidden=true; el.classList.remove("go"); }, kind==="partner"?4200:2600); }

const tr = id => S.track.get(id) || {};
const plain = v => JSON.parse(JSON.stringify(v ?? null));
const statusOf = id => tr(id).status || "new";
const phoneOf = l => tr(l.id).phone || l.phone || "";
const emailOf = l => tr(l.id).email || l.email || "";
function intl(p){ const d=String(p).replace(/\D/g,""); if(!d) return ""; if(d.startsWith("27")) return d; if(d.startsWith("0")) return "27"+d.slice(1); return d; }
function prettyPhone(p){ const d=String(p).replace(/\D/g,""); return d.length===10 ? d.replace(/(\d{3})(\d{3})(\d{4})/,"$1 $2 $3") : p; }
function petClass(l){ const p=(l.pets||"").toLowerCase(); if(p.startsWith("yes")||p.includes("small")) return "ok"; if(p==="no"||p.includes("dogs only")) return "no"; return "ask"; }
function petLabel(l){ const p=(l.pets||"").toLowerCase(); if(p.includes("dogs only")) return "Dogs only, no cats"; if(p==="no") return "No pets"; if(p.includes("small")) return "Small pets OK"; if(p.startsWith("yes")) return "Pets OK"; return "Pets: ask"; }
const fibreOk = l => /^(yes|ready)|free/i.test(l.fibre||"");
const secOk = l => /24|guard|boom|access|estate|gated|electric|cctv|secur/i.test(l.security||"");
function score(l){ let s=0; const pc=petClass(l); if(pc==="ok") s+=3; if(pc==="no") s-=3; if(fibreOk(l)) s+=1; if(secOk(l)) s+=1; s+=(16000-l.price)/4000; s-=Math.min(l.min_drive,l.min_tecwise)/10; if(l.tier!=="core") s-=1; return s; }
const isNew = l => S.meta.last_run && l.first_seen===S.meta.last_run && l.first_seen!==S.meta.first_run;
const activeAll = () => [...S.listings.values()].filter(l=>l.active!==false);

/* shared filters (top bar + rail toggles + tiles) */
function passesBase(l){
  const area=$("fArea").value, max=+$("fMax").value, pets=$("fPets").value, q=$("q").value.trim().toLowerCase();
  if(area!=="all" && l.tier!==area) return false;
  if(l.price>max) return false;
  if(pets==="ok" && petClass(l)!=="ok") return false;
  if(pets==="notno" && petClass(l)==="no") return false;
  if($("tFibre").getAttribute("aria-pressed")==="true" && !fibreOk(l)) return false;
  if($("tSec").getAttribute("aria-pressed")==="true" && !secOk(l)) return false;
  if(S.tile==="ok" && petClass(l)!=="ok") return false;
  if(S.tile==="no" && petClass(l)!=="no") return false;
  if(S.tile==="ask" && petClass(l)!=="ask") return false;
  if(S.tile==="fibre" && !fibreOk(l)) return false;
  if(q){ const hay=[l.suburb,l.address,l.agency,l.agent,l.type,l.summary,l.source,tr(l.id).note,(tr(l.id).log||[]).map(n=>n.text).join(" ")].join(" ").toLowerCase(); if(!hay.includes(q)) return false; }
  return true;
}
function listFor(tab){
  const hide=$("tHide").getAttribute("aria-pressed")==="true";
  let arr=[...S.listings.values()].filter(l=>{
    const st=statusOf(l.id);
    if(tab==="gone") return l.active===false;
    if(l.active===false) return false;
    if(tab==="shortlist" && !SHORT.includes(st)) return false;
    if(tab==="new" && !isNew(l)) return false;
    if(tab!=="shortlist" && hide && st==="no") return false;
    return passesBase(l);
  });
  const k=$("sort").value;
  const sz=l=>Number(l.size_m2)||0;
  const bySize=(a,b,dir)=>{ const x=sz(a), y=sz(b); if(!x!==!y) return x?-1:1; if(x!==y) return dir*(x-y); return dir*((a.beds||0)-(b.beds||0)) || a.price-b.price; };
  arr.sort((a,b)=> k==="price"?a.price-b.price : k==="price_desc"?b.price-a.price
    : k==="drive"?(a.min_drive-b.min_drive || a.price-b.price) : k==="tecwise"?(a.min_tecwise-b.min_tecwise || a.price-b.price)
    : k==="size_asc"?bySize(a,b,1) : k==="size_desc"?bySize(a,b,-1)
    : k==="new"?String(b.first_seen).localeCompare(String(a.first_seen)) : score(b)-score(a));
  return arr;
}

/* ---------- rail charts ---------- */
function renderCharts(){
  const all=activeAll(); if(!all.length){ $("chPrice").innerHTML=""; $("chDrive").innerHTML=""; return; }
  // rent spread: thin bars per R500 bucket
  const lo=8000, hi=16000, step=500, n=(hi-lo)/step;
  const b=Array(n).fill(0); all.forEach(l=>{ b[Math.min(n-1,Math.max(0,Math.floor((l.price-lo)/step)))]++; });
  const mx=Math.max(...b,1), W=210, H=60, base=46, bw=W/n;
  const minP=Math.min(...all.map(l=>l.price)), maxP=Math.max(...all.map(l=>l.price));
  let s=`<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="var(--line)"/>`;
  b.forEach((v,i)=>{ const h=v/mx*36; const x=i*bw+bw/2; for(let k=0;k<3;k++){ s+=`<line x1="${x-2+k*2}" y1="${base}" x2="${x-2+k*2}" y2="${base-h*(k===1?1:.55)}" stroke="${k===1?"#00F0FF":"#5b4a7e"}" stroke-width="1"/>`; } });
  const px=p=>((p-lo)/(hi-lo))*W;
  [minP,maxP].forEach(p=>{ s+=`<line x1="${px(p)}" y1="6" x2="${px(p)}" y2="${base}" stroke="var(--muted)" stroke-dasharray="1 2"/><circle cx="${px(p)}" cy="6" r="2.2" fill="var(--white)"/><circle cx="${px(p)}" cy="${base}" r="2.2" fill="var(--white)"/>`; });
  $("chPrice").innerHTML=s; $("chPriceEnds").innerHTML=`<span>${rand(minP)}</span><span>${rand(maxP)}</span>`;
  // minutes to Drive: peaks
  const dl=3, dh=25, m=dh-dl; const c=Array(m+1).fill(0); all.forEach(l=>c[Math.min(m,Math.max(0,Math.min(l.min_drive,l.min_tecwise)-dl))]++);
  const cm=Math.max(...c,1), sw=W/(m+1); let t=`<line x1="0" y1="${base}" x2="${W}" y2="${base}" stroke="var(--line)" stroke-dasharray="1 3"/>`;
  c.forEach((v,i)=>{ if(!v) return; const x=i*sw+sw/2, h=6+v/cm*30; t+=`<path d="M${x-sw*.7} ${base} L${x} ${base-h} L${x+sw*.7} ${base}Z" fill="${i<=10-dl?"#00F0FF":"#BC6CFF"}" fill-opacity="${i<=10-dl?.9:.55}"/>`; });
  const t10=(10-dl)*sw+sw/2; t+=`<line x1="${t10}" y1="4" x2="${t10}" y2="${base}" stroke="#00F0FF" stroke-dasharray="1 2"/><text x="${t10+4}" y="10" font-size="8" fill="#00F0FF" font-family="Lexend">10 min</text>`;
  $("chDrive").innerHTML=t; const md=all.map(l=>Math.min(l.min_drive,l.min_tecwise)); $("chDriveEnds").innerHTML=`<span>${Math.min(...md)} min</span><span>${Math.max(...md)} min</span>`;
}

/* ---------- gauges ---------- */
function gauge(label, val, of, hue){
  const R=34, C=2*Math.PI*R, frac=of?Math.min(1,val/of):0, sweep=.78;
  const off=C*(1-sweep), len=C*sweep*frac, ang=(-90-(sweep*360)/2+ sweep*360*frac)*Math.PI/180+Math.PI/2;
  const nx=42+Math.cos(ang-Math.PI/2)*24, ny=42+Math.sin(ang-Math.PI/2)*24;
  const id="g"+label.replace(/\W/g,"");
  return `<div class="gauge"><svg viewBox="0 0 84 84" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${hue[0]}"/><stop offset="1" stop-color="${hue[1]}"/></linearGradient></defs>
    <g transform="rotate(${90+(1-sweep)*180} 42 42)">
      <circle cx="42" cy="42" r="${R}" fill="none" stroke="var(--line)" stroke-width="3" stroke-dasharray="${C*sweep} ${C}" stroke-linecap="round"/>
      <circle cx="42" cy="42" r="${R}" fill="none" class="arc" stroke="url(#${id})" stroke-width="3" stroke-dasharray="${Math.max(.01,len)} ${C}" stroke-linecap="round"/>
    </g>
    <line x1="42" y1="42" x2="${nx}" y2="${ny}" stroke="var(--fg)" stroke-width="1.2" stroke-linecap="round"/><circle cx="42" cy="42" r="2.4" fill="var(--fg)"/>
  </svg><span class="k">${label}</span><span class="v num"><span data-count="g-${id}" data-to="${val}">${val}</span><small> / ${of}</small></span></div>`;
}
function renderGauges(){
  const all=activeAll(), n=all.length;
  const short=all.filter(l=>SHORT.includes(statusOf(l.id))).length;
  const pets=all.filter(l=>petClass(l)==="ok").length;
  const core=all.filter(l=>l.tier==="core").length;
  const tabs=$("gauges").querySelector(".viewtabs").outerHTML;
  $("gauges").classList.toggle("anim", !S.gaugesShown && S.loaded); if(S.loaded) S.gaugesShown=true;
  $("gauges").innerHTML = tabs + gauge("On our shortlist", short, n, ["#00F0FF","#BC6CFF"]) + gauge("Pet friendly", pets, n, ["#34d399","#00F0FF"]) + gauge("Within 10 min", core, n, ["#BC6CFF","#FF5CA8"]);
  $("gauges").querySelectorAll("[data-jump]").forEach(b=>b.setAttribute("aria-pressed", String(b.dataset.jump===(S.tab==="shortlist"?"shortlist":"places"))));
}

/* ---------- map (drawn from OpenStreetMap roads; drag to pan, scroll / pinch / buttons to zoom) ---------- */
const ROADS_RAW = "0~N14~-257704,281877,-13,27,-26,20,-76,-8,-57,-19,-67,-75,-25,-13,-46,-5,-313,36,-58,-1,-58,-17,-109,-74,-293,-75;0~N14~-259119,280288,45,83,26,72,30,231,71,210,14,150,30,156,13,202,18,80,27,73,102,221;0~N14~-258742,281776,-110,-241,-33,-100,-14,-85,-7,-156,-30,-160,-10,-128,-74,-227,-34,-247,-81,-166;0~N14~-258870,281664,319,82,82,59,46,23,33,8,63,1,318,-36,41,6,32,18,61,70,56,17,62,10,36,-21;2~M18~-257781,281938,-34,-4,-80,25,-75,7,-181,59,-137,47,-97,49,-213,85;2~M18~-258598,282204,213,-84,97,-49,298,-105,81,-4,92,-31,19,1;2~R50~-258087,282579,-33,45,-38,3,-71,-27,-15,1,-184,138,-34,46,-49,119,-35,56,-50,44,25,-19;2~R50~-258362,282691,-70,54,-40,63;2~R50~-258086,282579,-38,50,-28,2,-86,-29,-47,31;0~R21~-259824,282520,268,40,276,59,86,-9,154,-57,334,-12,189,-26,118,-29,38,-15,164,-88,143,-104;0~R21~-258053,282281,-143,104,-197,103,-176,40,-206,21,-264,7,-154,57,-98,9,-247,-55,-317,-48;2~M10~-258198,282524,56,-163,-3,-118,37,-35,13,-24,1,-42,-21,-30,-41,-25,-33,-104,-32,-61,3,-103,-11,-154,-37,-110,-44,-68,-26,-132,-40,-122,29,-105;2~M10~-258045,282961,-6,-21,7,20;2~M10~-258135,282228,-12,27;2~M10~-258242,281627,8,23;2~M10~-258150,282399,-47,126;2~M10~-258115,282112,-45,-28,-31,-101,-30,-61;2~R55~-259162,280999,-36,-7,374,70,67,22,286,0,64,15,120,62,44,7,100,-9,151,-69,39,0,119,57,47,-5;2~R55~-259348,280964,-53,-14,-57,-32,70,39,190,35;2~R55~-257787,281144,-43,6,-112,-54,-51,-3,-155,69,-98,9,-41,-8,-114,-59,-69,-17,-292,-2,-61,-20,-277,-55;2~R55~-259215,280989,-102,-19;2~R55~-259528,280876,70,42;1~R21~-257742,281992,-79,15,-22,24,-35,92,-126,124,-49,34;1~R21~-258054,282279,44,-30,133,-131,30,-84,16,-24,88,-24;0~N1~-259530,281346,165,65,158,89;0~N1~-257663,282751,-223,-57,-50,-22,-86,-57,-142,-60,-21,-14,-61,-57,-139,-137,-42,-32,-101,-45,-35,-29,-28,-42,-51,-204,-100,-219;0~N1~-258743,281766,101,222,15,50,20,101,18,59,17,29,18,20,33,24,104,48,40,33,200,192,42,24,116,46,108,69,130,36;0~N1~-258845,281673,-151,-45,-53,-26,-87,-54;0~N1~-259224,281492,-129,-73,-105,-46,-73,-26;0~N1~-259121,281555,110,64,141,45;2~M11~-257839,283004,4,-153,12,-57,26,-57;2~M11~-257800,282746,-31,92,-7,92;2~M11~-257837,282969,-1,35;2~R562~-259432,281446,-45,152,4,138,-30,70;2~R562~-259540,281853,41,-55,24,-59,-3,-94,8,-90,36,-108;2~Solomon Mahlangu Drive~-258197,282525,-16,63,-1,86,12,36,77,95,74,135;2~Solomon Mahlangu Drive~-258133,282794,-71,-83,-11,-30,0,-95,17,-62;2~Solomon Mahlangu Drive~-258044,282960,9,52;2~Solomon Mahlangu Drive~-258041,282976,-4,-15;2~Solomon Mahlangu Drive~-258085,282881,-15,-31;0~N1 section 21 North~-259207,281500,86,55;0~N1 section 21 South~-259136,281548,-88,-56;2~M9~-258082,282571,-4,8;3~M25~-258703,281379,-2,-19,6,41,-4,-22;3~M25~-258698,281407,-1,-6,20,123,-3,-19;3~M25~-258678,281529,-1,-5,9,32,45,41,1,125,42,93,119,105,68,67,8,18;3~M25~-258706,281351,1,9;3~M25~-258706,281353,-1,-2;3~M25~-258545,281851,-37,-34,-41,-96,1,-107,-13,-32;3~M25~-258512,281876,117,111,7,19;3~M34~-258640,282108,110,-90,71,-94,66,-71,6,-60,-10,-56,12,92,-6,23,-68,73,-71,94,-109,90;3~M34~-258418,281632,18,66,-19,-66;3~M34~-258398,281723,0,7,-2,-32,2,25;3~M34~-258397,281737,-1,-7,1,7;3~M36~-258724,281956,-47,-48,49,47,48,92,-50,-91;3~M36~-258674,282047,48,84,7,83;3~M36~-258620,282215,-7,-79,-37,-71;3~M36~-259218,281321,-85,168,30,80,33,14,59,44,96,29,-73,-20;3~M36~-259039,281669,-27,-8,182,61,15,21,1,39,51,78,46,48;3~M36~-258786,281894,-32,-33,-48,-70,-35,-66,-22,-17,-54,-20;3~M36~-259216,281321,-82,157,-1,25;3~M36~-259085,281656,18,5;3~M36~-259181,281627,-16,-10;3~M36~-259273,281569,-17,-39;3~M9~-258081,282560,-6,-11,5,22,1,-11;3~M9~-257900,282390,-28,-2,-21,28,-4,23,-126,46,-11,60;3~M9~-258087,282579,5,-8;3~M28~-258633,282472,48,8,-49,-7;3~M28~-258585,282480,171,-39,13,-11,11,-37,33,-44,72,0,33,20,36,-6,16,11,23,42,20,5;3~M28~-258544,282471,21,-5;3~M28~-258261,282365,20,2;3~M28~-258354,282349,-29,33,-15,43,-16,16;3~M28~-258158,282422,-25,-14;3~Willem Botha Road~-258504,281417,-43,8,-55,51;3~Willem Botha Road~-258428,281442,20,-14,-20,14,-39,0,-36,-24;3~Willem Botha Road~-258627,281591,22,-15,6,-19,-4,-75,6,-10;3~M37~-258605,281358,-17,12,-54,2,-24,14,-114,28,-114,12,-49,-11,-51,24,-21,5,-13,-5;3~M37~-258860,281417,60,-7,99,-25,25,-14,28,0;3~M37~-259236,281318,36,9,-36,-9,-144,-9;3~M37~-259093,281401,-20,-30,-59,-31,29,15;3~R114~-258851,280663,37,193,-10,209,77,102,-32,-44;3~R114~-258747,281167,245,330,33,27,72,19,-28,-7;3~R114~-258821,280950,-2,115,16,21;3~R114~-258397,281543,63,17,19,33;3~M18~-259413,282330,101,-6,108,-55,50,16,142,-33,381,-34,246,-98,97,-49,199,-69;3~M18~-258089,282005,-199,67,-139,67,-204,79;3~M19~-258810,282035,88,-80,69,-44,32,-77,31,-34,22,-8,-31,18,-25,36,-18,51,-21,25,-58,34,-89,82,-44,30;3~M19~-258289,282073,-41,-102,-103,-124,104,124,41,101;3~M19~-258433,281847,-39,-38,-35,-17,35,17;3~M19~-258507,281792,-23,-5,-38,5,32,-5,29,5;3~R101~-258807,281616,57,4,-113,-11,27,4;3~R101~-258915,281603,-87,-12,99,13,-12,-1;3~R101~-259407,281450,103,36,180,105,23,3,44,-10,55,7,-59,-5,-61,7,-39,-16,-36,-29,-108,-59,-95,-33;3~R101~-258631,281628,8,1,-127,-9,49,4;3~R101~-258287,281582,44,-22,-206,84,-174,-15,7,1;3~R101~-258243,281560,22,-5,56,14,190,70,89,41;3~West Avenue~-258502,281882,-30,20,-65,72,-32,-27,-30,12,-11,-4,-14,-24;3~West Avenue~-258683,281931,9,20,14,7,31,-12,32,27,67,-75,26,-17;3~M57~-258369,282514,53,38,76,4,-72,-2,-57,-40,-28,-7,-83,45,-122,34,-64,9,-116,-33,16,5;3~M57~-258782,282562,-67,4,-23,-12,-27,-37,-56,-35,-323,-32,-66,-18,-185,12,-132,-3;3~M57~-258688,282591,86,-5;3~R562~-259309,280528,20,224,-112,198;3~M31~-258767,282137,-10,16,-1,32,14,105,33,35,95,69,11,49,-53,164,12,27,127,87,58,67,15,8;3~M31~-258678,282607,53,-164;3~M31~-258991,281421,66,97,5,126,-5,-126;3~M31~-258927,281764,0,43,9,-140,-9,97;3~M31~-258826,282007,58,107;3~M31~-258926,281858,6,55,-1,-6;3~M31~-258861,281984,-45,-40,-14,-31;3~M26~-258085,280987,-31,-36,66,80,46,29,11,33;3~M26~-258151,280928,35,23,-35,-23,-74,-107,-14,-23,-5,-38;3~M26~-258050,281031,49,30,10,32;3~M24~-258157,281161,10,17,135,123,48,280,6,3,-7,59,16,73,-10,36,-21,16,-112,28,-39,54,16,-27;3~M24~-258131,281850,-60,101;3~M27~-258361,282353,-95,-83,-44,-9,-2,-14,12,-22,29,-16,32,-38,37,-22,-9,-23,-39,-94,-114,-104,-30,-15,-56,-51,-48,-63,-41,-74,-7,-58,-39,-38,-7,-25,-33,-26,-43,-83,26,-56;3~M27~-258782,281604,6,19,48,50,-1,8;3~M27~-258660,281830,49,38,172,164,37,93;3~Estcourt Avenue~-258727,281524,6,98;3~Estcourt Avenue~-258723,281622,1,-35;3~R55~-259162,280999,-36,-7,284,53;3~R55~-259400,280952,202,40;3~R55~-258915,281048,-185,-38;3~Lenchen Avenue~-258725,281197,-26,11,-13,15,-21,81,-29,54,1,28,-12,27;3~Lenchen Avenue~-258826,281413,13,-32,-1,-23;3~Lenchen Avenue~-258792,281316,11,-27;3~M23~-258331,282904,-72,-89,-26,-75;3~M23~-258428,282740,29,81,41,49;3~M30~-257898,282780,-64,75,67,-83;3~M33~-257882,282834,-88,-34,89,33;3~M33~-258132,282775,-13,3,14,-3,19,9,38,35,70,-25,34,6;3~Lever Road~-259407,281297,27,12";
const ROADS = ROADS_RAW.split(";").map(s=>{ const [c,n,nums]=s.split("~"); const v=nums.split(",").map(Number); const p=[]; let a=v[0],b=v[1]; p.push([a/1e4,b/1e4]); for(let i=2;i<v.length;i+=2){ a+=v[i]; b+=v[i+1]; p.push([a/1e4,b/1e4]); } return {c:+c,n,p}; });
const PLACES = [["Wierdapark",-25.8603,28.1467],["Eldoraigne",-25.8451,28.1573],["Clubview",-25.8339,28.1683],["Hennopspark",-25.8497,28.1742],["Zwartkop",-25.8672,28.1764],["Lyttelton",-25.8294,28.2028],["Die Hoewes",-25.8460,28.1950],["Doringkloof",-25.8564,28.2103],["Irene",-25.8684,28.2180],["Highveld",-25.8700,28.2300],["Pierre van Ryneveld",-25.8369,28.2417],["Rooihuiskraal",-25.8933,28.1514],["The Reeds",-25.8992,28.1342],["Amberfield",-25.8850,28.1328],["Heuweloord",-25.8822,28.1131],["Celtisdal",-25.8711,28.1297],["Raslouw",-25.8529,28.1187],["Thatchfield",-25.8975,28.1137],["Valhalla",-25.8069,28.1511],["Glen Lauriston",-25.8253,28.1558],["Golden Fields",-25.9080,28.1691],["Midstream",-25.9111,28.1934],["Kosmosdal",-25.9250,28.1350],["Monavoni",-25.8560,28.1000]];
const HOT=[];
const VIEW={z:1,tx:0,ty:0}; let mapGeom=null, drag=null, raf=0;
function hash2(x,y){ let h=x*374761393+y*668265263; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967295; }
function vnoise(x,y){ const xi=Math.floor(x), yi=Math.floor(y), xf=x-xi, yf=y-yi, s=t=>t*t*(3-2*t);
  const a=hash2(xi,yi), b=hash2(xi+1,yi), c=hash2(xi,yi+1), d=hash2(xi+1,yi+1), u=s(xf), v=s(yf); return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v; }
function baseGeom(w,h){
  const pts=activeAll().filter(l=>l.tier==="core").concat(Object.values(ANCHORS));
  if(!pts.length) pts.push({lat:-25.86,lng:28.19}); // nothing loaded yet: centre on Centurion
  let minLat=Math.min(...pts.map(p=>p.lat)), maxLat=Math.max(...pts.map(p=>p.lat)), minLng=Math.min(...pts.map(p=>p.lng)), maxLng=Math.max(...pts.map(p=>p.lng));
  const k=Math.cos(-25.86*Math.PI/180), padLat=(maxLat-minLat)*.18+.01, padLng=(maxLng-minLng)*.1+.008;
  minLat-=padLat; maxLat+=padLat; minLng-=padLng; maxLng+=padLng;
  const sc=Math.min(w/((maxLng-minLng)*k), (h-40)/(maxLat-minLat));
  const ox=(w-(maxLng-minLng)*k*sc)/2, oy=(h-40-(maxLat-minLat)*sc)/2;
  return { x:lng=>ox+(lng-minLng)*k*sc, y:lat=>oy+(maxLat-lat)*sc, kmPx: sc/111.32 };
}
function geomNow(w,h){ const b=baseGeom(w,h); return { x:lng=>b.x(lng)*VIEW.z+VIEW.tx, y:lat=>b.y(lat)*VIEW.z+VIEW.ty, kmPx:b.kmPx*VIEW.z }; }
function jit(id){ let h=0; for(const c of id) h=(h*31+c.charCodeAt(0))|0; return [((h&255)/255-.5)*26, (((h>>8)&255)/255-.5)*26]; }
function markerVisible(l){ if(!passesBase(l)) return false; const st=statusOf(l.id); if(S.mapMode==="ok" && petClass(l)!=="ok") return false; if(S.mapMode==="saved" && !SHORT.includes(st)) return false; if($("tHide").getAttribute("aria-pressed")==="true" && st==="no") return false; return true; }
function renderMap(light){
  const area=$("mapArea"), cv=$("map"), w=area.clientWidth, h=area.clientHeight; if(!w||!h) return;
  const dpr=Math.min(2,window.devicePixelRatio||1); if(cv.width!==w*dpr||cv.height!==h*dpr){ cv.width=w*dpr; cv.height=h*dpr; }
  const ctx=cv.getContext("2d"); ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,w,h);
  const all=activeAll(); const G=geomNow(w,h); mapGeom=G;
  const jz=Math.min(1,1/VIEW.z*1.6);
  const pos=all.map(l=>{ const [jx,jy]=l.geo==="exact"?[0,0]:jit(l.id); return {l, x:G.x(l.lng)+jx*jz, y:G.y(l.lat)+jy*jz}; });
  const anchors=Object.entries(ANCHORS).map(([k,a])=>({k,a,x:G.x(a.lng), y:G.y(a.lat)}));
  const ring=4.94*G.kmPx, sig=Math.max(16, 1.0*G.kmPx), sp=7;
  const vis=pos.filter(p=>markerVisible(p.l));
  HOT.length=0;
  if(!light){
    for(let y=sp/2; y<h; y+=sp){ for(let x=sp/2; x<w; x+=sp){
      let v=0; for(const p of vis){ const dx=x-p.x, dy=y-p.y, d2=dx*dx+dy*dy; if(d2<sig*sig*9) v+=Math.exp(-d2/(2*sig*sig)); }
      let z=0; for(const a of anchors){ const d=Math.hypot(x-a.x,y-a.y); if(d<ring) z=Math.max(z,.16+.16*(1-d/ring)); }
      const nx=(x-VIEW.tx)/VIEW.z, ny=(y-VIEW.ty)/VIEW.z, nz=vnoise(nx/38,ny/38)*.7+vnoise(nx/11,ny/11)*.3;
      const t=Math.min(1.4, v*.45 + z + (nz-.45)*.3);
      let r, col;
      if(t<.18){ col=`rgba(90,100,96,${.2+nz*.18})`; r=.7; }
      else if(t<.75){ const a=(t-.18)/.57; col=`rgba(${Math.round(90+a*98)},${Math.round(60+a*48)},${Math.round(160+a*95)},${.25+a*.3})`; r=.9+a*.9; }
      else { if(HOT.length<700) HOT.push(x,y); const a=Math.min(1,(t-.75)/.6); col=`rgba(${Math.round(188+a*67)},${Math.round(108-a*16)},${Math.round(255-a*87)},.6)`; r=1.7+a*.4; }
      ctx.fillStyle=col; ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2); ctx.fill();
    } }
  }
  // roads
  const style=[[3.2,.62],[2.6,.5],[1.7,.36],[1.1,.24]];
  ctx.lineCap="round"; ctx.lineJoin="round";
  for(const cls of [3,2,1,0]){ for(const r of ROADS){ if(r.c!==cls) continue; ctx.strokeStyle=`rgba(233,238,235,${style[cls][1]})`; ctx.lineWidth=style[cls][0]*Math.min(1.6,Math.max(.8,VIEW.z*.8));
    ctx.beginPath(); r.p.forEach((q,i)=>{ const X=G.x(q[1]), Y=G.y(q[0]); i?ctx.lineTo(X,Y):ctx.moveTo(X,Y); }); ctx.stroke(); } }
  // road labels: one per name, longest piece, placed mid-segment when on screen
  const best={};
  for(const r of ROADS){ if(!r.n || /section/i.test(r.n) || (r.c===3 && VIEW.z<1.6 && !/^[NRM]\d/.test(r.n))) continue; if(r.p.length<2) continue;
    const mid=r.p[Math.floor(r.p.length/2)], X=G.x(mid[1]), Y=G.y(mid[0]); if(X<20||X>w-20||Y<20||Y>h-50) continue;
    const len=r.p.length; if(!best[r.n]||best[r.n].len<len) best[r.n]={X,Y,len,c:r.c}; }
  ctx.font="500 10px Lexend, sans-serif"; ctx.textAlign="center"; ctx.textBaseline="middle";
  for(const [n,b] of Object.entries(best)){ const short=n.replace(" Avenue"," Ave").replace(" Road"," Rd").replace(" Drive"," Dr"); const tw=ctx.measureText(short).width+10;
    ctx.fillStyle=b.c<=1?"rgba(233,238,235,.92)":"rgba(37,41,40,.92)"; ctx.strokeStyle="rgba(233,238,235,.35)"; ctx.lineWidth=1;
    ctx.beginPath(); ctx.roundRect ? ctx.roundRect(b.X-tw/2,b.Y-8,tw,16,4) : ctx.rect(b.X-tw/2,b.Y-8,tw,16); ctx.fill(); if(b.c>1) ctx.stroke();
    ctx.fillStyle=b.c<=1?"#111":"rgba(233,238,235,.85)"; ctx.fillText(short,b.X,b.Y+.5); }
  // suburb names
  ctx.font="300 11px Lexend, sans-serif"; ctx.fillStyle="rgba(200,210,205,.55)";
  for(const [n,la,lo] of PLACES){ const X=G.x(lo), Y=G.y(la); if(X>30&&X<w-30&&Y>16&&Y<h-50) ctx.fillText(n,X,Y-14); }
  // 10-minute zones
  for(const a of anchors){ ctx.strokeStyle=a.a.color; ctx.globalAlpha=.75; ctx.lineWidth=1.4; ctx.setLineDash([5,6]); ctx.beginPath(); ctx.arc(a.x,a.y,ring,0,Math.PI*2); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha=.07; ctx.fillStyle=a.a.color; ctx.beginPath(); ctx.arc(a.x,a.y,ring,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    ctx.font="500 10px Lexend, sans-serif"; ctx.fillStyle=a.a.color; ctx.fillText("10 min from "+a.a.name, a.x, a.y-ring-9); }
  // overlay
  let html="";
  for(const a of anchors) html+=`<span class="radar" style="left:${a.x}px;top:${a.y}px;--c:${a.a.color}"></span><span class="radar r2" style="left:${a.x}px;top:${a.y}px;--c:${a.a.color}"></span>`;
  for(const a of anchors) html+=`<div class="anchor" style="left:${a.x}px;top:${a.y}px;--c:${a.a.color}"><div class="tag"><b>Work · ${esc(a.a.name)}</b><span>${esc(a.a.sub)}</span></div><div class="pinA"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#111" stroke-width="2.2"><rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg></div></div>`;
  for(const p of pos){ const l=p.l, pc=petClass(l), st=statusOf(l.id), v=markerVisible(l); if(p.x<-20||p.x>w+20||p.y<-20||p.y>h+20) continue;
    html+=`<button class="marker ${pc} ${SHORT.includes(st)?"saved":""} ${v?"":"dimmed"} ${isNew(l)?"fresh":""} ${S.flash.has(l.id)?"flashm":""} ${S.popId===l.id||S.sideId===l.id?"on":""}" style="left:${p.x}px;top:${p.y}px" data-pop="${esc(l.id)}" aria-label="${esc(l.type+" in "+l.suburb+", "+rand(l.price))}" ${v?"":'tabindex="-1"'}>${ICON[pc]}</button>`; }
  if(S.popId && S.listings.get(S.popId)){ const p=pos.find(q=>q.l.id===S.popId); if(p) html+=popHtml(p,w,h); }
  $("overlay").innerHTML=html;
  $("dCount").textContent=`${vis.length} place${vis.length===1?"":"s"}`;
}
function popHtml(p,w,h){
  const l=p.l, st=statusOf(l.id); let left=p.x+20, top=p.y-30; if(left+270>w) left=p.x-280; if(top+190>h-60) top=h-250; if(top<8) top=8;
  return `<div class="pop" style="left:${Math.max(8,left)}px;top:${top}px">
    <div class="ph"><span class="marker ${petClass(l)}" style="position:static;transform:none;width:18px;height:18px;box-shadow:none">${ICON[petClass(l)].replace(/width="(13|26)" height="(13|26)"/,'width="11" height="11"')}</span>${esc(l.type)} · ${esc(l.suburb)}</div>
    <div class="row2"><span>${rand(l.price)} pm</span><span class="muted">${l.beds} bed · ${l.baths} bath</span></div>
    <div class="row2"><span class="muted">TecWise ~${l.min_tecwise} min</span><span class="muted">Drive ~${l.min_drive} min</span></div>
    <div class="row2"><span class="muted">${esc(petLabel(l))}</span>${st!=="new"?`<span class="status st-${st}">${STATUS_LABEL[st]}</span>`:""}</div>
    <div class="act"><button class="btn small primary" data-side="${esc(l.id)}" title="Show this place in a side panel">Expand ⤢</button><button class="btn small" data-heart="${esc(l.id)}">${SHORT.includes(st)?"♥ Saved":"♡ Interested"}</button><button class="btn small" data-closepop>Close</button></div>
  </div>`;
}
function zoomAt(f, cx, cy){ const nz=Math.max(.7,Math.min(6,VIEW.z*f)); const k=nz/VIEW.z; VIEW.tx=cx-(cx-VIEW.tx)*k; VIEW.ty=cy-(cy-VIEW.ty)*k; VIEW.z=nz; renderMap(); }
function schedule(light){ cancelAnimationFrame(raf); raf=requestAnimationFrame(()=>renderMap(light)); }
(function mapInput(){
  const area=$("mapArea"); const pts=new Map(); let pinch=null, moved=0;
  area.addEventListener("pointerdown",e=>{ if(e.target.closest(".marker,.pop,.dock,.mapLegend,.mapSide")) return; area.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.clientX,y:e.clientY}); moved=0;
    if(pts.size===2){ const [a,b]=[...pts.values()]; pinch={d:Math.hypot(a.x-b.x,a.y-b.y)}; } });
  area.addEventListener("pointermove",e=>{ if(!pts.has(e.pointerId)) return; const prev=pts.get(e.pointerId); const cur={x:e.clientX,y:e.clientY}; pts.set(e.pointerId,cur);
    if(pts.size===2 && pinch){ const [a,b]=[...pts.values()]; const d=Math.hypot(a.x-b.x,a.y-b.y); const r=area.getBoundingClientRect(); const f=d/pinch.d; pinch.d=d;
      const nz=Math.max(.7,Math.min(6,VIEW.z*f)), k=nz/VIEW.z, cx=(a.x+b.x)/2-r.left, cy=(a.y+b.y)/2-r.top; VIEW.tx=cx-(cx-VIEW.tx)*k; VIEW.ty=cy-(cy-VIEW.ty)*k; VIEW.z=nz; schedule(true); return; }
    VIEW.tx+=cur.x-prev.x; VIEW.ty+=cur.y-prev.y; moved+=Math.abs(cur.x-prev.x)+Math.abs(cur.y-prev.y); if(moved>3){ area.classList.add("dragging"); schedule(true); } });
  const end=e=>{ if(!pts.has(e.pointerId)) return; pts.delete(e.pointerId); if(pts.size<2) pinch=null; if(!pts.size){ area.classList.remove("dragging"); if(moved>3) renderMap(); } };
  area.addEventListener("pointerup",end); area.addEventListener("pointercancel",end);
  area.addEventListener("wheel",e=>{ if(e.target.closest(".mapSide,.pop")) return; e.preventDefault(); const r=area.getBoundingClientRect(); zoomAt(e.deltaY<0?1.18:1/1.18, e.clientX-r.left, e.clientY-r.top); },{passive:false});
})();

/* ---------- lower panels ---------- */
function renderBoard(){
  const all=activeAll();
  const rows=[["interested","Interested"],["contacted","Contacted"],["viewing","Viewing"],["applied","Applied"],["no","Not for us"]];
  const filler=n=>Array.from({length:Math.max(0,n)},()=>`<span class="d"></span>`).join("");
  $("board").innerHTML = rows.map(([k,lab])=>{ const items=all.filter(l=>statusOf(l.id)===k);
    return `<span class="rl">${lab} <span class="num" style="color:var(--fg)">${items.length}</span></span><div class="dots">${items.map(l=>`<button class="d ${k}" data-open="${esc(l.id)}" title="${esc(l.type+" · "+l.suburb+" · "+rand(l.price))}"></button>`).join("")}${filler(22-items.length*2)}</div>`; }).join("")
    + (all.length && !all.some(l=>statusOf(l.id)!=="new") ? `<span></span><span class="muted" style="font-size:12px">Nothing marked yet. Tap ♡ Interested on a place and it lands here.</span>` : "");
}
function renderTiles(){
  const all=activeAll(), n=all.length;
  const t=[["ok","Pet friendly","var(--pet)",ICON.ok,all.filter(l=>petClass(l)==="ok").length],
           ["no","No cats / no pets","var(--red)",'<svg width="14" height="14" viewBox="0 0 26 26"><path d="M13 3 24 22H2z" fill="#e5534b"/></svg>',all.filter(l=>petClass(l)==="no").length],
           ["ask","Pets: ask agent","var(--purple)",ICON.ask,all.filter(l=>petClass(l)==="ask").length],
           ["fibre","Fibre mentioned","var(--muted)",ICON.box,all.filter(fibreOk).length]];
  $("tiles").innerHTML=t.map(([k,lab,c,ic,v])=>`<button class="tile" data-tile="${k}" aria-pressed="${S.tile===k}"><span class="t"><span style="color:${c};display:grid;place-items:center">${ic}</span>${lab}</span><span><span class="s">Places</span><br><span class="big num"><span data-count="t-${k}" data-to="${v}">${v}</span><small> / ${n}</small></span></span></button>`).join("");
}

/* ---------- places list ---------- */
function renderTabs(){
  const all=[...S.listings.values()];
  const base=l=>l.active!==false;
  const tabs=[["places","All matching",listFor("places").length],["shortlist","Our shortlist",all.filter(l=>base(l)&&SHORT.includes(statusOf(l.id))).length],["new","New today",all.filter(l=>base(l)&&isNew(l)).length],["gone","No longer listed",all.filter(l=>!base(l)).length]];
  $("tabs").innerHTML=tabs.map(([k,t,c])=>`<button class="pill tab" role="tab" aria-pressed="${S.tab===k}" aria-selected="${S.tab===k}" data-tab="${k}">${t}<span class="c num">${c}</span></button>`).join("");
}
function grabTA(root){ const o={vals:{},focus:null,sel:null}; if(!root) return o; root.querySelectorAll("textarea[data-key]").forEach(ta=>{ o.vals[ta.dataset.key]=ta.value; if(ta===document.activeElement){ o.focus=ta.dataset.key; o.sel=[ta.selectionStart,ta.selectionEnd]; } }); return o; }
function putTA(root,o){ if(!root) return; root.querySelectorAll("textarea[data-key]").forEach(ta=>{ const k=ta.dataset.key; if(o.vals[k]!=null) ta.value=o.vals[k]; if(o.focus===k){ ta.focus(); try{ ta.setSelectionRange(o.sel[0],o.sel[1]); }catch(e){} } }); if(!S.editNote) root.querySelectorAll(".nList").forEach(nl=>nl.scrollTop=nl.scrollHeight); }
function rerenderNotes(){ renderList(); if(S.openId) renderDrawer(); }
function ago(iso){ const d=(Date.now()-new Date(iso).getTime())/1000; if(!(d>=0)) return ""; if(d<60) return "just now"; if(d<3600) return Math.round(d/60)+" min ago"; if(d<86400) return Math.round(d/3600)+" h ago"; if(d<86400*7) return Math.round(d/86400)+" d ago"; return new Date(iso).toLocaleDateString("en-ZA",{day:"numeric",month:"short"}); }
function whoIs(by){ if(!by) return "Someone"; return S.me && by===S.me ? "You" : by; }
function notesOf(id){ return (tr(id).log||[]).slice().sort((a,b)=>String(a.at).localeCompare(String(b.at))); }
function notesBlock(id, where){
  const log=notesOf(id);
  const items=log.length ? log.map(n=>{ const key=id+"|"+n.id, editing=S.editNote===key, armed=S.delArm===key;
      return `<div class="nItem ${n.by&&n.by===S.me?"mine":""} ${S.freshNote===n.id?(S.freshKind==="edit"?"shine":"fresh"):""}" data-nid="${esc(n.id)}"><div class="nMeta"><b>${esc(whoIs(n.by))}</b><span>${esc(ago(n.at))}</span>${n.edited?`<span class="nEdited" title="Edited ${esc(ago(n.edited))}${n.editedBy?" by "+esc(whoIs(n.editedBy)):""}">· edited</span>`:""}
        ${editing?"":`<span class="nActs"><button class="nAct" data-editnote="${esc(key)}" title="Edit this note" aria-label="Edit this note"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>Edit</button><button class="nAct del ${armed?"armed":""}" data-delnote="${esc(key)}" title="${armed?"Click again to delete":"Delete this note"}" aria-label="${armed?"Confirm delete":"Delete this note"}">${armed?"Delete?":`<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>Delete`}</button></span>`}</div>
        ${editing?`<div class="nEdit"><textarea data-key="edit:${esc(key)}" data-nedit="${esc(key)}" aria-label="Edit note">${esc(n.text)}</textarea><div class="row"><button class="btn small" data-canceledit="1">Cancel</button><button class="btn small primary" data-saveedit="${esc(key)}">Save</button></div></div>`:`<div class="nText">${esc(n.text)}</div>`}</div>`; }).join("")
    : `<div class="nEmpty">No notes yet. Jot down what the agent said, viewing times, deposit, anything.</div>`;
  return `<div class="notesBox" data-notes="${esc(id)}">
    <div class="nList">${items}</div>
    <div class="nAdd"><textarea data-key="add:${esc(id)}" data-nin="${esc(id)}" data-where="${where}" rows="1" placeholder="Add a note…" title="Enter to save · Shift+Enter for a new line"></textarea><button class="btn small primary" data-addnote="${esc(id)}" data-where="${where}">Add</button></div>
  </div>`;
}
async function addNote(id, text){
  text=text.trim(); if(!text) return false;
  // the id goes to the server too, so a retry after a lost reply can't post the note twice
  const n={id:"n"+Date.now().toString(36)+Math.random().toString(36).slice(2,7), by:S.me||null, at:new Date().toISOString(), text:text.slice(0,2000)};
  S.freshNote=n.id; S.freshKind="add"; setTimeout(()=>{ if(S.freshNote===n.id) S.freshNote=null; },1500);
  return saveTrack(id,{log:[...(tr(id).log||[]), n]},{op:"note.add",nid:n.id,text:n.text});
}
const safeUrl = u => /^https:\/\//i.test(u||"") ? esc(u) : "#";
const photosOf = l => (Array.isArray(l.photos)?l.photos:[]).filter(u=>/^https:\/\//i.test(u)).slice(0,12);
const photoImg = u => `<img class="lp" src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">`;
document.addEventListener("error", e=>{ if(e.target.classList && e.target.classList.contains("lp")) e.target.remove(); }, true); // hide broken photos
function card(l){
  const st=statusOf(l.id), t=tr(l.id), pc=petClass(l), fav=SHORT.includes(st);
  const facts=[`<span class="fact ${pc==="ask"?"pet-ask":pc}">${petLabel(l)}</span>`];
  if(fibreOk(l)) facts.push(`<span class="fact teal">Fibre</span>`);
  if(secOk(l)) facts.push(`<span class="fact">Security</span>`);
  if(l.available) facts.push(`<span class="fact">Available <b>${esc(l.available)}</b></span>`);
  if(l.note) facts.push(`<span class="fact ask">Check note</span>`);
  const ph=photosOf(l)[0];
  return `<article class="card ${l.active===false?"gone":""}" data-id="${esc(l.id)}" tabindex="0">
    ${isNew(l)?`<span class="newFlag">New</span>`:""}
    ${ph?photoImg(ph):""}
    <div class="top"><div style="min-width:0"><h3>${esc(l.type)} · ${esc(l.suburb)}</h3><div class="where">${esc(l.address||"Address on request")}</div></div>
      <div class="price num">${rand(l.price)}<small> pm</small></div></div>
    <div class="facts"><span class="fact"><b>${l.beds}</b> bed</span><span class="fact"><b>${l.baths}</b> bath</span>${l.size_m2?`<span class="fact"><b>${l.size_m2}</b> m²</span>`:""}<span class="fact">TecWise <b>~${l.min_tecwise}</b> min</span><span class="fact">Drive <b>~${l.min_drive}</b> min</span></div>
    <div class="facts">${facts.join("")}</div>
    ${t.note?`<div class="note">${esc(t.note)}</div>`:""}
    ${(()=>{ const log=notesOf(l.id); if(S.notesOpen.has(l.id)) return notesBlock(l.id,"card"); const ln=log[log.length-1]; return ln?`<div class="lastNote" data-notestoggle="${esc(l.id)}" title="Open notes"><b>${esc(whoIs(ln.by))}</b> <span class="when">· ${esc(ago(ln.at))}</span> — ${esc(ln.text)}</div>`:""; })()}
    <div class="foot"><span class="src">${esc(l.source)}${l.agency?` · ${esc(l.agency)}`:""}</span>
      <span class="row" style="flex-wrap:nowrap">${st!=="new"?`<span class="status st-${st}">${STATUS_LABEL[st]}</span>`:""}<button class="nBtn" data-notestoggle="${esc(l.id)}" aria-expanded="${S.notesOpen.has(l.id)}" title="Notes"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>Notes${(t.log||[]).length?`<span class="c">${(t.log||[]).length}</span>`:""}</button><button class="heart" data-heart="${esc(l.id)}" aria-pressed="${fav}">${fav?"♥ Saved":"♡ Interested"}</button></span></div>
  </article>`;
}
function renderList(){
  if(!S.session){ $("view").innerHTML=`<div class="empty"><h3>Sign in to see the places</h3>This list is private. <button class="btn small primary" data-signin>Sign in with Google</button></div>`; return; }
  if(!S.lastSync){ $("view").innerHTML=`<div class="empty"><h3>Loading the shared list…</h3>Places, saved marks and notes appear once the server answers.</div>`; return; }
  if(!S.listings.size){ $("view").innerHTML=`<div class="empty"><h3>No places yet</h3>The 6pm search adds places here every evening.</div>`; return; }
  const arr=listFor(S.tab);
  if(!arr.length){ const why=S.tab==="shortlist"?"Tap ♡ Interested on a place to add it to your shortlist.":S.tab==="new"?"Nothing new came in on the last search.":S.tab==="gone"?"Every place is still listed.":"No places match these filters. Try a higher max, another area, or switch a filter off.";
    $("view").innerHTML=`<div class="empty"><h3>Nothing to show</h3>${why}</div>`; return; }
  const keepN=grabTA($("view"));
  const enter=!S.listShown; S.listShown=true; $("view").innerHTML=`<div class="grid ${enter?"enter":""}">${arr.map(card).join("")}</div>`; $("view").querySelectorAll(".card").forEach((c,i)=>{ c.style.setProperty("--i",Math.min(i,30)); if(S.flash.has(c.dataset.id)) c.classList.add("flash"); });
  putTA($("view"),keepN);
}
function renderHeader(){
  if(!S.session){ $("updated").textContent="Private list · sign in to see the places"; return; }
  $("updated").innerHTML = S.meta.last_run ? `Data from the <span class="num">${esc(S.meta.last_run)}</span> search · 3 bed · 2 bath · ≤ R16 000 · within ~10 min of TecWise or Drive` : (S.loaded?"No search results yet":"Loading listings…");
}
function renderSide(){
  const box=$("mapSide"), l=S.sideId && S.listings.get(S.sideId);
  $("mapArea").classList.toggle("withSide", !!l);
  if(!l){ box.hidden=true; box.innerHTML=""; return; }
  const st=statusOf(l.id), t=tr(l.id), pc=petClass(l), phone=phoneOf(l), msg=fillTemplate(l);
  const wa=intl(phone)?`https://wa.me/${intl(phone)}?text=${encodeURIComponent(msg)}`:"";
  box.hidden=false;
  box.innerHTML=`<div class="sh"><div style="min-width:0"><div class="label">${esc(l.source)}${l.tier==="nearby"?" · just outside":""}</div><h3>${esc(l.type)} · ${esc(l.suburb)}</h3><div class="muted" style="font-size:12px">${esc(l.address||"Address on request")}</div></div>
      <button class="iconbtn" data-closeside aria-label="Close panel">×</button></div>
    <div class="sb">
      <div class="grid2">
        <div class="cell"><div class="k">Rent</div><div class="v num">${rand(l.price)}</div></div>
        <div class="cell"><div class="k">Size</div><div class="v num">${l.beds} bed · ${l.baths} bath</div></div>
        <div class="cell"><div class="k">To TecWise</div><div class="v num" style="color:#00F0FF">~${l.min_tecwise} min</div></div>
        <div class="cell"><div class="k">To Drive</div><div class="v num" style="color:#FF5CA8">~${l.min_drive} min</div></div>
      </div>
      <div class="facts"><span class="fact ${pc==="ask"?"pet-ask":pc}">${petLabel(l)}</span>${fibreOk(l)?`<span class="fact teal">Fibre</span>`:`<span class="fact ask">Fibre: ask</span>`}${secOk(l)?`<span class="fact">Security</span>`:`<span class="fact ask">Security: ask</span>`}${l.available?`<span class="fact">Available <b>${esc(l.available)}</b></span>`:""}${l.size_m2?`<span class="fact"><b>${l.size_m2}</b> m²</span>`:""}</div>
      ${l.summary?`<div>${esc(l.summary)}</div>`:`<div class="muted">No description saved yet. Open the listing for the full ad.</div>`}
      ${l.note?`<div class="banner">${esc(l.note)}</div>`:""}
      <div><div class="label" style="margin-bottom:6px">Where we are with it</div><div class="statusPick">${STATUSES.map(([k,v])=>`<button data-sidestatus="${k}" aria-pressed="${st===k}">${v}</button>`).join("")}</div></div>
      <div><div class="label" style="margin-bottom:6px">Contact</div><div>${esc(l.agency||"Agency not shown")}${l.agent?` · ${esc(l.agent)}`:""}</div>${phone?`<div class="num" style="margin-top:2px">${esc(prettyPhone(phone))}</div>`:`<div class="muted" style="font-size:12px;margin-top:2px">No number yet. Open the listing, tap "Show number", then add it under Full details.</div>`}</div>
      ${t.note?`<div><div class="label" style="margin-bottom:6px">Our notes</div><div class="note">${esc(t.note)}</div></div>`:""}
      <div class="row"><a class="btn small" href="${safeUrl(l.url)}" target="_blank" rel="noopener">Open listing</a>${wa?`<a class="btn small wa" href="${wa}" target="_blank" rel="noopener">WhatsApp</a>`:""}<a class="btn small" href="${safeUrl(l.maps_url)}" target="_blank" rel="noopener">Google Maps</a></div>
    </div>
    <div class="sf"><button class="btn primary" data-open="${esc(l.id)}">Full details ⤢</button><button class="btn" data-heart="${esc(l.id)}">${SHORT.includes(st)?"♥ Saved":"♡ Interested"}</button></div>`;
}
function render(){ renderHeader(); renderCharts(); renderGauges(); renderMap(); renderBoard(); renderTiles(); renderTabs(); renderList(); renderSide(); if(S.openId) renderDrawer(); }

/* ---------- drawer ---------- */
function fillTemplate(l){
  const tpl=S.settings.template||DEFAULT_TEMPLATE, first=(l.agent||"").split(" ")[0];
  return tpl.replace(/\{agent\}/g,first||"there").replace(/\{beds\}/g,l.beds).replace(/\{type\}/g,(l.type||"place").toLowerCase()).replace(/\{suburb\}/g,l.suburb).replace(/\{price\}/g,rand(l.price).slice(1)).replace(/\{link\}/g,l.url);
}
function openDrawer(id){ S.openId=id; S.popId=null; $("scrim").hidden=false; $("drawer").hidden=false; renderDrawer(true); renderMap(); try{history.replaceState(null,"","#"+id.replace(/[^\w.~-]/g,"_"))}catch(e){} }
function closeDrawer(){ S.openId=null; $("scrim").hidden=true; $("drawer").hidden=true; try{history.replaceState(null,"",location.pathname+location.search)}catch(e){} }
function renderDrawer(first){
  const l=S.listings.get(S.openId); if(!l){ closeDrawer(); return; }
  const t=tr(l.id), st=statusOf(l.id), phone=phoneOf(l), email=emailOf(l), msg=fillTemplate(l), pc=petClass(l);
  const activeId=document.activeElement && document.activeElement.closest && document.activeElement.closest("#drawer") ? document.activeElement.id : null;
  const keep={}; ["dPhone","dEmail","dNote","dView"].forEach(k=>{ const el=$(k); if(el && el===document.activeElement) keep[k]=el.value; });
  const dKeepTA=grabTA($("drawer"));
  const who=t.updatedBy?whoIs(t.updatedBy):null;
  const wa=intl(phone)?`https://wa.me/${intl(phone)}?text=${encodeURIComponent(msg)}`:"";
  const origin=encodeURIComponent(l.geo==="exact"?l.lat+","+l.lng:(l.address?l.address+", ":"")+l.suburb+", Centurion");
  $("drawer").innerHTML=`
   <div class="dHead"><div style="min-width:0"><div class="label">${esc(l.source)}${l.tier==="nearby"?" · just outside":""}</div><h2 id="dTitle">${esc(l.type)} in ${esc(l.suburb)}</h2>
     <div class="muted" style="margin-top:2px;font-size:13px">${esc(l.address||"Address on request")}</div>
     <div class="price num" style="margin-top:8px">${rand(l.price)}<small> pm${l.deposit?` · deposit ${esc(l.deposit)}`:""}</small></div></div>
     <button class="iconbtn x" id="dClose" aria-label="Close">×</button></div>
   <div class="dBody">
     ${photosOf(l).length?`<div class="photos">${photosOf(l).map(photoImg).join("")}</div>`:""}
     <div class="sec"><div class="label">Where we are with it</div>
       <div class="statusPick">${STATUSES.map(([k,v])=>`<button data-status="${k}" aria-pressed="${st===k}">${v}</button>`).join("")}</div>
       ${who?`<div class="muted" style="font-size:11px">Last changed by ${esc(who)}${t.updatedAt?` · ${new Date(t.updatedAt).toLocaleString("en-ZA",{dateStyle:"medium",timeStyle:"short"})}`:""}</div>`:""}</div>
     <div class="sec"><div class="label">Contact</div>
       <dl class="kv"><dt>Agency</dt><dd>${esc(l.agency||"Not shown on listing")}</dd><dt>Agent</dt><dd>${esc(l.agent||"Not shown on listing")}</dd>${l.phone_work?`<dt>Office</dt><dd class="num">${esc(prettyPhone(l.phone_work))}</dd>`:""}</dl>
       <div class="row">
         <div class="field" style="flex:1 1 160px"><label class="label" for="dPhone">Phone / WhatsApp</label><input id="dPhone" inputmode="tel" placeholder="e.g. 082 123 4567" value="${esc(keep.dPhone ?? prettyPhone(phone))}"></div>
         <div class="field" style="flex:1 1 200px"><label class="label" for="dEmail">Email</label><input id="dEmail" type="email" placeholder="agent@agency.co.za" value="${esc(keep.dEmail ?? email)}"></div></div>
       ${!phone?`<div class="muted" style="font-size:12px">The site hides the number behind "Show number". Open the listing, tap it, then paste the number here so you both have it.</div>`:""}
       <div class="row">
         <a class="btn wa" href="${wa||"#"}" target="_blank" rel="noopener" aria-disabled="${!wa}">WhatsApp</a>
         <a class="btn" href="${phone?"tel:"+intl(phone).replace(/^27/,"0"):"#"}" aria-disabled="${!phone}">Call</a>
         <a class="btn" href="${email?`mailto:${esc(email)}?subject=${encodeURIComponent("Rental enquiry: "+l.beds+"-bed "+l.type+" in "+l.suburb)}&body=${encodeURIComponent(msg)}`:"#"}" aria-disabled="${!email}">Email</a>
         <a class="btn primary" href="${safeUrl(l.url)}" target="_blank" rel="noopener">Open listing</a></div>
       ${phone?`<div class="muted" style="font-size:12px">Number <span class="num" style="color:var(--fg)">${esc(prettyPhone(phone))}</span> <button class="btn small" data-copy="${esc(prettyPhone(phone))}">Copy</button>${email?` · <span style="color:var(--fg)">${esc(email)}</span> <button class="btn small" data-copy="${esc(email)}">Copy</button>`:""}</div>`:""}
     </div>
     <div class="sec"><div class="label">Message for this place</div><div class="msg" id="dMsg">${esc(msg)}</div>
       <div class="row"><button class="btn" id="dCopyMsg">Copy message</button>${wa?`<a class="btn wa" href="${wa}" target="_blank" rel="noopener">Send on WhatsApp</a>`:""}</div></div>
     <div class="sec"><div class="label">Details</div>
       <div class="facts"><span class="fact ${pc==="ask"?"pet-ask":pc}">${petLabel(l)}</span>${fibreOk(l)?`<span class="fact teal">Fibre ${esc(l.fibre)}</span>`:`<span class="fact ask">Fibre: ask</span>`}${secOk(l)?`<span class="fact">Security</span>`:`<span class="fact ask">Security: ask</span>`}</div>
       <dl class="kv"><dt>Size</dt><dd><span class="num">${l.beds}</span> bed · <span class="num">${l.baths}</span> bath${l.size_m2?` · <span class="num">${l.size_m2}</span> m²`:""}</dd>
         <dt>Available</dt><dd>${esc(l.available||"Ask")}</dd><dt>Security</dt><dd>${esc(l.security||"Not described")}</dd><dt>Pets</dt><dd>${esc(l.pets||"unknown")}</dd>
         <dt>Drive time</dt><dd>TecWise ~<span class="num">${l.min_tecwise}</span> min · Drive ~<span class="num">${l.min_drive}</span> min <span class="muted">(estimate)</span></dd>
         <dt>First seen</dt><dd class="num">${esc(l.first_seen||"")}</dd>
         ${(l.price_history||[]).length>1?`<dt>Price history</dt><dd class="num">${l.price_history.map(p=>`${esc(p.date)}: ${rand(p.price)}`).join("<br>")}</dd>`:""}</dl>
       ${l.summary?`<p style="margin:0;font-size:13px">${esc(l.summary)}</p>`:""}
       ${l.note?`<div class="banner">${esc(l.note)}</div>`:""}
       ${(l.dupes||[]).length?`<div class="muted" style="font-size:11px">Also listed on another site.</div>`:""}
       <div class="row"><a class="btn" href="${safeUrl(l.maps_url)}" target="_blank" rel="noopener">Open in Google Maps</a>
         ${["drive","tecwise"].filter(k=>ANCHORS[k]).map(k=>`<a class="btn" href="${routeTo(origin,k)}" target="_blank" rel="noopener">Route to ${esc(ANCHORS[k].name)}</a>`).join("")}</div></div>
     <div class="sec"><div class="label">Our notes</div>
       <div class="field"><label class="label" for="dView">Viewing date / time</label><input id="dView" placeholder="e.g. Sat 18 Oct, 10:00" value="${esc(keep.dView ?? (t.viewing||""))}"></div>
       <div class="field"><label class="label" for="dNote">Notes</label><textarea id="dNote" placeholder="What did the agent say? What did we like?">${esc(keep.dNote ?? (t.note||""))}</textarea></div>
       <div class="row"><button class="btn primary" id="dSave">Save contact &amp; notes</button><span class="saved" id="dSavedMsg"></span></div></div>
     <div class="sec"><div class="label">Notes log · who said what</div>${notesBlock(l.id,"drawer")}</div>
   </div>`;
  if(activeId && $(activeId)) $(activeId).focus();
  putTA($("drawer"),dKeepTA); { const nl=$("drawer").querySelector(".nList"); if(nl && !S.editNote) nl.scrollTop=nl.scrollHeight; }
  if(first) $("dClose").focus();
}
// Shows the change straight away, sends one op to the save helper, then swaps in what the server kept.
// body defaults to {op:"set", fields:patch}; notes pass their own op. Server-side ops mean two people
// saving at once never overwrite each other.
async function saveTrack(id, patch, body){
  if(!S.session){ openWho("Sign in to save changes."); return false; }
  const sess=S.session;
  const prev=tr(id), cur=plain(prev)||{};
  S.track.set(id,plain(Object.assign({},cur,patch,{updatedAt:new Date().toISOString(),updatedBy:S.me}))); render();
  S.busy.set(id,(S.busy.get(id)||0)+1);
  const undo=msg=>{ if(S.busy.get(id)===1) S.track.set(id,prev); S.savedAt.delete(id); S.dataSha=null; render(); toast(msg,"error"); return false; };
  try{
    let r;
    for(let attempt=0; attempt<2 && !r; attempt++){
      try{ r=await fetch(CFG.workerUrl+"/op",{method:"POST",headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(plain({id,...(body||{op:"set",fields:patch})})),signal:AbortSignal.timeout(15000)}); }
      catch(e){ if(attempt===0) await new Promise(res=>setTimeout(res,700)); }
    }
    if(S.session!==sess) return false; // signed out while this was on its way
    if(!r) return undo("Couldn't reach the save helper. Check your connection and try again.");
    if(r.status===401||r.status===403){ undo(r.status===403?"You're not on the invite list any more":"Please sign in again"); signOut(r.status===403?"You're not on the invite list any more. Ask Dieter to add you.":"Your sign-in expired. Please sign in again."); return false; }
    const j=await r.json().catch(()=>({}));
    if(!r.ok || !j.entry) return undo(`Couldn't save: ${j.error||"error "+r.status}`);
    if(S.busy.get(id)===1) S.track.set(id,j.entry); S.savedAt.set(id,Date.now()); S.lastSync=Date.now(); updSync(); render();
    return true;
  } finally { S.busy.set(id,S.busy.get(id)-1); if(!S.busy.get(id)) S.busy.delete(id); }
}
async function copy(text){ try{ await navigator.clipboard.writeText(text); toast("Copied","copy"); }catch(e){ toast("Select the text and copy it","error"); } }

/* ---------- events ---------- */
document.addEventListener("click", async e=>{
  const el=e.target;
  const heart=el.closest("[data-heart]"); if(heart){ e.stopPropagation(); const id=heart.dataset.heart, st=statusOf(id); const rc=heart.getBoundingClientRect(); if(!SHORT.includes(st)) hearts(rc); else puff(rc); if(await saveTrack(id,{status:SHORT.includes(st)?"new":"interested"})) toast(SHORT.includes(statusOf(id))?"Added to your shortlist":"Removed from shortlist",SHORT.includes(statusOf(id))?"like":"unlike"); return; }
  const nt=el.closest("[data-notestoggle]"); if(nt){ e.stopPropagation(); const id=nt.dataset.notestoggle; if(S.notesOpen.has(id)) S.notesOpen.delete(id); else S.notesOpen.add(id); renderList(); if(S.notesOpen.has(id)){ const ta=document.querySelector(`#view textarea[data-nin="${CSS.escape(id)}"]`); if(ta) ta.focus(); } return; }
  const an=el.closest("[data-addnote]"); if(an){ e.stopPropagation(); const id=an.dataset.addnote; const box=an.closest(".notesBox"); const ta=box&&box.querySelector("textarea[data-nin]"); if(ta && ta.value.trim()){ const v=ta.value; ta.value=""; const ok=await addNote(id,v); if(ok){ noteAdded(an.getBoundingClientRect()); toast("Note saved for both of you","note"); } else ta.value=v; } else if(ta) ta.focus(); return; }
  const dn=el.closest("[data-delnote]"); if(dn){ e.stopPropagation(); const key=dn.dataset.delnote; const [id,nid]=key.split("|");
    if(S.delArm!==key){ S.delArm=key; clearTimeout(S.delT); S.delT=setTimeout(()=>{ if(S.delArm===key){ S.delArm=null; rerenderNotes(); } },3500); rerenderNotes(); return; }
    S.delArm=null; const item=dn.closest(".nItem"); const log=(tr(id).log||[]).filter(n=>n.id!==nid); noteDeleted(item?item.getBoundingClientRect():dn.getBoundingClientRect()); if(item && !RM){ item.classList.add("nGone"); await new Promise(r=>setTimeout(r,380)); } if(await saveTrack(id,{log},{op:"note.delete",nid})) toast("Note deleted","del"); return; }
  const ed=el.closest("[data-editnote]"); if(ed){ e.stopPropagation(); S.editNote=ed.dataset.editnote; S.delArm=null; rerenderNotes(); const ta=document.querySelector(`textarea[data-nedit="${CSS.escape(S.editNote)}"]`); if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length,ta.value.length); } return; }
  if(el.closest("[data-canceledit]")){ e.stopPropagation(); S.editNote=null; rerenderNotes(); return; }
  const se=el.closest("[data-saveedit]"); if(se){ e.stopPropagation(); const key=se.dataset.saveedit; const [id,nid]=key.split("|"); const ta=se.closest(".nEdit").querySelector("textarea"); const v=(ta?ta.value:"").trim();
    if(!v){ ta&&ta.focus(); toast("A note can't be empty. Use Delete to remove it.","error"); return; }
    const log=(tr(id).log||[]).map(n=>n.id===nid ? Object.assign({},n,{text:v.slice(0,2000),edited:new Date().toISOString(),editedBy:S.me||null}) : n);
    const rc=se.getBoundingClientRect(); S.editNote=null; S.freshNote=nid; S.freshKind="edit"; setTimeout(()=>{ if(S.freshNote===nid) S.freshNote=null; },1500); noteEdited(rc); if(await saveTrack(id,{log},{op:"note.edit",nid,text:v.slice(0,2000)})) toast("Note updated","edit"); return; }
  if(el.closest(".notesBox")) return;
  if(el.closest("[data-signin]")){ openWho(""); return; }
  const op=el.closest("[data-open]"); if(op){ openDrawer(op.dataset.open); return; }
  const pop=el.closest("[data-pop]"); if(pop){ S.popId = S.popId===pop.dataset.pop ? null : pop.dataset.pop; renderMap(); return; }
  if(el.closest("[data-closepop]")){ S.popId=null; renderMap(); return; }
  const sd=el.closest("[data-side]"); if(sd){ S.sideId=sd.dataset.side; S.popId=null; renderMap(); renderSide(); return; }
  if(el.closest("[data-closeside]")){ S.sideId=null; renderSide(); renderMap(); return; }
  const ss=el.closest("[data-sidestatus]"); if(ss && S.sideId){ sparkle(ss.getBoundingClientRect(), ss.dataset.sidestatus); if(await saveTrack(S.sideId,{status:ss.dataset.sidestatus})) toast("Marked "+STATUS_LABEL[ss.dataset.sidestatus].toLowerCase(),ss.dataset.sidestatus); return; }
  const tab=el.closest("[data-tab]"); if(tab){ S.tab=tab.dataset.tab; store.set("tab",S.tab); render(); return; }
  const jump=el.closest("[data-jump]"); if(jump){ S.tab=jump.dataset.jump; render(); $("placesSec").scrollIntoView({behavior:"smooth",block:"start"}); return; }
  const tile=el.closest("[data-tile]"); if(tile){ S.tile = S.tile===tile.dataset.tile ? null : tile.dataset.tile; render(); return; }
  const c=el.closest(".card"); if(c && !el.closest("a,button")){ openDrawer(c.dataset.id); return; }
  if(el.id==="dClose"||el.closest("#dClose")||el.id==="scrim"){ closeDrawer(); return; }
  const sp=el.closest("[data-status]"); if(sp && S.openId){ sparkle(sp.getBoundingClientRect(), sp.dataset.status); if(await saveTrack(S.openId,{status:sp.dataset.status})) toast("Marked "+STATUS_LABEL[sp.dataset.status].toLowerCase(),sp.dataset.status); return; }
  const cp=el.closest("[data-copy]"); if(cp){ copy(cp.dataset.copy); return; }
  if(el.id==="dCopyMsg"){ copy($("dMsg").textContent); return; }
  if(el.id==="dSave" && S.openId){ const ok=await saveTrack(S.openId,{phone:$("dPhone").value.trim(),email:$("dEmail").value.trim(),note:$("dNote").value.trim(),viewing:$("dView").value.trim()}); if(ok&&$("dSavedMsg")) $("dSavedMsg").textContent="Saved for both of you"; return; }
  const tog=el.closest("#tFibre,#tSec,#tHide"); if(tog){ tog.setAttribute("aria-pressed", tog.getAttribute("aria-pressed")!=="true"); store.set(tog.id,tog.getAttribute("aria-pressed")); render(); return; }
  const zb=el.closest("#zIn,#zOut,#zReset"); if(zb){ const a=$("mapArea"); if(zb.id==="zReset"){ VIEW.z=1; VIEW.tx=0; VIEW.ty=0; renderMap(); } else zoomAt(zb.id==="zIn"?1.35:1/1.35, a.clientWidth/2, a.clientHeight/2); return; }
  const dk=el.closest("#dAll,#dOk,#dSaved"); if(dk){ S.mapMode={dAll:"all",dOk:"ok",dSaved:"saved"}[dk.id]; ["dAll","dOk","dSaved"].forEach(i=>$(i).setAttribute("aria-pressed",String(i===dk.id))); renderMap(); return; }
});
document.addEventListener("keydown", e=>{ const et=e.target.closest&&e.target.closest("textarea[data-nedit]"); if(et){ if(e.key==="Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); const b=et.closest(".nEdit").querySelector("[data-saveedit]"); if(b) b.click(); } else if(e.key==="Escape"){ e.preventDefault(); e.stopPropagation(); S.editNote=null; rerenderNotes(); } return; }
  const ta=e.target.closest&&e.target.closest("textarea[data-nin]"); if(ta && e.key==="Enter" && !e.shiftKey && !e.isComposing){ e.preventDefault(); const b=ta.closest(".notesBox").querySelector("[data-addnote]"); if(b) b.click(); return; } if(ta && e.key==="Escape" && ta.dataset.where==="card"){ e.stopPropagation(); S.notesOpen.delete(ta.dataset.nin); renderList(); return; } if(e.key==="Enter" && ta) return;
  if(e.key==="Escape"){ if(S.openId) closeDrawer(); else if(S.popId){ S.popId=null; renderMap(); } else if(S.sideId){ S.sideId=null; renderSide(); renderMap(); } } if(e.key==="Enter" && e.target.classList && e.target.classList.contains("card")) openDrawer(e.target.dataset.id); });
["fArea","fMax","fPets","sort"].forEach(id=>$(id).addEventListener("change",()=>{ store.set(id,$(id).value); render(); }));
$("q").addEventListener("input",()=>render());
let rz; window.addEventListener("resize",()=>{ clearTimeout(rz); rz=setTimeout(renderMap,120); });

/* restore per-viewer view prefs */
S.tab=store.get("tab","places"); ["fArea","fMax","fPets","sort"].forEach(id=>{ const v=store.get(id,null); if(v!=null) $(id).value=v; });
["tFibre","tSec","tHide"].forEach(id=>{ const v=store.get(id,null); if(v!=null) $(id).setAttribute("aria-pressed",v); });
render();

/* ---------- motion helpers ---------- */
const RM = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
const PAL=["#FF5CA8","#BC6CFF","#00F0FF","#FFB86B"];
function fx(char,x,y,o){ const e=document.createElement("span"); e.className="fx"; e.textContent=char; e.style.left=x+"px"; e.style.top=y+"px";
  e.style.color=o.c; e.style.setProperty("--dx",o.dx+"px"); e.style.setProperty("--dy",o.dy+"px"); e.style.setProperty("--s",o.s); e.style.setProperty("--r",o.r+"deg"); e.style.setProperty("--fs",o.fs+"px"); e.style.setProperty("--t",o.t+"ms");
  document.body.appendChild(e); setTimeout(()=>e.remove(), o.t+60); }
function ring(x,y,c){ const e=document.createElement("span"); e.className="ringfx"; e.style.left=x+"px"; e.style.top=y+"px"; e.style.setProperty("--c",c); document.body.appendChild(e); setTimeout(()=>e.remove(),700); }
function hearts(rc){ if(RM) return; const x=rc.left+rc.width/2, y=rc.top+rc.height/2; ring(x,y,"#FF5CA8"); setTimeout(()=>ring(x,y,"#BC6CFF"),90);
  for(let i=0;i<14;i++){ const a=-Math.PI/2+(Math.random()-.5)*Math.PI*1.25, d=50+Math.random()*80;
    fx(i%4===3?"✦":"♥", x, y, {c:PAL[i%PAL.length], dx:Math.cos(a)*d, dy:Math.sin(a)*d-20, s:(.8+Math.random()*.9).toFixed(2), r:Math.round((Math.random()-.5)*70), fs:12+Math.random()*12, t:800+Math.random()*500}); } }
function noteAdded(rc){ if(RM) return; const x=rc.left+rc.width/2, y=rc.top+rc.height/2; ring(x,y,"#00F0FF");
  fx("✈",x,y,{c:"#00F0FF",dx:70,dy:-90,s:1.5,r:-20,fs:18,t:950});
  for(let i=0;i<9;i++){ const a=-Math.PI/2+(Math.random()-.5)*Math.PI, d=35+Math.random()*55; fx(["✎","✦","♪","•"][i%4],x,y,{c:PAL[i%PAL.length],dx:Math.cos(a)*d,dy:Math.sin(a)*d-10,s:(.7+Math.random()*.6).toFixed(2),r:Math.round((Math.random()-.5)*60),fs:10+Math.random()*9,t:700+Math.random()*400}); } }
function noteEdited(rc){ if(RM) return; const x=rc.left+rc.width/2, y=rc.top+rc.height/2; ring(x,y,"#FFB86B");
  for(let i=0;i<7;i++){ const a=Math.random()*Math.PI*2, d=25+Math.random()*40; fx(i%3===0?"✎":"✧",x,y,{c:i%2?"#FFB86B":"#BC6CFF",dx:Math.cos(a)*d,dy:Math.sin(a)*d,s:(.8+Math.random()*.5).toFixed(2),r:Math.round(Math.random()*120-60),fs:11+Math.random()*8,t:650+Math.random()*300}); } }
function noteDeleted(rc){ if(RM) return; const x=rc.right-30, y=rc.top+rc.height/2;
  for(let i=0;i<10;i++){ const a=(Math.random()-.5)*Math.PI*.9, d=30+Math.random()*60; fx(i%3===0?"✕":"•",x,y,{c:i%2?"#ff4d5e":"#8b9490",dx:Math.cos(a)*d+20,dy:Math.sin(a)*d+18,s:(.5+Math.random()*.6).toFixed(2),r:Math.round(Math.random()*200),fs:9+Math.random()*9,t:550+Math.random()*350}); } }
function puff(rc){ if(RM) return; const x=rc.left+rc.width/2, y=rc.top+rc.height/2; for(let i=0;i<5;i++) fx("·",x,y,{c:"#8b9490",dx:(Math.random()-.5)*60,dy:20+Math.random()*30,s:1.4,r:0,fs:22,t:600}); }
function sparkle(rc,st){ if(RM) return; const x=rc.left+rc.width/2, y=rc.top+rc.height/2; const c={interested:"#BC6CFF",contacted:"#00F0FF",viewing:"#FFB86B",applied:"#f4f7f5",no:"#ff4d5e"}[st]||"#BC6CFF"; ring(x,y,c);
  const chars=st==="applied"?["🎉","✦","✦"]:st==="viewing"?["🔑","✦"]:st==="no"?["✕"]:["✦","✧"];
  for(let i=0;i<(st==="no"?4:10);i++){ const a=Math.random()*Math.PI*2, d=30+Math.random()*50; fx(chars[i%chars.length],x,y,{c:i%2?c:PAL[i%4],dx:Math.cos(a)*d,dy:Math.sin(a)*d,s:(.7+Math.random()*.6).toFixed(2),r:Math.round(Math.random()*180),fs:10+Math.random()*10,t:700+Math.random()*300}); } }
function updSync(){ const el=$("sync"); if(!el) return; if(!S.lastSync){ el.textContent="connecting…"; return; } const s=Math.round((Date.now()-S.lastSync)/1000); el.textContent= s<10?"synced just now": s<60?`synced ${s}s ago`:`synced ${Math.round(s/60)} min ago`; }
setInterval(updSync, 10000);
// count-up numbers after each render
function countUps(){ document.querySelectorAll("[data-count]").forEach(el=>{ const k=el.dataset.count, to=+el.dataset.to, from=S.prevNums[k]; S.prevNums[k]=to; if(RM || from===undefined&&!S.loaded || from===to) return; const f=from===undefined?0:from, t0=performance.now(), dur=700;
  (function step(t){ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3); el.textContent=Math.round(f+(to-f)*e); if(p<1) requestAnimationFrame(step); })(t0); }); }
const _render=render; render=function(){ _render(); countUps(); };
/* legend minimise */
(function(){ const lg=$("mapLegend"), bt=$("lgToggle"); if(!lg||!bt) return;
  const set=m=>{ lg.classList.toggle("min",m); bt.setAttribute("aria-expanded",String(!m)); bt.title=m?"Show legend":"Minimise legend"; };
  let m=false; try{ const v=localStorage.getItem("rh-legend-min"); m = v===null ? window.innerWidth<700 : v==="1"; }catch(e){}
  set(m); bt.addEventListener("click",()=>{ m=!m; set(m); try{ localStorage.setItem("rh-legend-min",m?"1":"0"); }catch(e){} });
})();

/* ---------- data: only through the save helper, only once signed in ---------- */
const authHeaders = () => ({ Authorization: "Bearer "+S.session });
async function fetchData(){
  if(!CFG.workerUrl || !S.session) return [null,null];
  try{ const r=await fetch(CFG.workerUrl+"/data"+(S.dataSha?"?v="+encodeURIComponent(S.dataSha):""),{cache:"no-store",headers:authHeaders()});
    if(r.ok) return [await r.json(),null];
    if(r.status===401||r.status===403) return [null,r.status]; }catch(e){ console.warn("[rental] poll failed", e); }
  return [null,null];
}
// A poll that left before one of our saves landed would undo it on screen, so keep our copy for a few seconds.
// Returns true when it did, so the caller re-reads the full snapshot next time instead of trusting its sha.
function applyTrack(obj, started, quiet){
  const before=S.track, next=new Map(Object.entries(obj||{}).map(([k,v])=>[k,plain(v)])); let kept=false;
  for(const [id,at] of S.savedAt){ if(at<Date.now()-60000) S.savedAt.delete(id); }
  for(const id of new Set([...S.busy.keys(),...S.savedAt.keys()])){ if(S.busy.has(id) || S.savedAt.get(id)>started-8000){ const mine=before.get(id); if(mine){ next.set(id,mine); kept=true; } } }
  S.track=next;
  if(!quiet){ for(const [id,t] of S.track) partnerChanged(id, t, before.get(id)||{}); } // first load after sign-in: nothing is "new" yet
  return kept;
}
// Someone else changed a place: flash it, say what they did, and burst hearts if they shortlisted it.
function partnerChanged(id, t, o){
  const logN=(t.log||[]).length, oldN=(o.log||[]).length;
  if(!t.updatedBy || t.updatedBy===S.me) return;
  if(t.status===o.status && t.note===o.note && t.phone===o.phone && logN<=oldN) return;
  const l=S.listings.get(id); S.flash.add(id); setTimeout(()=>{ S.flash.delete(id); },2600);
  if(!l) return;
  const who=t.updatedBy;
  if(logN>oldN && t.status===o.status){
    const text=String(t.log[logN-1].text);
    toast(`${who} added a note on ${l.suburb}: “${text.slice(0,60)}${text.length>60?"…":""}”`,"partner");
  } else if(t.status===o.status){
    toast(`${who} updated ${l.type.toLowerCase()} in ${l.suburb}`,"partner");
  } else {
    toast(`${who} marked ${l.type.toLowerCase()} in ${l.suburb} as ${STATUS_LABEL[t.status||"new"].toLowerCase()}`,"partner");
  }
  if(SHORT.includes(t.status) && !SHORT.includes(o.status)){ const m=document.querySelector(`.card[data-id="${CSS.escape(id)}"] .heart`); if(m) hearts(m.getBoundingClientRect()); }
}
let loading=false;
async function load(){
  if(loading || !S.session) return;
  loading=true;
  const started=Date.now(), sess=S.session;
  try{
    const [d,denied]=await fetchData();
    if(S.session!==sess) return;
    if(denied){ signOut(denied===403?"You're not on the invite list any more. Ask Dieter to add you.":"Your sign-in expired. Please sign in again."); return; }
    if(!d){
      if(S.listings.size){ $("sync").textContent="reconnecting…"; }
      else { banner(CFG.workerUrl?"Couldn't load places right now. It keeps trying every few seconds.":"The site's server isn't set up yet."); }
      return;
    }
    banner(""); S.lastSync=Date.now(); updSync();
    if(d.same) return;
    // listings come from scraped sites: force numeric fields to numbers before they meet any template
    const NUM=["price","beds","baths","size_m2","min_tecwise","min_drive","lat","lng"];
    const first=!S.listings.size;
    S.listings=new Map(((d.listings&&d.listings.listings)||[]).map(l=>{ for(const k of NUM) l[k]=l[k]==null||l[k]===""?null:Number(l[k]); return [String(l.id),l]; }));
    S.meta=d.meta||{}; S.settings=d.settings||{}; setAnchors(d.listings&&d.listings.criteria);
    S.dataSha=applyTrack(d.track,started,first) ? null : (d.sha||null);
    S.loaded=true; render();
    if(first && location.hash.length>1){ const h=location.hash.slice(1); const hit=[...S.listings.keys()].find(k=>k.replace(/[^\w.~-]/g,"_")===h); if(hit) openDrawer(hit); }
  } finally { loading=false; }
}
setInterval(()=>{ if(document.visibilityState==="visible") load(); },15000);
document.addEventListener("visibilitychange",()=>{ if(document.visibilityState==="visible") load(); });

/* ---------- sign-in: Google, then the save helper checks the invite list and hands back a 30-day session ---------- */
function banner(msg){ $("banner").hidden=!msg; $("banner").textContent=msg||""; }
function updWho(){
  const on=!!S.session;
  $("whoName").textContent=on?S.me:"Sign in"; $("whoChip").classList.toggle("ro",!on); $("liveChip").hidden=!on;
  $("whoChip").title=on?"Signed in as "+S.me+" · tap to sign out":"Sign in with Google";
}
function remember(k,v){ try{ if(v) localStorage.setItem(k,v); else localStorage.removeItem(k); }catch(e){ console.warn("[rental] browser storage unavailable", e); } }
function signOut(msg){
  S.session=""; S.me=null; S.email=""; ["rh-session","rh-name","rh-email"].forEach(k=>remember(k,""));
  S.listings=new Map(); S.track=new Map(); S.dataSha=null; S.meta={}; S.lastSync=0; setAnchors(null); closeDrawer(); render(); updWho(); openWho(msg||"");
}
let gis=null;
function homeMsg(text, busy){ $("homeErr").textContent=text||""; $("homeErr").classList.toggle("busy",!!busy); }
function showGoogle(){
  if(!CFG.googleClientId){ homeMsg("Sign-in isn't set up yet."); return; }
  if(CFG.googleClientId==="dev") return; // local preview uses the dev form instead
  gis=gis||new Promise((res,rej)=>{ const sc=document.createElement("script"); sc.src="https://accounts.google.com/gsi/client"; sc.async=true; sc.onload=res; sc.onerror=rej; document.head.appendChild(sc); })
    .then(()=>google.accounts.id.initialize({client_id:CFG.googleClientId, callback:r=>signIn(r.credential), ux_mode:"popup", context:"signin"}));
  gis.then(()=>google.accounts.id.renderButton($("gBtn"),{theme:"outline",size:"large",shape:"pill",text:"continue_with",logo_alignment:"left",width:280}))
     .catch(err=>{ console.warn("[rental] Google sign-in didn't load", err); gis=null; homeMsg("Couldn't load Google sign-in. Check your connection and try again."); });
}
async function signIn(credential){
  homeMsg("Signing in…", true);
  try{
    const r=await fetch(CFG.workerUrl+"/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({credential})});
    const j=await r.json().catch(()=>({}));
    if(r.status===403){ homeMsg(`${j.email||"That account"} isn't on the invite list. Ask Dieter to add it.`); return; }
    if(!r.ok || !j.session){ homeMsg(j.error||"Sign-in didn't work, try again."); return; }
    S.session=j.session; S.me=j.name; S.email=j.email; remember("rh-session",j.session); remember("rh-name",j.name); remember("rh-email",j.email);
    homeMsg(""); document.documentElement.classList.remove("locked"); updWho(); S.dataSha=null; render(); toast(`Hi ${j.name}`,"info"); load();
  }catch(e){ console.warn("[rental] sign-in failed", e); homeMsg("Couldn't reach the site's server. Try again in a minute."); }
}
// Signed out: the home screen. Signed in: a small account panel with sign-out.
function showHome(msg){
  document.documentElement.classList.add("locked"); $("whoBox").hidden=true; homeMsg(msg);
  $("devForm").hidden=CFG.googleClientId!=="dev"; showGoogle();
}
function openWho(msg){
  if(!S.session){ showHome(msg); return; }
  const who=S.email ? `${S.me} (${S.email})` : S.me;
  $("whoMsg").textContent=`Signed in as ${who}.`; $("whoBox").hidden=false; $("whoClose").focus();
}
function closeWho(){ $("whoBox").hidden=true; }
$("whoChip").addEventListener("click",()=>openWho(""));
$("whoClose").addEventListener("click",closeWho);
$("whoSignOut").addEventListener("click",()=>{ signOut(""); toast("Signed out","info"); });
$("whoBox").addEventListener("click",e=>{ if(e.target.id==="whoBox") closeWho(); });
$("whoBox").addEventListener("keydown",e=>{ if(e.key==="Escape"){ e.stopPropagation(); closeWho(); } });
// Local preview only (googleClientId "dev"): the mock in test/dev.mjs plays Google.
$("devForm").addEventListener("submit",async e=>{ e.preventDefault();
  try{ signIn(await (await fetch(CFG.devTokenUrl+"?email="+encodeURIComponent($("devEmail").value.trim()))).text()); }catch(err){ console.warn("[rental] dev sign-in failed", err); homeMsg("Dev sign-in failed"); } });

/* ---------- spotlight glow: one pointer listener, once per frame: read every on-screen card's box, then write ---------- */
(function(){ if(!matchMedia("(hover:hover) and (pointer:fine)").matches) return;
  let f=0, x=-1e4, y=-1e4;
  const paint=()=>{ f=0; const cards=[...$("view").querySelectorAll(".card")], rs=cards.map(c=>c.getBoundingClientRect());
    cards.forEach((c,i)=>{ const r=rs[i]; if(r.bottom<0||r.top>innerHeight) return; c.style.setProperty("--lx",(x-r.left).toFixed(1)+"px"); c.style.setProperty("--ly",(y-r.top).toFixed(1)+"px"); });
    $("view").style.setProperty("--xp",(x/innerWidth).toFixed(3)); };
  const kick=()=>{ if(!f) f=requestAnimationFrame(paint); };
  document.addEventListener("pointermove",e=>{ x=e.clientX; y=e.clientY; kick(); },{passive:true});
  window.addEventListener("scroll",kick,{passive:true});
  new MutationObserver(kick).observe($("view"),{childList:true}); // cards get rebuilt on every render
})();

updWho(); if(S.session){ document.documentElement.classList.remove("locked"); load(); } else { S.loaded=true; showHome(""); }
