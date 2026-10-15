"""Fold one evening's search results into data/listings.json.

Usage:
    python3 scripts/merge.py run.json

The run file is {"date": "YYYY-MM-DD", "sources_ok": ["Private Property", ...], "listings": [ ... ]}
where each listing uses the same fields as data/listings.json (id, source, url, type, suburb,
address, price, beds, baths, size_m2, available, pets, fibre, security, agency, agent, phone,
summary, lat/lng when known, note).

What it does:
  * new ids            -> added, first_seen = run date
  * ids seen again     -> last_seen updated, price changes appended to price_history,
                          empty fields filled from the new data (existing details are kept)
  * ids not seen again -> active = False, but only when their source is in sources_ok
                          (a site that failed to load doesn't make its listings disappear)
  * writes data/listings.json, data/history/<date>.json, data/changed.json (what changed tonight)
    and data/meta.json (shown in the site header). Never touches data/track.json or data/settings.json.

data/ is a checkout of the repo's `data` branch (git clone -b data --single-branch <repo> data).
"""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import anchors, enrich  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LISTINGS = os.path.join(ROOT, "data", "listings.json")
MAX_PRICE = 16000


def main(run_path):
    run = json.load(open(run_path, encoding="utf-8"))
    date = run["date"]
    ok_sources = set(run.get("sources_ok", []))
    doc = json.load(open(LISTINGS, encoding="utf-8"))
    cur = {l["id"]: l for l in doc["listings"]}
    changed, added, gone, repriced = set(), [], [], []
    seen = set()

    for n in run["listings"]:
        if n.get("price") is None or n["price"] > MAX_PRICE or n.get("beds", 0) < 3 or float(n.get("baths", 0)) < 2:
            continue
        n = enrich(n)
        if n["tier"] == "outside":
            continue
        seen.add(n["id"])
        if n["id"] not in cur:
            n.update(first_seen=date, last_seen=date, active=True,
                     price_history=[{"date": date, "price": n["price"]}])
            n.setdefault("dupes", []); n.setdefault("note", ""); n.setdefault("email", ""); n.setdefault("phone_work", "")
            cur[n["id"]] = n
            added.append(n["id"]); changed.add(n["id"])
            continue
        o = cur[n["id"]]
        before = json.dumps(o, sort_keys=True)
        o["last_seen"] = date
        o["active"] = True
        if n["price"] != o["price"]:
            o.setdefault("price_history", []).append({"date": date, "price": n["price"]})
            repriced.append((o["id"], o["price"], n["price"]))
            o["price"] = n["price"]
        for k, v in n.items():
            if k in ("first_seen", "price_history"):
                continue
            if v not in (None, "", "unknown", []) and o.get(k) in (None, "", "unknown", []):
                o[k] = v
        if o.get("available") != n.get("available") and n.get("available"):
            o["available"] = n["available"]
        if json.dumps(o, sort_keys=True) != before:
            changed.add(o["id"])

    for i, o in cur.items():
        if i not in seen and o.get("active", True) and o["source"] in ok_sources:
            o["active"] = False
            gone.append(i); changed.add(i)

    doc["listings"] = sorted(cur.values(), key=lambda x: (not x.get("active", True), x["tier"] != "core", x["price"]))
    doc["updated"] = date
    json.dump(doc, open(LISTINGS, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    os.makedirs(os.path.join(ROOT, "data", "history"), exist_ok=True)
    json.dump(doc, open(os.path.join(ROOT, "data", "history", date + ".json"), "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    summary = {"date": date, "sources_ok": sorted(ok_sources), "added": added, "gone": gone,
               "repriced": [{"id": a, "from": b, "to": c} for a, b, c in repriced],
               "changed": sorted(changed), "active": sum(1 for l in cur.values() if l.get("active", True))}
    json.dump(summary, open(os.path.join(ROOT, "data", "changed.json"), "w"), indent=1)
    meta_path = os.path.join(ROOT, "data", "meta.json")
    old = json.load(open(meta_path, encoding="utf-8")) if os.path.exists(meta_path) else {}
    meta = {"last_run": date, "first_run": old.get("first_run", date), "count": summary["active"],
            "added": len(added), "gone": len(gone), "repriced": len(repriced),
            "sources": ", ".join(sorted(ok_sources)) or old.get("sources", ""),
            "anchors": " and ".join(a["label"] for a in anchors().values())}
    json.dump(meta, open(meta_path, "w", encoding="utf-8"), indent=1, ensure_ascii=False)
    print(json.dumps({k: (len(v) if isinstance(v, list) else v) for k, v in summary.items()}))


if __name__ == "__main__":
    main(sys.argv[1])
