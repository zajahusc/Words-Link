# Words Link

A responsive web edition of the Words Link iOS game. Warm paper, serif headlines, tactile synonym tiles, and a yellow destination. Plays on desktop, Android, iPhone, and iPad browsers.

## Run locally

With Node.js 22.12 or newer:

```sh
npm ci
npm run setup:secrets
npm start
```

Open http://127.0.0.1:8081. The default configuration uses the bundled WordNet data and requires no API key. The new local server supports the same backend routes as production and serves only the explicit public build. Put server secrets in the ignored `.env.local`, never in client files.

## Merriam-Webster integration

The backend, sense-specific synonym parser, verified puzzle generator, persistent dictionary storage, and browser integration are implemented. **Activation still requires the operator's Merriam-Webster permissions, API key, and Netlify account.** No Merriam-Webster data or key is committed to this repository.

See [the complete setup guide](docs/MERRIAM-WEBSTER-SETUP.md) for the exact secret settings, one-time preparation command, review and midnight activation. Import the repository into Netlify using the checked-in `netlify.toml`. The existing WordNet game remains available until the new provider is ready.

The protected preparation task uses strict synonyms with their shared definitions, excludes labeled uncommon senses, and generates immutable daily challenges with verified shortest routes. During gameplay the browser uses this prepared graph; individual player moves do not consume API requests. Hard mode accepts any available synonym from the same graph as Normal mode. Merriam-Webster licensing must cover generation, storage and offline distribution.

## Play and scoring

Normal mode exposes every available synonym, with a filter for lists larger than 12. Hold or right-click a tile to explore its meaning. With the new provider, the game explains the shared sense directly; legacy WordNet tiles use an external dictionary lookup. Undo and restart remain available until the first completion. Revealing permanently marks that day's attempt assisted.

Every valid route in the game's selected dictionary counts, including routes that depart from the revealed example. Par is the shortest route and ranges from 3–10 intermediate bridge words. Longer player routes are allowed.

Daily puzzles reset at midnight America/New_York, including daylight saving changes. The legacy schedule runs October 20, 2026 through June 30, 2027. New Merriam-Webster schedules are prepared and verified separately; neither provider fabricates routes when its schedule ends.

Scoring: `100 + 10 × par + max(0, 50 − 10 × extra bridge words)`, doubled for Hard; assisted solves earn zero. Daily progress and history stay in localStorage and update across tabs. Browser data does not sync with iCloud or other devices. Clearing browser data removes it. Hosting changes retain scores only when the site's exact origin (scheme and hostname) stays the same.

The service worker caches public game assets and an approved dictionary snapshot for offline play after a successful online load. New versions require an online update. Color theme follows the device's light/dark setting.

## Test and build

```sh
npm test
npm run build
```

Tests cover provider parsing and secret redaction, protected setup, durable request limits, immutable data, both-direction connections, verified shortest routes, New York rollover, scoring, dictionary migration, and complete synonym choices. They use synthetic API fixtures and make no live Merriam-Webster requests.

`dist` contains public assets only. Environment files, server code, dependencies, tests and private storage are excluded. Both Netlify and the optional GitHub Pages Actions deployment use this build. GitHub Pages supports only the legacy static game; it cannot run the Merriam-Webster backend. Leave it working while preparing the Netlify migration.

## Credits

Legacy dictionary: Open English WordNet 2025, derived from Princeton WordNet. See data/Licenses.txt and data/Provenance.json for attribution and terms.

The optional new dictionary uses Merriam-Webster's Collegiate Thesaurus under the operator's approved license. Confirm required attribution before activation. Existing source notices remain available for legacy sessions.
