# Centurion Rental Hunt

Dieter's hub for finding a 3-bedroom, 2-bathroom rental under R16 000 near TecWise (Estcourt Ave,
Wierdapark) and Drive (Irene).

- **The site:** https://doli4.github.io/rental-hunt/
- **Share it:** send the link plus the passcode. On their first visit people type their name and the
  passcode; after that they can heart places, set statuses, add/edit/delete notes and save numbers.
  Without the passcode the site still works, just read-only.
- **Every evening** a scheduled Claude session searches Property24, Private Property, MyProperty,
  Gumtree and new developments and commits the results to the `data` branch. The steps are in
  [ROUTINE.md](ROUTINE.md).

> **Heads-up:** this repo is public (GitHub Pages is only free on public repos), so anyone who finds it
> can read the listings, notes and any phone numbers saved here. Don't put anything private in notes.

## How it fits together

```
github.io page (index.html)  ── reads ──▶  save helper (Cloudflare Worker)  ── GitHub API ──▶  data branch
                             ── saves ──▶          checks the passcode                        listings.json, track.json …
```

- **`main` branch** is the website. GitHub Pages publishes it.
- **`data` branch** holds everything the site shows, as plain files. Saves land there so they don't
  rebuild the website every time.
- If the save helper is down, the page falls back to reading the `data` branch directly (read-only,
  up to ~5 minutes old).

## What's where

| Path | What it is |
|---|---|
| `index.html` | The whole website |
| `config.js` | Where the save helper lives (`workerUrl`) and where the read-only fallback reads from |
| `worker/` | The save helper and its [setup steps](worker/README.md) |
| `scripts/merge.py` | Folds a night's results into the data (new, still listed, gone, price changes) |
| `scripts/geo.py` | Map pins, drive-time estimates and the 10-minute / just-outside split |
| `scripts/seed_listings.py` | The first manual search (14 Oct 2026), kept for history |
| `test/` | A fake GitHub plus tests for the save helper, and a local preview (`node test/dev.mjs`) |

On the `data` branch:

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
