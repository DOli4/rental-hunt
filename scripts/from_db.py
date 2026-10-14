"""Rebuild data/listings.json from a dashboard-store export.

Usage: python3 scripts/from_db.py DB_EXPORT_DIR
DB_EXPORT_DIR is the out_dir given to ArtifactData `list` on the "listings" collection (documents land
in DB_EXPORT_DIR/listings/<id>.json) and to ArtifactData `get` of meta/versions (DB_EXPORT_DIR/meta/versions.json).
Writes data/listings.json and data/versions.json (id -> store version) for export_for_dashboard.py.
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1]
files = glob.glob(os.path.join(src, "listings", "*.json")) or glob.glob(os.path.join(src, "*.json"))
listings, versions = [], {}
for f in files:
    raw = json.load(open(f))
    doc_id = raw.get("id") if isinstance(raw.get("data"), dict) else os.path.splitext(os.path.basename(f))[0]
    data = raw["data"] if isinstance(raw.get("data"), dict) else raw
    if "version" in raw and isinstance(raw.get("data"), dict):
        versions[doc_id] = raw["version"]
    rec = dict(data); rec["id"] = doc_id or os.path.splitext(os.path.basename(f))[0]
    listings.append(rec)
vfile = os.path.join(src, "meta", "versions.json")
if os.path.exists(vfile):
    vraw = json.load(open(vfile))
    versions.update((vraw.get("data") or vraw).get("v", {}))
os.makedirs(os.path.join(ROOT, "data"), exist_ok=True)
json.dump({"updated": max([l.get("last_seen", "") for l in listings] or [""]), "listings": listings},
          open(os.path.join(ROOT, "data", "listings.json"), "w"), indent=1, ensure_ascii=False)
json.dump(versions, open(os.path.join(ROOT, "data", "versions.json"), "w"))
print(f"{len(listings)} listings rebuilt, {len(versions)} versions known")
