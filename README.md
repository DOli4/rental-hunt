# Centurion Rental Hunt

Dieter's hub for finding a 3-bedroom, 2-bathroom rental under R16 000 near TecWise (Estcourt Ave,
Wierdapark) and Drive (Irene).

- **The site:** https://doli4.github.io/rental-hunt/
- **Who can use it:** people on the invite list sign in with Google. Then they can see the places,
  heart them, set statuses, add/edit/delete notes and save numbers. Everyone else sees a sign-in screen.
- **Invite someone:** add their Google email to `ALLOWED_EMAILS` on Cloudflare (see
  [worker/README.md](worker/README.md#later)), then send them the link.
- **Every evening** a scheduled Claude session searches Property24, Private Property, MyProperty,
  Gumtree and new developments and commits the results to the private data repo. The steps are in
  [ROUTINE.md](ROUTINE.md).

## How it fits together

```
github.io page (index.html)  ── Google sign-in ──▶  save helper (Cloudflare Worker)  ── GitHub API ──▶  DOli4/rental-hunt-data
     public code, no data         invite list,           holds the keys                     (private) listings.json,
                                  30-day session                                            track.json, meta.json …
```

- **This repo** (public) is just the website code. GitHub Pages publishes it.
- **`DOli4/rental-hunt-data`** (private) holds everything the site shows, as plain files on its `data`
  branch. Only the save helper and the nightly search can read it.
- The page stores a signed 30-day session in the browser (for `doli4.github.io`, which this site shares
  with Dieter's CV site). Signing out forgets it on that device; removing someone from the invite list, or
  replacing `SESSION_SECRET`, ends it everywhere.

## What's where

| Path | What it is |
|---|---|
| `index.html` | The whole website |
| `config.js` | The save helper's address and the Google sign-in client id (both public) |
| `worker/` | The save helper and its [setup steps](worker/README.md) |
| `scripts/merge.py` | Folds a night's results into the data (new, still listed, gone, price changes) |
| `scripts/geo.py` | Map pins, drive-time estimates and the 10-minute / just-outside split |
| `scripts/seed_listings.py` | The first manual search (14 Oct 2026), kept for history |
| `test/` | Fake GitHub + Google, tests for the save helper, and a local preview (`node test/dev.mjs`) |

In `DOli4/rental-hunt-data` (branch `data`):

| File | Written by | What it is |
|---|---|---|
| `listings.json` | nightly search | Every place found so far, with first/last seen and price history |
| `track.json` | people, via the site | Hearts, statuses, phone/email, viewing times and the notes log |
| `meta.json` | nightly search | When it last ran and what changed |
| `settings.json` | you, by hand | Optional `{"template": "..."}` to change the WhatsApp/email message |
| `history/<date>.json` | nightly search | Snapshot after each night |

## Notes

- Drive times are estimates from straight-line distance, not routes. Use "Route to Drive" on a place
  for the real trip.
- Property24 and Private Property hide agent numbers behind a "Show number" button with a bot check,
  so the search doesn't collect them. Open the listing, tap the button, and paste the number into the
  place on the site; the WhatsApp, call and email buttons then work for everyone.
