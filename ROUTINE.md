# Rental Hunt – daily search routine

You are refreshing Dieter's rental dashboard: https://claude.ai/artifact/LeTuEg4SwbQ3qU7gM9HuqV
Run everything in this cloud session. Fetch pages one at a time (never parallel bursts), never click
"Show number", solve CAPTCHAs or work around a site that blocks you. If a site blocks you, skip it tonight.

## What qualifies

- 3+ bedrooms, 2+ bathrooms, rent R16 000 per month or less.
- Within ~10 min drive of **TecWise** (Estcourt Ave, Wierdapark, Centurion) or **Drive** (Guernsey Business
  Park, Saltus St, Irene). Places 10–17 min away show as "just outside". `geo.py` decides this; keep any
  Centurion listing and let the script drop the far ones. Skip "Zwartkoppies" (a different area east of Pretoria).
- Nice to have: pet friendly (two cats, so record "no cats"/"no pets"), fibre, good security.

## 1. Set up a work folder

1. `mkdir -p ~/rh && cd ~/rh`
2. Artifact tool, `action: "read"`, `url` above, `paths: ["routine/merge.py","routine/geo.py","routine/from_db.py","routine/export_for_dashboard.py"]`,
   `out_dir: "~/rh"` (use the absolute path). The scripts land in `~/rh/routine/`.
3. ArtifactData `list`, collection `listings`, `query: {"limit": 1000}`, `out_dir: ~/rh/db`.
4. ArtifactData `get`, collection `meta`, doc_id `versions`, `out_dir: ~/rh/db`. Note its `version` (V_versions).
5. ArtifactData `get`, collection `meta`, doc_id `run`. Note its `version` (V_run).
6. `python3 routine/from_db.py ~/rh/db` – rebuilds `~/rh/data/listings.json`.

## 2. Search (WebFetch; the shell cannot reach these sites)

1. **Property24** (filters work):
   `https://www.property24.com/to-rent/centurion/gauteng/3?sp=bd%3d3%26bth%3d2%26pt%3d16000`, then
   `.../gauteng/3/p2?sp=...`, `/p3` … until a page has no listings (about 7 pages). Ask WebFetch to list
   price, beds, baths, type, suburb and the listing URL for every card. The listing number is the last URL segment.
   Open the detail page only for listings not already in `data/listings.json` (for pets, fibre, security,
   agency, agent, availability, address).
2. **Private Property** (WebFetch drops filters, so read suburb pages and keep 3-bed, 2-bath rows ≤ R16 000):
   `https://www.privateproperty.co.za/to-rent/gauteng/centurion/centurion-east/<slug>/<id>` for
   die-hoewes/198, lyttelton-manor/1709, highveld/197, irene/1050, clubview/195, zwartkop/201, hennopspark/1280,
   doringkloof/213, pierre-van-ryneveld/199, centurion-central/2164; and
   `https://www.privateproperty.co.za/to-rent/gauteng/centurion/centurion-west/<slug>/<id>` for eldoraigne/196,
   wierda-park/202, rooihuiskraal/1295, rooihuiskraal-north/205, amberfield/206, celtisdal/1287 (follow
   `?page=2` while more pages exist). Listing ids look like RR4785455.
3. **MyProperty**: `https://www.myproperty.co.za/en-za/to-rent/gauteng/centurion?bedrooms=3&bathrooms=2&maxPrice=16000` (skip "Rented").
4. **Gumtree**: `https://www.gumtree.co.za/property/house/centurion`, `/property/townhouse/centurion`,
   `/property/apartment-flat/centurion` (rentals only).
5. One WebSearch for new rental estates or developments in Centurion / Irene renting 3-bedroom units.

Ids: `p24-<number>`, `pp-RR<number>`, `mp-<number>`, `gt-<ad id>`, `fb-<item id>`, `dev-<name>`.
If a new listing is clearly the same home as an existing one (same suburb, price, size, agent), don't add it;
note it in your report instead.

## 3. Merge and push

1. Write `~/rh/run.json`:
   `{"date":"YYYY-MM-DD","sources_ok":["Property24","Private Property","MyProperty","Gumtree"],"listings":[...]}`
   Each listing: id, source, url, type, suburb, address, price, beds, baths, size_m2, available,
   pets ("yes" / "no" / "dogs only" / "small pets" / "unknown"), fibre ("yes" / "ready" / "unknown"), security,
   agency, agent, phone (only if printed on the page), summary (one line), note.
   Include every qualifying listing seen tonight, old ones too. Only list a site in `sources_ok` if you read it
   fully; listings from other sites stay active.
2. `python3 routine/merge.py run.json`
3. `python3 routine/export_for_dashboard.py ~/rh/out`
4. For each `~/rh/out/batch_N.json`: ArtifactData `batch` with `writes` = that file's array, unchanged.
   If a batch fails on a version, re-run step 1.3–1.6 and 3.2–3.4 once; if it fails again, stop and report.
5. ArtifactData `set` meta/versions with `file_path: ~/rh/out/versions_next.json`, `if_version: V_versions`.
6. ArtifactData `set` meta/run with `file_path: ~/rh/out/meta.json`, `if_version: V_run`.
   Never write the `track` or `prefs` collections: they hold Dieter's marks and notes.
7. If a GitHub repo for this project is attached to the session, also copy `data/` there and commit
   `Daily search <date>: +N new, -N gone`.

## 4. Report

Send Dieter one short message: how many new places, any price drops, and anything on their shortlist
(ArtifactData `list` of `track`: status interested, contacted or viewing) that changed price or disappeared.
If nothing changed, one line saying so.
