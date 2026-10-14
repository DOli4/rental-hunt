# Hand-off: move Dieter's rental dashboard to a GitHub-hosted website

You're taking over a working project from another Claude session. Read this whole brief before you start. The project files are in the zip that came with it (`rental-hunt-handoff.zip`). Unzip it and work from there.

---

## 1. Who this is for and what exists today

**Dieter Olivier** (dieter@drive.co.za, Johannesburg, timezone Africa/Johannesburg) is looking for a rental with these criteria:

- 3+ bedrooms, 2+ bathrooms, **≤ R16 000/month**.
- Ideally pet friendly (**two indoor cats**), fibre, good security.
- Within ~10 min drive of one of his two work sites:
  - **TecWise**: Estcourt Ave, Wierdapark, Centurion (lat −25.8722, lng 28.1590).
  - **Drive**: Guernsey Business Park, Saltus St, Irene (lat −25.8538, lng 28.2506).
- "Just outside" tier: 10–17 min. Anything further is dropped.

Today the dashboard is a **Claude artifact**, a single HTML page hosted on claude.ai. Its data lives in the artifact's built-in database, and a **daily Claude scheduled task (17:53 SAST)** re-runs the search and updates that database.

**Why we're moving:** on a claude.ai artifact, people outside Dieter's organisation who open a public link get **view-only** access. Dieter wants to share a link with his partner and friends and have them **interact**: heart places, set statuses, add and edit notes, save phone numbers. So we're moving to:

> A website hosted on **Dieter's GitHub** (GitHub Pages), where **all the data is stored as files in the repo**.

Dieter likes casual, direct communication. He isn't a heavy developer, so any steps he has to do himself must be click-by-click.

---

## 2. What's in the zip

```
rental-hunt/
  dashboard/index.html     ← the current dashboard (single file, ~920 lines, works on claude.ai today)
  dashboard/roads.txt      ← OSM road geometry (already embedded inside index.html as ROADS_RAW)
  scripts/geo.py           ← anchors, suburb centres, drive-time estimate, tiering (core ≤10, nearby ≤17)
  scripts/merge.py         ← folds one night's search results into listings.json (new/seen/gone, price history)
  scripts/seed_listings.py ← the original manual search data (history only)
  scripts/from_db.py, scripts/export_for_dashboard.py ← artifact-database specific; will no longer be needed
  ROUTINE.md               ← the current nightly-search instructions (artifact version; rewrite for git)
  README.md
  google-sheet/            ← an old, unused alternative backend (ignore or delete)
  data/                    ← old copy of listings.json + history (main branch; will move to the data branch)
  handoff/data-branch/     ← CURRENT LIVE DATA exported from the artifact database today:
      listings.json        ← {updated, criteria, listings:[113 listings]}
      track.json           ← {<listingId>: {status, updatedAt, updatedBy, log:[...]}, ...}  (Dieter's marks)
      meta.json            ← {last_run, first_run, count, sources, anchors}
      settings.json        ← {} (optional {template} override for the message template)
      history/2026-10-14.json
  handoff/PROMPT.md        ← this file
```

The local git history in the zip, if present, has commit author `Dieter Olivier <dieter@drive.co.za>`.

---

## 3. Target architecture

```
GitHub repo  <dieter>/rental-hunt   (PUBLIC: GitHub Pages is free only on public repos)
├── branch main   → the website (GitHub Pages serves this)
│     index.html, config.js, worker/, scripts/, ROUTINE.md, README.md
└── branch data   → ALL the info, as plain files (Pages does NOT build from this branch)
      listings.json  track.json  meta.json  settings.json  history/YYYY-MM-DD.json  changed.json
```

**Why a separate `data` branch:** every save is a git commit. If saves landed on `main`, each heart or note would trigger a Pages rebuild, and Pages has a soft limit of about 10 builds per hour. With a `data` branch the site never rebuilds because of data changes.

**Why a save helper is needed:** a static site can't write to GitHub without a token, and a token in public JavaScript would be stolen. So a tiny **Cloudflare Worker** (free plan) holds the token and makes the commits:

```
Browser (index.html on github.io)
   ├─ GET  https://<worker>/data   → {listings, track, meta, settings, sha?}   (fresh from the data branch)
   └─ POST https://<worker>/op     → applies one change, commits to data branch, returns updated track entry
Worker  ── GitHub REST API (Contents API) with a fine-grained token: Contents read/write on this ONE repo only
```

**People and access:**

- No accounts. On first visit the site asks for **"Your name"** (e.g. Dieter, Anna) and the **shared passcode**. Both are stored in `localStorage`.
- The name is used as `updatedBy` and as a note's `by`.
- The worker rejects writes without the right passcode (secret `PASSCODE`).
- Anyone can still *read* the site, since the repo is public anyway.
- Without a passcode, the site works **read-only**. Controls stay visible, but they prompt for the passcode instead of saving.

---

## 4. Data formats (keep them compatible with the scripts)

**listings.json**: `{ "updated": "YYYY-MM-DD", "criteria": {...}, "listings": [Listing] }`

```
Listing = { id, source, url, type, suburb, address, price, beds, baths, size_m2, available,
  pets ("yes"|"no"|"dogs only"|"small pets"|"unknown"), fibre ("yes"|"ready"|"unknown"), security,
  agency, agent, phone, email, phone_work, summary, note, lat, lng, geo, min_tecwise, min_drive,
  tier ("core"|"nearby"), maps_url, dupes:[], first_seen, last_seen, active (bool),
  price_history:[{date, price}] , photos?: [url,...] (optional, new) }
```

ID formats: `p24-<n>`, `pp-RR<n>`, `mp-<n>`, `gt-<id>`, `fb-<id>`, `dev-<name>`. All match `^[A-Za-z0-9._~-]+$`.

**track.json**: one object keyed by listing id. Only people write this; the nightly search NEVER touches it.

```
Track = { status?: "new"|"interested"|"contacted"|"viewing"|"applied"|"no",
  phone?, email?, viewing?, note?   (free-text fields from the detail drawer),
  log?: [ { id, by, at (ISO), text, edited? (ISO), editedBy? } ]   (the notes log),
  updatedAt (ISO), updatedBy (display name) }
```

**meta.json**: `{ last_run, first_run, count, added?, gone?, repriced?, sources, anchors }`. Written by the nightly search.

**settings.json**: `{ template?: string }` overrides the default WhatsApp/email message template. Optional, read-only in the UI.

---

## 5. The save helper (Cloudflare Worker), `worker/worker.js`

ES module Worker (`export default { fetch }`). Config comes from environment:

- **Secrets:** `GITHUB_TOKEN`, `PASSCODE`.
- **Vars:** `REPO` (e.g. `dieterolivier/rental-hunt`), `BRANCH` (`data`), `ALLOWED_ORIGIN` (e.g. `https://dieterolivier.github.io`; allow `http://localhost:*` too for testing).

**Endpoints:**

1. `OPTIONS *`: CORS preflight. Allow `Content-Type, X-Passcode, X-Name`.
2. `GET /data`: read `listings.json`, `track.json`, `meta.json`, `settings.json` from `BRANCH` via `GET /repos/{REPO}/contents/{path}?ref={BRANCH}`.
   - Return `{listings, track, meta, settings, trackSha}`.
   - Use `Accept: application/vnd.github.raw+json` for content, or decode base64 as UTF-8. listings.json can exceed 1 MB later, so prefer the raw media type.
   - Cache 5 s with `caches.default` to protect the rate limit (authenticated limit is 5,000 requests/hour).
   - Always send a `User-Agent` header.
3. `POST /op` with body `{ id, op, ...args }` and headers `X-Passcode`, `X-Name`:
   - Reject with 401 if the passcode is wrong (constant-time compare).
   - Reject with 400 if `id` fails the regex or isn't in listings.
   - Read `track.json` with its `sha`, apply the op to `track[id]`, set `updatedAt` = now and `updatedBy` = name (trimmed, max 40 chars).
   - PUT back with `sha`, branch `data`, and a human commit message, e.g. `Anna: note on Heuwelsig Estate`, `Dieter: marked pp-RR3738527 interested`.
   - On 409/422 (sha conflict), re-read and re-apply. Retry up to 5 times with a small random backoff. This is what makes two friends saving at the same moment safe.
   - Return `{ ok: true, entry: track[id] }`.
   - **Ops** (server-side merge, so nobody overwrites someone else's change):
     - `set`: `{fields}` whitelisted to `status`, `phone`, `email`, `viewing`, `note`. Validate `status` against the enum. Strings max 2,000 chars.
     - `note.add`: `{text}`. The server creates `{id: random, by: name, at: now, text}` and appends it to `log`.
     - `note.edit`: `{nid, text}`. Sets text, `edited` = now, `editedBy` = name. Empty text → 400.
     - `note.delete`: `{nid}`. Removes it from `log`.
   - Anyone with the passcode may edit or delete any note. Dieter asked for that.
4. Any other path → 404. Never echo the token. Log errors without request bodies.

Also write `worker/README.md` with Dieter's click-by-click setup:

- **Cloudflare:** create a free account → Workers & Pages → Create Worker → paste the code → Settings → Variables: add `REPO`, `BRANCH`, `ALLOWED_ORIGIN` and secrets `GITHUB_TOKEN`, `PASSCODE` → Deploy → copy the `*.workers.dev` URL into `config.js`.
- **GitHub token:** Settings → Developer settings → Fine-grained tokens → only this repo → Repository permissions → **Contents: Read and write**, nothing else → choose an expiry and set a reminder to renew it.

Optionally add `worker/wrangler.toml` for people who use Wrangler.

---

## 6. Port the dashboard to the website (`index.html` + `config.js` on main)

Start from `dashboard/index.html`. Keep **everything** about its look and behaviour; only replace the data layer. `config.js`:

```js
window.RENTAL_CONFIG = { workerUrl: "https://rental-hunt.<sub>.workers.dev",
  rawBase: "https://raw.githubusercontent.com/<owner>/rental-hunt/data/" };
```

**What to replace** (line numbers are approximate, from the current file):

1. **`boot()` (~line 898)** currently uses `window.claude.use("db")` / `use("user")` and `onSnapshot` on `listings`, `track`, `meta/run`, `prefs/settings`. Replace it with:
   - `load()`: `GET {workerUrl}/data`. If the worker is unreachable or not configured, fall back to `fetch(rawBase + "listings.json")` etc., which can be up to ~5 minutes stale.
   - Fill `S.listings` (a Map of id → listing with `id`), `S.track` (Map), `S.meta`, `S.settings`.
   - **Live feel:** poll every ~15 s while the tab is visible (`document.visibilityState`), and right after every successful save use the returned `entry`.
   - Keep the existing "partner changed something" detection: compare the old and new `S.track`. If an entry's `updatedBy !== S.me` changed its status or notes, show the purple partner toast, flash the card and burst hearts.
   - Keep `S.lastSync` / `updSync()` ("synced Xs ago").
   - Keep the deep-link-by-hash behaviour.
2. **Identity:** `S.me` = the display name from `localStorage` (`rh-name`). `whoIs(by)` returns "You" when `by === S.me`, otherwise `by` itself (names are already human). Drop `S.user`, `S.names` and the `user.profiles` lookup.
   - Add a small **"Who's this?" panel** (name + passcode) shown on first visit, and when someone tries to save without a passcode.
   - Add a chip in the header showing the current name, with a way to change it. Style it like the existing Live chip.
3. **`saveTrack(id, patch)` (~line 800)**: keep the optimistic update and rollback-on-failure, but POST to `/op`:
   - status, phone, email, viewing and note go through `op:"set"`.
   - 401 → toast "Wrong passcode" and reopen the passcode panel. Network error → retry once, then the error toast.
   - **Use plain JSON copies** (the current code has a `plain()` helper). Never send objects you got back from elsewhere without copying.
4. **Notes:**
   - `addNote` (~line 671) → `op:"note.add"`.
   - The edit-save handler (~line 829) → `op:"note.edit"`.
   - The delete handler (~line 824) → `op:"note.delete"`.
   - Keep all the animations: paper-plane on add, shimmer on edit, fly-away on delete, two-step "Delete?" confirm.
   - The server now creates note ids. Optimistic UI can use a temporary id, replaced when the response arrives.
5. Remove the claude.ai-only banner text ("Open this page while signed in to Claude…"). Replace it with read-only / passcode messaging.
6. Keep the `<title>` "Centurion Rental Hunt". Add a favicon if you like (an inline SVG house is fine).

**Features that must keep working** (all exist today; test each one):

- **Header:** gradient brand, "Live" chip with blinking dot, "synced Xs ago", data-date line.
- **Gauges** (draw-in animation, count-up numbers) and **tiles** that filter: Pet friendly / No cats / Pets: ask (purple `#9D6BFF`).
- **Filter bar:** area (Within 10 min / Just outside / Everything), Max price, Pets, search box (also searches notes), toggles Fibre / Security / Hide "not for us".
- **Places section:**
  - Header has **Order by** (Best match; Closest to Drive / TecWise; Price low→high / high→low; Size small→large / large→small with unknown sizes last; Newest) **next to** the tabs All matching / Our shortlist / New today / No longer listed.
- **Cards:**
  - Facts and pet badge.
  - ♡ Interested heart with a burst of hearts when liking.
  - 💬 Notes button with count, opening an inline notes box.
  - Latest-note preview, which opens the notes box when clicked.
  - **No hover lift** (Dieter asked for that to be removed); only a glow.
- **Detail drawer:** status pills with sparkles, contact fields, WhatsApp / Call / Email / Open listing / Google Maps / Route to Drive / Route to TecWise, message template (mentions two indoor cats, signed Dieter), Notes log.
- **Map** (custom canvas, no tiles):
  - Dot field, OSM roads and suburb labels.
  - Dashed 10-min rings, radar pings on the TecWise (cyan `#00F0FF`) and Drive (pink `#FF5CA8`) anchors, slow sweep.
  - Pan, zoom and pinch; dock filters (All / Pets OK / Saved); zoom buttons.
  - Marker popup with "Expand ⤢" → docked side panel → "Full details".
  - **Minimisable legend** (remembered in `localStorage`).
  - No twinkling sparkle canvas; Dieter had it removed.
- **Toasts:** colour-themed glowing chips with an icon per action (like pink ♥, unlike grey ♡, note cyan ✎, edit orange ✎, delete red ✕, partner purple ●, statuses in their colours, error red !).
- **Theme:** dark gray background, Miami palette, Lexend font. Tokens: `--teal:#BC6CFF; --violet/--cyan:#00F0FF; --fuchsia:#FF5CA8; --peach/--orange:#FFB86B; --pet:#34d399; --purple:#9D6BFF; --red:#ff4d5e; --night:#0B0F2B; --grad:linear-gradient(135deg,#00F0FF,#BC6CFF,#FF5CA8)`.
- `[hidden]{display:none!important}` must stay. Several panels set `display:flex`.
- `prefers-reduced-motion` turns animations off.
- **Phone layout:** works at ~380 px wide, 16 px side gutters, no horizontal scroll.

**New things that are now possible** (on the real web there's no artifact CSP):

- **Listing photos in cards and the drawer.** Support `listing.photos[]` with `loading="lazy"` and `referrerpolicy="no-referrer"`, hiding broken images. The nightly search can start collecting the listing's `og:image` / gallery URLs.
- **A real tiled map** (Leaflet + OSM tiles) instead of the canvas map. **Ask Dieter before switching**; he likes the current look. Photos are the priority.

---

## 7. The nightly search (rewrite for git)

Today a Claude scheduled task (on Dieter's main Claude account, task "Rental hunt daily search", 17:53 SAST) follows `ROUTINE.md`. It writes to the artifact database using `from_db.py` and `export_for_dashboard.py`. Rewrite `ROUTINE.md` (and the scripts) so a nightly run does this:

1. Clone the repo: `main` for the scripts, plus the `data` branch into `./data`. `git clone -b data --single-branch … data` works because `merge.py` reads `ROOT/data/listings.json`.
2. Search the sources one page at a time (never parallel bursts):
   - **Property24** via server-side fetch (filters work: `https://www.property24.com/to-rent/centurion/gauteng/3?sp=bd%3d3%26bth%3d2%26pt%3d16000`, pages `/p2…`).
   - **Private Property** suburb pages, 3-bed/2-bath ≤ R16 000.
   - **MyProperty**.
   - **Gumtree**.
   - One web search for new developments.
   - ROUTINE.md has the exact URLs and suburb slugs.
3. Write `run.json` → `python3 scripts/merge.py run.json` (updates `data/listings.json`, `data/history/<date>.json`, `data/changed.json`) → write `data/meta.json` (last_run, count, added, gone, repriced, sources).
4. `git add` + commit on the data branch, message `Daily search <date>: +N new, -N gone`, then push.
   - **Never modify `track.json` or `settings.json`.**
   - If the push is rejected because someone saved meanwhile: `git pull --rebase` and push again. There's no conflict, since the search never touches track.json.
5. Report to Dieter in one short message: new places, price drops, and changes to anything on the shortlist (`track.json` statuses interested / contacted / viewing).

**Hard rules for scraping:**

- Fetch pages one at a time. Property24 blocked Dieter's IP once after parallel requests.
- **Never** click "Show number".
- **Never** solve or bypass CAPTCHAs.
- **Never** work around a site that blocks you; skip it for the night.

Delete `scripts/from_db.py` and `scripts/export_for_dashboard.py` once nothing uses them.

> **Important for the scheduled task:** you (the Claude doing this hand-off) are probably on a different Claude account from the one that owns the scheduled task. Once the repo and site are live, tell Dieter to **go back to his main Claude chat and ask it to "point the daily rental search at the GitHub repo <owner>/rental-hunt"**, so that Claude updates the existing scheduled task. Alternatively, if Dieter prefers, set up an equivalent scheduled job on your side. Either way, there must end up being exactly **one** nightly search, not two.

---

## 8. Step-by-step plan

1. Ask Dieter for his **GitHub username** and confirm the repo name `rental-hunt` and that it'll be **public** (required for free Pages). Warn him that everything in the repo, including notes and agent phone numbers, is readable by anyone who finds it.
2. Create the repo.
   - `main`: website + worker + scripts + docs. Move the old `data/` off main and add `.gitignore` entries for `__pycache__/` and `.s/`.
   - Orphan branch `data`: the contents of `handoff/data-branch/` at its root.
   - Commit as `Dieter Olivier <dieter@drive.co.za>` if his git setup doesn't already do that.
3. Write `worker/worker.js` + `worker/README.md`. Write the ported `index.html` + `config.js` (placeholder worker URL until Dieter deploys).
4. **Test locally before pushing:**
   - Run the worker against a **mock GitHub Contents API**: a small Node server that stores files in memory, returns sha, and returns 409 on stale sha.
   - Serve `index.html` and drive it with Playwright under two names in two pages.
   - Heart a place, set a status, add / edit / delete notes, and save phone/email from both pages at nearly the same time. Confirm nothing is lost and the other page sees the change within one poll.
   - Check read-only mode with no passcode and the 401 on a wrong passcode.
   - Check the phone width.
   - Fix anything you find.
5. Push. Enable **Settings → Pages → Deploy from a branch → main / root**. Wait for `https://<owner>.github.io/rental-hunt/` to be live and check it loads read-only from the raw fallback.
6. Walk Dieter through the Cloudflare Worker and the GitHub token (worker/README.md). Put the worker URL in `config.js`, push, and check that a real save creates a commit on the `data` branch.
7. Rewrite `ROUTINE.md` + scripts for git. Then hand Dieter the one-line instruction for updating the scheduled task (see §7).
8. Final check, then give Dieter:
   - the site link,
   - the passcode reminder (he chooses it; never print it in the repo),
   - how to share with friends: send the link + passcode,
   - how to change the passcode: Cloudflare → Worker → Settings → secret.

---

## 9. Done means

- `https://<owner>.github.io/rental-hunt/` shows all 113+ listings with the exact current look.
- Friends with the link + passcode can heart, mark status, add / edit / delete notes, and save contact details. Every change is a commit on the `data` branch, with the person's name in the message.
- A second open browser sees changes within ~15 s, with the partner toast.
- Without a passcode the site is read-only and still useful.
- No secret is anywhere in the repo or the page source.
- The nightly search updates `data/listings.json` + `meta.json` on the `data` branch and never touches `track.json`. Exactly one nightly search exists.
- `README.md` explains the setup in plain language for Dieter.
