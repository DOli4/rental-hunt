# The save helper (Cloudflare Worker)

The website is plain files on GitHub Pages, so it can't keep secrets or save anything itself. This small
helper runs on Cloudflare's free plan. It:

- lets people **sign in with Google** and checks them against your **invite list**,
- reads the places, marks and notes from the **private** repo `DOli4/rental-hunt-data`,
- turns every heart, status or note into a commit there, with the person's name on it.

One-off setup: about 20 minutes. You need a GitHub key, a Google "client ID" and the worker itself.

## Step 1: a GitHub key that can only touch the data repo

1. On github.com: your picture (top right) → **Settings** → bottom of the left menu → **Developer settings**.
2. **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
3. Fill in:
   - **Token name**: `rental-hunt save helper`
   - **Expiration**: 1 year (calendar reminder a week before, to make a new one)
   - **Repository access**: **Only select repositories** → `rental-hunt-data`
   - **Permissions** → **Repository permissions** → **Contents** → **Read and write**. Nothing else.
4. **Generate token**, copy it (starts with `github_pat_`). Keep the tab open until step 3.

## Step 2: a Google sign-in "client ID"

1. Go to https://console.cloud.google.com/ and sign in with your Google account.
2. Top bar → project picker → **New project** → name `rental-hunt` → **Create**, then select it.
3. Search bar → **Google Auth Platform** → **Get started**:
   - App name `Rental Hunt`, support email = yours → **Next**
   - Audience **External** → **Next** → contact email = yours → **Next** → agree → **Create**.
4. Left menu **Audience** → **Publish app** → **Confirm**. (It only asks for name + email, so Google
   doesn't need to review it. Without this, only "test users" you add by hand can sign in.)
5. Left menu **Clients** → **Create client**:
   - Application type **Web application**, name `rental-hunt site`
   - **Authorised JavaScript origins** → **Add URI** → `https://doli4.github.io`
   - **Create**.
6. Copy the **Client ID** (looks like `1234-abc.apps.googleusercontent.com`) and send it to Claude.
   It isn't a secret; it goes in the website's `config.js`.

## Step 3: the worker

First make sure the Client ID from step 2 is in `wrangler.toml` after `GOOGLE_CLIENT_ID =` (Claude does
this when you send it). Then, in a terminal, from this `worker` folder:

```
cd "$env:USERPROFILE\OneDrive\Desktop\rental-hunt\worker"
npx wrangler login
npx wrangler deploy
```

`login` opens a browser: sign in to Cloudflare and click **Allow**. `deploy` prints the worker's
address (`https://rental-hunt.<your-name>.workers.dev`); send it to Claude.

Then the three secrets. Each command asks you to paste a value; nobody else ever sees them:

```
npx wrangler secret put GITHUB_TOKEN
npx wrangler secret put ALLOWED_EMAILS
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" | npx wrangler secret put SESSION_SECRET
```

- `GITHUB_TOKEN`: the `github_pat_…` key from step 1.
- `ALLOWED_EMAILS`: the invite list, the Google emails allowed in, separated by commas,
  e.g. `you@gmail.com, partner@gmail.com`.
- `SESSION_SECRET`: the third line makes a random one for you; nothing to paste.

## Later

- **Invite or remove someone**: Cloudflare dashboard → **Workers & Pages** → `rental-hunt` →
  **Settings** → **Variables and Secrets** → `ALLOWED_EMAILS` → edit → **Deploy**. Removing an email locks
  that person out straight away.
- **Sign everyone out** (e.g. a lost phone): replace `SESSION_SECRET` the same way (any new long random text).
- **Renew the GitHub key** when it expires: repeat step 1, then `npx wrangler secret put GITHUB_TOKEN`.
- **Check it's up**: open `https://rental-hunt.<your-name>.workers.dev/data`; it should say `please sign in`.

## Testing it locally

From the repo root: `node test/worker.test.mjs` runs the helper against a fake GitHub and a fake Google
(forged and uninvited sign-ins, two dozen saves from two people at once). `node test/dev.mjs` serves the
whole site against the same fakes; sign in with the dev form as `anna@x.com` or `dieter@x.com`.
