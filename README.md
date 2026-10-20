# Words Link

A responsive web edition of the Words Link iOS game. Warm paper, serif headlines, tactile synonym tiles, and a yellow destination. Plays on desktop, Android, iPhone, and iPad browsers.

## Run

No build or dependencies required. Run `python3 -m http.server 8080` in this folder, then open http://localhost:8080. Serve over HTTPS in production for offline caching, native sharing, and clipboard access. Do not open index.html directly from disk.

## Play

Link synonyms from the start to the goal. Normal mode shows the same deterministic selection of up to 12 tiles as iOS; Hard accepts any valid synonym from the bundled graph. Long press or right click a tile to open a dictionary lookup. Undo and restart remain available until the first completion. A reveal permanently marks that day's attempt assisted.

Daily puzzles reset at midnight America/New_York, including daylight saving changes. The bundled schedule runs October 20, 2026 through June 30, 2027; add verified dated routes to data/DailyChallenges.json to extend it. Dates outside the schedule show an explicit unavailable message.

Scoring matches iOS: 100 + 10 × par + max(0, 50 − 10 × extra bridge words), doubled for Hard; assisted solves earn zero. Daily progress and history use localStorage, with updates across tabs. Browser data does not sync with iCloud or other devices. Clearing browser data removes it.

The service worker caches the game and full word dictionary for offline play after the first successful load. Definitions are external Wiktionary lookups and need internet access. Interface colors follow the system light/dark setting. Home screen installation depends on browser support.

## Test

With Node.js 22 or newer: `npm test`. Tests check all scheduled routes and shortest path lengths, New York rollover, scoring, deterministic tiles, save validation and spoiler-free sharing. The GitHub Pages workflow runs them before deploying.

## Publish

The included GitHub Actions workflow deploys the repository root to GitHub Pages. Set repository Settings → Pages → Source to GitHub Actions, set the repository Actions variable `ENABLE_PAGES` to `true`, then run the Deploy Words Link workflow. GitHub Pages requires a public repository on GitHub Free, or a paid plan that supports Pages for private repositories. Tests run on every push even when Pages deployment is disabled. The expected address for zajahusc/Words-Link is https://zajahusc.github.io/Words-Link/.

When changing cached files, bump CACHE in sw.js. A new service worker activates after older tabs close. All asset URLs are relative, including deployment under a repository subpath.

## Credits

The original app's Open English WordNet 2025 dictionary and daily schedule are reused unchanged. See data/Licenses.txt and data/Provenance.json for contributor attribution, CC BY 4.0 terms, Princeton WordNet license and dataset derivation. No analytics, accounts, purchases, or API keys are needed.
