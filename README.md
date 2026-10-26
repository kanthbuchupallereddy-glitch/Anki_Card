# Study

A personal Anki desktop companion with Counterform dark and Light Field light appearances. The project has a React/TypeScript frontend, an Express/TypeScript local API, and shared validated data contracts. Anki owns the collection and scheduler.

## Start the app

Install Node.js **22.12 or newer** (Node 24 is used for local verification).

On Windows, double-click **Start Study.cmd**. The launcher installs the locked packages if they are missing, builds the app, and starts it. The first setup needs internet access. Keep its window running, and open **http://127.0.0.1:4173**. Close it or press Ctrl+C to stop the app.

For a terminal setup:

```sh
npm ci
npm run build
npm start
```

Keep Anki Desktop open with AnkiConnect enabled to load real decks. Demo mode works without Anki. The old root `index.html` is a launch guide; the React app itself requires the local server.

## Project layout

```text
apps/
  web/                 React screens, feature state, components, styles, artwork
  api/                 Express controllers, collection service, Anki adapter
packages/
  contracts/           Shared DTO types and runtime response validation
scripts/               Launch, development, and optional live-check helpers
tests/
  api/                 Native transport, service, and HTTP boundary tests
  contracts/           Public response validation tests
  e2e/                 Browser behavior and layout tests
  fixtures/            Synthetic collection and local test server
docs/
  architecture.md      Contributor guide to module responsibilities
specs/                 Personal development specs; excluded from Git
```

Read [the architecture guide](docs/architecture.md) before adding a feature. Keep screens, HTTP handling, native Anki communication and shared public contracts in their respective layers.

## Development commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Initial build, then watch frontend/API/contracts; API restarts on compiled changes. Reload the browser after a frontend rebuild. |
| `npm run typecheck` | Check frontend, API and shared TypeScript definitions. |
| `npm run build` | Build contracts, API and frontend in dependency order. |
| `npm start` | Run the existing build on this computer only. |
| `npm run launch` | First-run setup if needed, rebuild and start. |
| `npm test` | Build and run the deterministic API/contract/browser suite. |
| `npm run test:unit` | Compile and run API/contract tests with Node's test runner. |
| `npm run test:e2e` | Run Playwright against the existing frontend build and a synthetic local API. |
| `npm run test:live` | Optional read-only check against an already-running Study and Anki. |

After `npm ci`, install the test browser once with `npx playwright install chromium` if it is not already available. The normal test suite does not connect to Anki, require a personal profile, or modify a collection. Browser tests use port 4174; the app normally uses 4173. Test reports and generated builds are ignored by Git.

Both normal use and development serve only the compiled frontend through Express. Development does not expose the repository through a Vite source-file server. Dependencies are pinned and recorded in `package-lock.json`; use `npm ci` for repeatable installs.

## Current behavior

- Light, Dark and System appearance persist across reloads.
- Anki source shows the active profile, real deck names and native new/learning/review counts. Parent rows include subdecks; Today totals count only top-level decks.
- Deck data refreshes every 60 seconds while visible, on return/focus, on source selection and with Refresh connection. This is not AnkiWeb sync.
- Demo source has sample search, reveal, Again/Hard/Good/Easy, keyboard shortcuts and undo. Demo progress is not saved to Anki.
- Live native review, saved ratings, editing, native undo and sync remain unimplemented. Use Anki for those operations.

The integration was previously checked with Anki 26.09.3 and AnkiConnect API v1. It accepts only the verified read interface. Installations requiring an API key need future local configuration support. Full add-on/template compatibility and representative native-collection checks remain pending.

## Privacy and publishing

The app binds to `127.0.0.1` and exposes fixed read-only endpoints. It has no general Anki proxy, native write endpoint or public deployment. Public assets are separate from server sources and personal documents. Optional Google Fonts have system-font fallbacks.

`specs/`, personal planning/verification documents, local settings, collection packages and generated reports are excluded by `.gitignore`. Do not force-add them. Do not commit or push without the project owner's instruction.
