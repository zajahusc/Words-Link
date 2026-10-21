# Merriam-Webster setup

The integration is implemented, but a developer key alone does not activate it. The existing WordNet game stays available until an approved, verified Merriam-Webster dataset has been prepared and its activation date arrives.

## 1. Confirm permission

Ask Merriam-Webster to confirm the game's commercial/noncommercial classification and permission for automated queries, storing a derived synonym graph, displaying definitions, and downloading/caching that graph in players' browsers for offline play. Agree on required attribution and usage limits. The implementation uses an offline snapshot, so permission limited to live reference queries is insufficient.

Links:
- https://dictionaryapi.com/info/contact
- https://dictionaryapi.com/info/terms-of-service
- https://dictionaryapi.com/products/api-collegiate-thesaurus

Leave `MW_LICENSE_APPROVED=false` until those permissions are in place. No real provider calls are needed to run the automated tests or deploy the existing dictionary.

## 2. Connect Netlify

Import `zajahusc/Words-Link` at https://app.netlify.com/start/deploy?repository=https://github.com/zajahusc/Words-Link and authorize access to that repository. Review the Netlify plan and any usage charges in your own account.

The checked-in `netlify.toml` supplies these settings:
- Base directory: repository root (leave blank).
- Build command: `npm test && npm run build`.
- Publish directory: `dist`.
- Functions directory: `netlify/functions`.
- Node: 22.

This deploys the website and private backend together. The first deployment continues to use WordNet. Netlify Blobs stores prepared dictionaries and preparation progress outside Git. Functions and Blobs need to be available on the selected account/plan.

## 3. Put the key here

**Netlify project → Project configuration → Environment variables → Add a variable.**

Set `MERRIAM_WEBSTER_API_KEY` to the **Collegiate Thesaurus** key. Mark it secret/sensitive where the account supports it. Include the **Functions** scope. If your plan does not offer scope controls, the default runtime scope must include Functions. Do not use a public/client-prefixed variable. Never add this value to Git, netlify.toml, a GitHub Pages workflow, or browser code.

Also set these Functions environment variables:

| Name | Value |
| --- | --- |
| `WORDS_LINK_ADMIN_TOKEN` | The random token in your local `.env.local`; a separate password, not the Merriam-Webster key |
| `MW_LICENSE_APPROVED` | `false` until written permission; `true` afterward |
| `MW_DATASET_VERSION` | `mw-v1` for the first immutable dataset |
| `MW_ACTIVATE_ON` | Leave unset initially |

Apply these to Production. Use isolated credentials/data versions for any public preview that should have the integration active. Redeploy after changing environment variables.

For local work, run `npm run setup:secrets` once, then open `.env.local`. The command creates a random admin token, protects the file permissions, and does not print the token. Put the API key after `MERRIAM_WEBSTER_API_KEY=`. `.env.local` and `.private/` are ignored by Git, excluded from the static build and not served by `npm start`.

On a new checkout with no local setup file, the setup command creates one from `.env.example`. Do not replace an existing token when resuming preparation.

## 4. Prepare a verified dictionary after approval

With Node 22 installed:

```sh
npm ci
npm run setup:secrets
npm start
```

`npm start` serves the game and backend at http://127.0.0.1:8081. The key is read by Node only.

For the hosted site, put the matching admin token in local `.env.local`, then run:

```sh
npm run dictionary:prepare -- --site https://YOUR-SITE.netlify.app --start YYYY-MM-DD
```

Replace `YYYY-MM-DD` with a future New York date. This command sends only the admin token to your own backend; the backend reads the Merriam-Webster key from its environment. It starts a protected background task and polls sanitized status. It never prints credentials. Do not pass credentials in command-line arguments.

Defaults are 400 queried headwords and 365 daily puzzles. Optional `--queries 800`, `--days 365`, and `--version mw-v2` let an operator expand or replace the data. Preparation follows strict synonym lists from everyday seed words, retains sense definitions, excludes labeled obsolete/rare/offensive senses, and treats each explicitly documented synonym pair as bidirectional. Related words, near-synonyms and antonyms are excluded. Multiword/hyphenated terms are excluded to preserve the current single-word game.

The resulting vocabulary is a selected graph, not a complete copy of the entire thesaurus. Every connection in that graph is available to players. Each daily par is independently verified as the shortest route within that graph and must have 3–10 intermediate words. If enough verified puzzles cannot be generated, the new dataset is not published; expand the budget or seed list and retry.

The backend allows only one preparation at a time and counts requests durably **before** contacting the provider. It limits this application's preparation to 800 upstream requests per UTC day, leaving some headroom under a 1,000-request plan. Other applications sharing that key still count toward the provider's limit. Failed lookups are not automatically retried. Resuming reuses saved normalized entries. A process killed by the platform may hold the build lock for up to 20 minutes. Long runs stop before the background runtime limit and can be resumed.

Once a version is published, it is immutable. To change its vocabulary, schedule, or dates, choose a new version. Do not reuse a version with different build options. Extend the schedule by preparing and activating a new version before the previous schedule ends.

## 5. Review, then activate

The operator command reports the first and last scheduled dates when preparation succeeds. The protected status endpoint is `GET /api/admin/status?version=mw-v1`, using `Authorization: Bearer <admin token>`. It reports only setup booleans and preparation status, never secret values.

Review the generated vocabulary and attribution before release. To preview real content without moving production, use a separate Netlify project with its own prepared dataset and activation settings. Automated tests use clearly labeled synthetic fixtures, not real API requests.

When ready, set `MW_ACTIVATE_ON` in the production project's Functions environment to the prepared schedule's start date, set `MW_DATASET_VERSION` to the prepared version, and redeploy **before** that date. The switch occurs at midnight in America/New_York. Do not change activation dates or versions during an active day's puzzle. If you miss the start date, prepare a new version with a new future date.

Existing history stays in the same browser storage keys. A legacy attempt or result already on a browser keeps its old dictionary for that day. Older Merriam-Webster versions can also be restored for a saved attempt. A midnight rollover fetches the current dictionary again. An unavailable activated dictionary shows an error rather than silently changing the day's puzzle.

## 6. Connect wordslink.app

Keep the current GitHub Pages site and DNS working while testing the Netlify preview. After the Netlify deployment is verified, add `wordslink.app` in Netlify Domain management and follow the exact DNS records supplied for that project. Do not guess a Netlify hostname or change nameservers blindly.

Using the same https://wordslink.app origin preserves browser score history. Visiting the temporary netlify.app domain uses separate browser storage. Changing between `www.wordslink.app` and `wordslink.app` also changes the storage origin, so retain the current canonical hostname.

## Security and offline behavior

Only explicitly listed public assets are copied into `dist`. CI and Netlify serve this directory, not the repository root. The API key is used only by the server's fixed upstream request, with sanitized failures and no URL/body logging. The public API returns only the prepared dictionary and schedule. The admin token protects preparation/status; there is no public arbitrary-word proxy that can spend the provider quota.

The service worker caches public assets and the public dictionary response; it excludes admin endpoints and backend files. After one successful online load, the licensed snapshot works offline subject to the permissions obtained. Players need an online load to receive a new dictionary version. The snapshot and definitions are downloadable content, not secrets; licensing must allow that distribution. Server credentials never enter this cache.

Use the Netlify dashboard to monitor Function and Blobs usage and set budget alerts. Remove the API key if preparation access needs to be disabled; already approved, published snapshots do not need live upstream requests during gameplay.

## Sources

- API fields: https://dictionaryapi.com/products/json
- Netlify Functions secrets: https://docs.netlify.com/build/functions/environment-variables/
- Netlify Blobs: https://docs.netlify.com/build/data-and-storage/netlify-blobs/
- Background tasks: https://docs.netlify.com/build/functions/background-functions/
