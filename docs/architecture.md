# Architecture

Study is one npm workspace containing a browser application, a local API and a small shared contracts package. It is a companion to Anki: it does not own a second learning database or scheduler.

## Request flow

```text
React feature -> browser API client -> Express route/controller
                                      -> collection service
                                      -> Anki adapter -> fixed local JSON-RPC transport

Both browser client and controller validate the public response contract.
```

## Frontend — apps/web

`src/app/App.tsx` composes the app shell and feature hooks. Navigation, source selection, search and review state are retained while changing themes or screens. Screens remain mounted so presentation changes do not reset a study session.

| Location | Responsibility |
| --- | --- |
| `src/app/` | Application composition and hash navigation. |
| `src/components/` | Shared header/footer and presentational layout. |
| `src/features/appearance/` | Saved Light/Dark/System preference and OS listener. |
| `src/features/connection/` | Source state, refresh lifecycle, status and request cancellation. |
| `src/features/library/` | Deck display models, Today workload, search and table screens. |
| `src/features/review/` | Sample review state and controls; native review remains unavailable. |
| `src/api/` | Same-origin collection request and runtime response validation. |
| `src/styles/` | Design tokens, base rules, layout, screens and responsive behavior. |
| `public/assets/` | Artwork allowed in the public build. |

React effects dispose of their listeners, timers and in-flight reads. A request generation ensures older responses cannot overwrite a newer source or snapshot. Demo data never substitutes for failed Anki data. Future real card content requires a separate isolation design before rendering imported HTML/scripts.

## Backend — apps/api

`src/app.ts` composes Express and returns the HTTP server. `src/server.ts` owns process startup and loopback listening.

| Location | Responsibility |
| --- | --- |
| `src/config/` | Local host/port, fixed upstream destination and limits. |
| `src/middleware/` | Exact caller checks, security headers and safe error responses. |
| `src/modules/collection/` | Route/controller and read-only snapshot orchestration. |
| `src/integrations/anki/` | Native validation, adapter and JSON-RPC transport. |
| `src/static/` | Public-build asset policy. |

Controllers handle HTTP and validate the public result. Services coordinate the workflow. The adapter validates Anki-native responses. The transport owns request IDs, allowlisted methods, response limits, cancellation and deadlines. Tests inject this boundary instead of connecting to personal data.

A collection read checks available read methods, obtains profile/session context, pins all collection reads to that session, and rechecks context before returning. Parent counts already include descendants, so totals sum top-level decks only. RPC IDs are not write-idempotency keys; no review or editing writes are implemented.

## Shared contracts — packages/contracts

The public DTOs describe a snapshot, decks, counts and bounded failure states. `parseCollectionResponse` validates unknown input and reconstructs only public fields. It rejects malformed identities, counts, hierarchy, timestamps and aggregate totals. It discards unexpected fields; native session tokens and paths are not browser DTO fields.

The browser can import this package, but must not import backend or Anki-native modules. Keep generic helpers close to their owning feature unless there is a real shared use.

## Serving and development

Vite compiles the frontend; Express serves only the built HTML and allowed assets. Neither production nor development serves the repository root. Host/origin/fetch/header guards apply before collection reads. There is no permissive CORS setting or arbitrary RPC forwarding.

`npm run dev` builds once, watches TypeScript and the frontend build, and restarts the API after compiled backend/shared files change. Refresh the browser after frontend builds. This keeps development on the same local-origin and public-asset boundary as normal use.

AnkiConnect itself has a broader default caller policy than this adapter. Its full trust configuration, imported-template isolation and native-write reconciliation are separate requirements before real review functionality is added.

## Tests and adding features

API tests use a synthetic upstream and temporary public assets; browser tests use a synthetic collection through the real Express stack. Public contract tests reject invalid data. The optional live smoke script is read-only and separate from these deterministic tests.

For a new feature: define its observable behavior, update public contracts if necessary, implement service/adapter changes behind those boundaries, add its frontend feature, and verify relevant behavior and failure cases. Update contributor documentation and the owner's private feature specs. Never place personal collection data in committed fixtures.
