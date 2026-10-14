"""Write one JSON file per changed listing so they can be pushed to the dashboard's shared store.

Usage: python3 scripts/export_for_dashboard.py OUT_DIR
Reads data/changed.json + data/listings.json, writes OUT_DIR/<id>.json (record without "id"),
OUT_DIR/_batches.json (lists of ids, max 49 per batch) and OUT_DIR/_meta.json (the meta/run record).
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = sys.argv[1]
os.makedirs(out, exist_ok=True)
doc = json.load(open(os.path.join(ROOT, "data", "listings.json")))
ch = json.load(open(os.path.join(ROOT, "data", "changed.json")))
by_id = {l["id"]: l for l in doc["listings"]}
ids = [i for i in ch["changed"] if i in by_id]
for i in ids:
    rec = dict(by_id[i]); rec.pop("id", None)
    json.dump(rec, open(os.path.join(out, i + ".json"), "w"), ensure_ascii=False)
json.dump([ids[k:k + 49] for k in range(0, len(ids), 49)], open(os.path.join(out, "_batches.json"), "w"))
meta = {"last_run": ch["date"], "first_run": "2026-10-14", "count": ch["active"],
        "added": len(ch["added"]), "gone": len(ch["gone"]), "repriced": len(ch["repriced"]),
        "sources": ", ".join(doc.get("last_sources", [])) or "Private Property, Property24, MyProperty, Gumtree, Facebook, developer sites"}
json.dump(meta, open(os.path.join(out, "_meta.json"), "w"))
print(f"{len(ids)} records to push in {len(json.load(open(os.path.join(out, '_batches.json'))))} batch(es)")
