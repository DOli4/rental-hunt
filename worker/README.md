# The save helper (Cloudflare Worker)

The website is just files on GitHub Pages, so on its own it can't save anything. This little helper
runs on Cloudflare's free plan. It holds a GitHub key that can only touch this one repo, checks the
passcode, and turns every heart, status or note into a commit on the `data` branch.

Takes about 15 minutes, once. You'll pick a **passcode** along the way: that's what you send your
partner and friends together with the link.

## Step 1: a GitHub key that can only touch this repo

1. On github.com, click your picture (top right) → **Settings**.
2. Scroll the left menu all the way down → **Developer settings**.
3. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
4. Fill in:
   - **Token name**: `rental-hunt save helper`
   - **Expiration**: 1 year (put a reminder in your calendar a week before, to make a new one)
   - **Repository access**: **Only select repositories** → pick `rental-hunt`
   - **Permissions** → **Repository permissions** → **Contents** → **Read and write**.
     Leave everything else as it is (GitHub adds "Metadata: read-only" by itself, that's fine).
5. **Generate token** and **copy it** (it starts with `github_pat_`). GitHub shows it only once. Keep the
   tab open until step 2 is done.

## Step 2: the helper on Cloudflare

1. Go to https://dash.cloudflare.com/sign-up and make a free account (or log in).
2. Left menu → **Compute (Workers)** → **Workers & Pages** → **Create** → **Create Worker**
   (pick "Start with Hello World" if it asks).
3. Name it `rental-hunt` → **Deploy**.
4. Click **Edit code**. Delete everything in the editor, paste the whole of
   [`worker.js`](worker.js) from this folder, then **Deploy** (top right).
5. Go back to the worker → **Settings** → **Variables and Secrets** → **Add**, five times:

   | Type | Name | Value |
   |---|---|---|
   | Text | `REPO` | `DOli4/rental-hunt` |
   | Text | `BRANCH` | `data` |
   | Text | `ALLOWED_ORIGIN` | `https://doli4.github.io` |
   | Secret | `GITHUB_TOKEN` | the `github_pat_…` key from step 1 |
   | Secret | `PASSCODE` | a passcode you make up, e.g. three random words |

   Click **Deploy** after adding them.
6. At the top of the worker page you'll see its address, like
   `https://rental-hunt.<your-name>.workers.dev`. Copy it.

## Step 3: tell the site where the helper lives

Send that address to Claude ("the worker URL is …"), or do it yourself: on GitHub open `config.js` on
the `main` branch → pencil icon → put the address between the quotes after `workerUrl:` → **Commit changes**.
A minute later the site shows **Live** and anyone with the passcode can save.

## Later

- **Change the passcode**: Cloudflare → Workers & Pages → `rental-hunt` → Settings → Variables and
  Secrets → `PASSCODE` → edit → Deploy. Everyone gets asked for the new one on their next save.
- **Renew the GitHub key** when it expires: repeat step 1, then replace `GITHUB_TOKEN` the same way.
- **Check it works**: open `https://rental-hunt.<your-name>.workers.dev/data` in a browser; you should
  see a page of text starting with `{"listings":`.

## For people who use Wrangler

`wrangler.toml` is next to this file: `npx wrangler deploy`, then
`npx wrangler secret put GITHUB_TOKEN` and `npx wrangler secret put PASSCODE`.

## Testing it locally

From the repo root: `node test/worker.test.mjs` runs the helper against a fake GitHub and fires two
dozen saves from two people at the same time to check none get lost. `node test/dev.mjs` serves the
whole site against the same fake (passcode `test-pass`).
