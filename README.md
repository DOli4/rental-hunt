# Centurion Rental Hunt

Dieter's hub for finding a 3-bedroom, 2-bathroom rental under R16 000 near TecWise (Estcourt Ave,
Wierdapark) and Drive (Irene).

- **Dashboard:** https://claude.ai/artifact/LeTuEg4SwbQ3qU7gM9HuqV (private; share it from the page's
  Share menu, as Contributor, so the other person can mark places and add notes)
- **Every evening at 6pm** a scheduled Claude session searches Property24, Private Property, MyProperty,
  Gumtree and new developments, updates `data/listings.json`, commits it here and refreshes the dashboard.
  The steps it follows are in [ROUTINE.md](ROUTINE.md).

## What's where

| Path | What it is |
|---|---|
| `dashboard/index.html` | Source of the dashboard page (published as a Claude artifact) |
| `data/listings.json` | Every place found so far, with first/last seen dates and price history |
| `data/history/<date>.json` | Snapshot after each evening's search |
| `data/runs/<date>.json` | Raw results of each evening's search |
| `scripts/merge.py` | Folds a night's results into `listings.json` (new, still listed, gone, price changes) |
| `scripts/geo.py` | Map pins, drive-time estimates and the 10-minute / just-outside split |
| `scripts/export_for_dashboard.py` | Prepares changed records for the dashboard's shared store |
| `scripts/seed_listings.py` | The first manual search (14 Oct 2026) |

## Where saved marks live

"Interested", status, phone numbers you paste in, viewing dates and notes are saved in the dashboard's
own shared store (the `track` collection), so both of you see the same thing instantly. The daily
search never touches them. Listing data lives here in git as well as in the dashboard.

## Notes

- Drive times are estimates from straight-line distance, not routes. Use "Route to Drive" on a place
  for the real trip.
- Property24 and Private Property hide agent numbers behind a "Show number" button with a bot check,
  so the search doesn't collect them. Open the listing, tap the button, and paste the number into the
  place on the dashboard; the WhatsApp, call and email buttons then work for both of you.
