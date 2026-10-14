"""Prepare changed listings for the dashboard's shared store.

Usage: python3 scripts/export_for_dashboard.py OUT_DIR
Reads data/changed.json, data/listings.json and (if present) data/versions.json. Writes:
  OUT_DIR/<id>.json      one record per changed listing (without "id")
  OUT_DIR/batch_N.json   ready-made ArtifactData "batch" write lists (max 49 entries each),
                         with if_version filled in for records that already exist in the store
  OUT_DIR/meta.json      the new meta/run record
  OUT_DIR/versions_next.json  the meta/versions record to save after the batches succeed
"""
import json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
out = os.path.abspath(sys.argv[1])
os.makedirs(out, exist_ok=True)
doc = json.load(open(os.path.join(ROOT, "data", "listings.json")))
ch = json.load(open(os.path.join(ROOT, "data", "changed.json")))
vp = os.path.join(ROOT, "data", "versions.json")
versions = json.load(open(vp)) if os.path.exists(vp) else {}
by_id = {l["id"]: l for l in doc["listings"]}
writes = []
for i in ch["changed"]:
    if i not in by_id:
        continue
    rec = dict(by_id[i]); rec.pop("id", None)
    path = os.path.join(out, i + ".json")
    json.dump(rec, open(path, "w"), ensure_ascii=False)
    w = {"op": "set", "collection": "listings", "doc_id": i, "file_path": path}
    if i in versions:
        w["if_version"] = versions[i]
    writes.append(w)
batches = [writes[k:k + 49] for k in range(0, len(writes), 49)]
for n, b in enumerate(batches, 1):
    json.dump(b, open(os.path.join(out, f"batch_{n}.json"), "w"))
nxt = dict(versions)
for w in writes:
    nxt[w["doc_id"]] = w.get("if_version", 0) + 1
json.dump({"v": nxt}, open(os.path.join(out, "versions_next.json"), "w"))
meta = {"last_run": ch["date"], "first_run": "2026-10-14", "count": ch["active"],
        "added": len(ch["added"]), "gone": len(ch["gone"]), "repriced": len(ch["repriced"]),
        "anchors": "TecWise (Estcourt Ave, Wierdapark) and Drive (Irene)",
        "sources": ", ".join(ch.get("sources_ok", [])) or "Property24, Private Property, MyProperty, Gumtree"}
json.dump(meta, open(os.path.join(out, "meta.json"), "w"))
print(f"{len(writes)} records to push in {len(batches)} batch file(s): " + ", ".join(f"batch_{n}.json" for n in range(1, len(batches) + 1)))
