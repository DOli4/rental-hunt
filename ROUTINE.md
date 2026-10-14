# Daily 6pm search routine

Instructions for the scheduled Claude session that refreshes the rental list every evening.
Work through the steps in order. Keep the run polite: fetch pages one at a time, never in parallel
bursts, and never click "Show number", solve CAPTCHAs or work around a site that blocks you.

## What we're looking for

| | |
|---|---|
| Bedrooms | 3 or more |
| Bathrooms | 2 or more |
| Rent | R16 000 per month or less |
| Area | Within ~10 min drive of **TecWise** (Estcourt Ave, Wierdapark, Centurion) or **Drive.co.za** (Guernsey Business Park, Saltus St, Irene Ext 192). Places 10–17 min away go in the "just outside" tab. `scripts/geo.py` works this out. |
| Nice to have | Pet friendly (two cats – "no cats" or "no pets" is a dealbreaker worth recording), fibre, good security |

Suburbs that usually qualify: near TecWise – Wierdapark, Eldoraigne, Eldo Glen, Rooihuiskraal, The Reeds,
Amberfield, Heuweloord, Heuwelsig, Celtisdal, Raslouw, Thatchfield, Monavoni; near Drive – Irene (incl. Hereford,
Galloway, Southdowns), Highveld (incl. Eco Park), Doringkloof, Pierre van Ryneveld, Rietvalleipark; in between –
Centurion Central, Die Hoewes, Zwartkop, Hennopspark, Clubview, Lyttelton. `scripts/geo.py` decides the tier;
add a suburb to its CENTRES list when a new one turns up. Skip anything in "Zwartkoppies" (east of Pretoria,
sometimes tagged Zwartkop).

## Sources (use WebFetch; the shell cannot reach these sites)

1. **Property24** – filtered search works with WebFetch:
   `https://www.property24.com/to-rent/centurion/gauteng/3?sp=bd%3d3%26bth%3d2%26pt%3d16000`
   then `/p2`, `/p3`, … before the `?sp=` until a page has no listings (about 7 pages).
   Keep everything; `scripts/merge.py` drops places more than ~17 minutes from both work locations. Open the detail page only for listings that are new since
   `data/listings.json` (to read pets, fibre, security, agency, agent, availability, address).
   If Property24 answers "Server unavailable", skip it for tonight and leave it out of `sources_ok`.
2. **Private Property** – WebFetch drops search filters, so read each suburb page and pick the 3-bed,
   2-bath rows at R16 000 or less:
   `https://www.privateproperty.co.za/to-rent/gauteng/centurion/centurion-east/<slug>/<id>`
   (die-hoewes/198, lyttelton-manor/1709, highveld/197, irene/1050, clubview/195, zwartkop/201,
   hennopspark/1280, doringkloof/213, pierre-van-ryneveld/199, centurion-central/2164,
   golden-fields-estate/7331) and
   `https://www.privateproperty.co.za/to-rent/gauteng/centurion/centurion-west/<slug>/<id>`
   (eldoraigne/196, wierda-park/202, rooihuiskraal/1295, rooihuiskraal-north/205, amberfield/206, heuweloord/…, the-reeds/…, celtisdal/1287 – take ids from the suburb links on any Centurion West page). Add `?page=2` while there are more pages.
   Open detail pages only for new listings.
3. **MyProperty** – `https://www.myproperty.co.za/en-za/to-rent/gauteng/centurion?bedrooms=3&bathrooms=2&maxPrice=16000`
   (skip anything marked "Rented").
4. **Gumtree** – `https://www.gumtree.co.za/property/house/centurion`,
   `/property/townhouse/centurion`, `/property/apartment-flat/centurion` (rentals only).
5. **New developments / direct landlords** – one WebSearch for new rental estates in Centurion or Irene,
   and check `https://www.centraldevelopments.co.za/colorado-apartments-and-houses-to-let-in-centurion`.

The same home is often on several sites. Give each listing the id `<site>-<listing number>`
(`pp-RR4785455`, `p24-117601859`, `mp-2495362`, `gt-<ad id>`, `fb-<item id>`, `dev-<name>`).
When a new listing is clearly the same place as an existing one (same suburb, price, size, agent),
don't add it again; add its id to the existing record's `dupes` instead.

## Steps

1. Read `data/listings.json` so you know what already exists.
2. Search the sources above.
3. Write `data/runs/<YYYY-MM-DD>.json`:
   ```json
   {"date": "2026-10-15", "sources_ok": ["Property24", "Private Property", "MyProperty", "Gumtree"],
    "listings": [{"id": "...", "source": "Property24", "url": "...", "type": "Townhouse",
                  "suburb": "Die Hoewes", "address": "", "price": 14500, "beds": 3, "baths": 2,
                  "size_m2": 120, "available": "1 Nov", "pets": "yes|no|dogs only|unknown",
                  "fibre": "yes|ready|unknown", "security": "24h guard, access control",
                  "agency": "...", "agent": "...", "phone": "", "summary": "one line", "note": ""}]}
   ```
   Include every qualifying listing you saw tonight, old ones too, so the merge knows they are still listed.
   List a site in `sources_ok` only if you read it fully; listings from sites left out stay active.
4. Run `python3 scripts/merge.py data/runs/<date>.json`.
5. Run `python3 scripts/export_for_dashboard.py <scratch dir>`, then push to the dashboard's shared store
   (artifact URL in README.md) with the ArtifactData tool, `action: "batch"`, one batch per list in
   `_batches.json`: `{"op": "set", "collection": "listings", "doc_id": <id>, "file_path": "<scratch>/<id>.json"}`.
   Existing records need `if_version`, so `list` the `listings` collection first (limit 1000) to get versions.
   Then `get` `meta/run` and `set` it from `_meta.json` with that version.
   Never write to the `track` or `prefs` collections: those hold Dieter's own marks and notes.
6. Commit everything (`data/`, run file) with the message `Daily search <date>: +N new, -N gone` and push.
7. Send Dieter a short message: how many new places, any price drops on places they marked interested
   (read the `track` collection: status "interested", "contacted" or "viewing"), and anything that
   disappeared from their shortlist. If nothing changed, say so in one line.
