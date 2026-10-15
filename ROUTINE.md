# Rental Hunt – daily search routine

You are refreshing Dieter's rental site: https://doli4.github.io/rental-hunt/
Everything the site shows lives as files on the `data` branch of the **private** repo
https://github.com/DOli4/rental-hunt-data (this session needs read/write access to it). The scripts live in
the public repo https://github.com/DOli4/rental-hunt.
Fetch pages one at a time (never parallel bursts). Never click "Show number", never solve or bypass a
CAPTCHA, never work around a site that blocks you. If a site blocks you, skip it tonight.

## What qualifies

- 3+ bedrooms, 2+ bathrooms, rent R16 000 per month or less.
- Within ~10 min drive of either of Dieter's two work places (names and pins are in the private data:
  `data/listings.json` → `criteria.anchors`; don't copy them anywhere public). Places 10–17 min away show as
  "just outside". `scripts/geo.py` decides this; keep
  any Centurion listing and let the script drop the far ones. Skip "Zwartkoppies" (a different area east of Pretoria).
- Nice to have: pet friendly (two indoor cats, so record "no cats" / "no pets"), fibre, good security.

## 1. Check out the repo

```bash
git clone https://github.com/DOli4/rental-hunt.git rh && cd rh
git clone -b data --single-branch https://github.com/DOli4/rental-hunt-data.git data
```

`scripts/merge.py` reads and writes `./data/...`, which is now the private data repo.

## 2. Search (WebFetch; the shell usually can't reach these sites)

1. **Property24** (filters work):
   `https://www.property24.com/to-rent/centurion/gauteng/3?sp=bd%3d3%26bth%3d2%26pt%3d16000`, then
   `.../gauteng/3/p2?sp=...`, `/p3` … until a page has no listings (about 7 pages). List price, beds, baths,
   type, suburb and the listing URL for every card. The listing number is the last URL segment.
   Open the detail page only for listings not already in `data/listings.json` (for pets, fibre, security,
   agency, agent, availability, address, and photos: the page's `og:image` plus up to 6 gallery image URLs).
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

Ids: `p24-<number>`, `pp-RR<number>`, `mp-<number>`, `gt-<ad id>`, `fb-<item id>`, `dev-<name>`
(letters, digits and `. _ ~ -` only). If a new listing is clearly the same home as an existing one (same
suburb, price, size, agent), don't add it; mention it in your report instead.

### Photos (the site shows them on the honeycomb tiles and in each place's gallery)

- For every listing whose detail page you open tonight, collect its photos: the page's `og:image` first, then
  up to 7 more gallery image URLs (Property24: `images.prop24.com/...`; Private Property: `images.pp.co.za/...`,
  prefer the 1024/1600-wide versions). Only `https://` image URLs, no thumbnails of other listings.
- **Backfill:** also open the detail page (one at a time, same rules as above) for up to **25** active
  listings whose `photos` list is empty or missing in `data/listings.json`: shortlisted ones first (status
  interested / contacted / viewing in `data/track.json`), then the cheapest. Over a few nights every place gets photos.
- Put them in that listing's `photos` field in `run.json`. `merge.py` only fills `photos` when it was empty, so
  existing galleries are never overwritten.

## 3. Merge

Write `run.json` in the repo root:

```json
{"date":"YYYY-MM-DD","sources_ok":["Property24","Private Property","MyProperty","Gumtree"],"listings":[...]}
```

Each listing: id, source, url, type, suburb, address, price, beds, baths, size_m2, available,
pets ("yes" / "no" / "dogs only" / "small pets" / "unknown"), fibre ("yes" / "ready" / "unknown"), security,
agency, agent, phone (only if printed on the page), summary (one line), note, photos (list of https image
URLs; see Photos above). Include every qualifying listing seen tonight, old ones too. Only list a site in
`sources_ok` if you read it fully; listings from other sites stay active.

```bash
python3 scripts/merge.py run.json
```

This updates `data/listings.json`, `data/history/<date>.json`, `data/changed.json` and `data/meta.json`.

## 4. Commit and push the data

```bash
cd data
git add listings.json meta.json changed.json history/
git commit -m "Daily search <date>: +<added> new, -<gone> gone"
git push || (git pull --rebase && git push)
```

**Never modify `track.json` or `settings.json`.** They hold everyone's hearts, statuses and notes, and
people save to them through the site at any time. That's also why a rejected push is safe to rebase:
the search and the site never touch the same file.

## 5. Report

Send Dieter one short message: how many new places, any price drops, and anything on the shortlist
(entries in `data/track.json` with status interested, contacted or viewing) that changed price or
disappeared. If nothing changed, one line saying so.
