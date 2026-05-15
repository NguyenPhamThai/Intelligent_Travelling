# Demo Readiness Checklist — WorldMonitor

Source: Implementation-driven checklist derived from the repository (files referenced inline). Do NOT treat this as a feature redesign — it documents current behavior and practical checks for a live demo.

Last updated: May 15, 2026

---

## Quick status summary
- Demo stability estimate: MEDIUM (some brittle subsystems: Redis/AI and coordinate naming).  
- Highest-risk subsystem: Cross-user Redis (Upstash) + scoring pipeline.  
- Safest demo path: Local dev with mock events + built-in rule-based scoring.

---

## How to use this checklist
1. Work through each section in order (Backend → Frontend → E2E).  
2. Mark each item as PASS/FAIL.  
3. If a FAIL blocks the demo, escalate to "Must Fix Before Demo" items.

---

## Backend verification
Files: [`api/events.js`](api/events.js), [`api/_upstash-json.js`](api/_upstash-json.js), [`server/_shared/redis.ts`](server/_shared/redis.ts), [`api/bootstrap.js`](api/bootstrap.js)

- [ ] Verify Upstash credentials are set in environment (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`). See [`.env.example`](.env.example).
  - Command: ensure `.env.local` has both values or run in environment where Upstash is available.
- [ ] Confirm `readJsonFromUpstash` / `writeJsonToUpstash` work (test with a small write/read).
- [ ] Call `GET /api/bootstrap?tier=fast` and confirm response contains expected bootstrap keys (fast/slow tiers). See [`api/bootstrap.js`].
- [ ] Call `GET /api/events?lat=...&lon=...` and verify the endpoint returns JSON with `events`, `total`, `page`, `page_size`, `has_next`, `timestamp`. See [`api/events.js`].
- [ ] Verify API pagination works: `page` and `page_size` queries produce stable results and `has_next` toggles.
- [ ] Confirm canonical cache keys are readable via `api/_upstash-json.js` and `server/_shared/redis.ts` pipeline — test `getCachedJsonBatch` behavior for multiple keys.
- [ ] Check rate-limit and API key guards (see `api/_ip-rate-limit.js` and `server/_shared/rate-limit` tests). Ensure your demo IP is not accidentally rate-limited.

---

## Frontend verification
Files: many—`src/App.ts`, `src/app/*`, `src/components/EventsPanel.tsx`, `src/components/EventMap.tsx`, `src/components/EventMapView.tsx`

- [ ] Start the frontend: `npm run dev` and open the UI variant you plan to demo (`VITE_VARIANT` as needed).
- [ ] Verify bootstrap hydration is happening: check console for `fetchBootstrapData()` (see `src/services/bootstrap.ts`) and that major panels show data quickly.
- [ ] Verify map tiles load. If self-hosted PMTiles are used, ensure `VITE_PMTILES_URL` or `VITE_PMTILES_URL_PUBLIC` is set. See `.env.example`.
- [ ] Open `EventsPanel` (or `EventMap`) and verify map markers render. Files: `src/components/EventsPanel.tsx`, `src/components/EventMap.tsx`.
- [ ] Verify event popups do not crash the UI when fields are missing (e.g., `title`, `description`, `risk_score` undefined). Look for console errors when clicking markers.
- [ ] Verify UI can render when `risk_score` is `0` or `undefined` (check `src/types/event.ts` and UI usage). Ensure components use safe defaults like `(event.risk_score ?? 0)`.
- [ ] Verify `ml-worker` initialization for on-device ML features: `src/services/ml-worker.ts` and `src/workers`. If ML is not required for demo, ensure fallback UI remains stable.

---

## AI scoring verification
Files: `shared/risk-score.js`, `shared/risk-score-spec.js`, `api/intelligence/*`, `src/services/ollama-models.ts`, `.env.example` LLM vars

- [ ] Verify LLM configuration if using AI scoring: `LLM_API_URL`, `LLM_API_KEY`, or `OLLAMA_API_URL` / `OLLAMA_MODEL` set appropriately.
- [ ] Test `GET /api/intelligence/v1/classify-event` (or corresponding edge route) and confirm it returns classification responses for sample inputs (proto-backed endpoint). See `proto/worldmonitor/intelligence/v1/classify_event.proto` and generated handlers.
- [ ] Confirm fallback rule-based scoring works: `shared/risk-score.js` implements `calculateRiskScore()` that produces scores even when AI is unavailable.
- [ ] Run the AI scoring parity/quality tests locally: `npm run test` (see `ai-score-contract.test.mjs`, `ai-score-fallback.test.mjs`).
- [ ] Check timeouts and circuit-breakers for AI calls: ensure the system will fall back gracefully on LLM timeouts. Search `llm-sanitize.js`, `src/services/ollama-models.ts`, and `src/services/ml-worker.ts`.

---

## Cache verification
Files: `server/_shared/redis.ts`, `api/_upstash-json.js`, `src/services/bootstrap.ts`, `src/services/persistent-cache.ts`

- [ ] Verify Upstash connection from edge functions: `server/_shared/redis.ts` will throw if token missing — ensure the endpoint `GET /api/bootstrap` returns valid cached data when Upstash configured.
- [ ] Verify in-memory API cache behavior: check `IN_MEMORY_CACHE` in `api/events.js` for TTL and that memory cache is bypassed when expected.
- [ ] Verify browser persistent caching: `src/services/persistent-cache.ts` (IndexedDB + localStorage) can read/write and handle quota errors.
- [ ] Confirm `cachedFetchJson()` coalescing behavior: concurrent requests for the same key should not trigger N upstream fetches (see `getCachedJsonBatch()` and `inflight` behavior in `server/_shared/redis.ts`).

---

## Map verification
Files: `src/components/EventMap.tsx`, `src/components/EventMapView.tsx`, `src/components/DeckGLMap.tsx`, `vite.config.ts` (brotli), `.env.example` (tile URL)

- [ ] Ensure map renders on target device (2D vs 3D controlled by `VITE_MAP_INTERACTION_MODE`).
- [ ] Verify markers for mock events appear (use `src/mocks/mockEvents.ts`).
- [ ] Verify clicking a marker shows a popup and that popup code handles missing fields (use events missing `title` / `risk_score`).
- [ ] Confirm performance on demo machine: large overlays (many markers) may be heavy — use panel filters to limit visible markers.
- [ ] If using PMTiles, verify `VITE_PMTILES_URL` is set and reachable, otherwise verify external tile provider is allowed by CORS.

---

## Filter verification
Files: `src/app/search-manager.ts`, `src/services/*` (various fetch functions), `src/components/EventsPanel.tsx`

- [ ] Verify filtering by category/time/risk on `EventsPanel` works end-to-end (UI → query params → `/api/events` results).
- [ ] Confirm sort modes (`risk_score:desc`, `occurred_at`) work and produce deterministic order (see `parseSortParam()` in `api/events.js`).

---

## Fallback verification
Files: `shared/risk-score.js`, `api/events.js`, `src/services/bootstrap.ts`, `src/services/circuit-breaker.ts`

- [ ] Simulate AI failure (unset LLM env or induce timeout) and confirm `api/events.js` uses rule-based scoring (`calculateRiskScore()`) with `fallback_used: true` and `fallback_reason` set.
- [ ] Test circuit-breaker behavior for slow or failing upstream data sources configured in `src/utils/circuit-breaker.ts` and `src/services/*` break points.
- [ ] Confirm `bootstrap` endpoint will serve cached snapshots when upstream sources are down.

---

## End-to-end verification
Files: `e2e/runtime-fetch.spec.ts`, `tests/*`, `playwright.config.ts`

- [ ] Run runtime E2E smoke tests: `npm run test:e2e:runtime` to exercise core API flows.
- [ ] Run `npm run test:data` to verify node-side unit/integration tests covering score parity, cache, and event normalization.
- [ ] Run a small Playwright test or manual walkthrough that clicks the main panels you’ll show.

Commands:

```bash
npm ci
# unit/integration
npm run test:data
# runtime e2e (fast)
npm run test:e2e:runtime
# full e2e (takes longer)
npm run test:e2e
```

---

## Smoke testing (manual checklist)

- [ ] Start dev server: `npm run dev` and confirm no build errors.
- [ ] Open console and check for uncaught exceptions.
- [ ] Load homepage and verify major panels show data within 30s.
- [ ] Open `EventsPanel` and confirm at least 1 event appears.
- [ ] Click an event marker and confirm popup renders with no errors.
- [ ] Toggle variant (`VITE_VARIANT`) if demo-specific variant required (e.g. `tech`): `npm run dev:tech`.
- [ ] Verify `smoke:day5` script if relevant: `npm run smoke:day5`.

---

## Demo rehearsal steps (ordered)
1. Prepare environment: copy `.env.example` → `.env.local` and fill required keys (UPSTASH, LLM if using AI scoring, tile URLs).  
2. Start local services: `npm ci` → `npm run dev` (or desktop dev).  
3. Run `npm run test:data` to ensure core unit/integration tests pass.  
4. Run `npm run test:e2e:runtime` to exercise API handlers.  
5. With the app running, open the demo URL and perform smoke checks in "Smoke testing" above.  
6. If showing AI scoring live, run a test classification via API first and confirm response latency < demo threshold (suggest 2s–5s).  

---

## Critical bug policy (for demo)
- If a critical failure occurs (map crash, uncaught exception that blocks main UI, Redis auth error): switch to safe demo mode immediately by:  
  1. Use mock/local data: point frontend to `mock-events` (use dev build which imports `src/mocks/mockEvents.ts`).  
  2. Disable AI scoring by unsetting `LLM_API_URL` / `OLLAMA_API_URL` so fallback scoring is used.  
  3. Continue demo using stable panels (Market, TechEvents, Static Briefs).

---

## Known Demo Risks (observed in code)
- Coordinate name mismatch across layers: `lat` + `lng` vs `lat` + `lon` vs proto `latitude`/`longitude`. See `src/mocks/mockEvents.ts`, `shared/safety-types.ts`, `server/_shared/redis.ts` and `api/events.js` normalization. This can cause map marker placement bugs.
- `risk_score` optional in some TypeScript types but required by API responses. UI must handle `undefined` safely. See `src/types/event.ts` and `shared/risk-score.js`.
- Upstash (Redis) credentials missing causes some endpoints to degrade to cached behavior or return null — test `GET /api/bootstrap`. See `server/_shared/redis.ts`.
- LLM timeouts can cause fallback scoring; verify fallback_reason semantics and that UI shows source properly. See `shared/risk-score.js` and AI tests `ai-score-fallback.test.mjs`.
- IndexedDB/localStorage quota issues affecting persistent cache (`src/services/persistent-cache.ts`) on low-storage machines.
- Potential tight coupling: many services import shared risk scorer and types; changes to `shared/risk-score.js` can have broad impact.

---

## Must Fix Before Demo (blocking items)
- [ ] Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set for multi-user/edge demo (or explicitly choose mock/local mode).  
- [ ] Ensure the map tiles (`VITE_PMTILES_URL` or external provider) are reachable from demo location; otherwise map will be blank.  
- [ ] Validate that `risk_score` is present in the API responses for all events you will show (or make UI tolerant).  
- [ ] Verify LLM fallback behavior if you plan to show AI scoring live; if LLM is required, confirm low-latency endpoint (OLLAMA or managed provider).

---

## Safe To Ignore For Demo
- Long-tail background jobs, scheduled seed scripts, and heavy analytics tasks. These don't block an interactive demo.  
- Full E2E visual regression (golden screenshot) runs — visual regressions are useful but slow.

---

## Final demo readiness checklist (execute before going live)
- [ ] All PASS items in Backend/Frontend/AI/Cache/Map sections.  
- [ ] Run `npm run test:data` and `npm run test:e2e:runtime` and confirm no blocking failures.  
- [ ] Confirm network access to Upstash, tile servers, and any external APIs you will query live.  
- [ ] Prepare fallback plan: commands to start in mock mode, and a prepared script of UI pages/panels to navigate if live feeds fail.

---

## After-action notes
- Demo stability level: MEDIUM — acceptable for demos if Upstash and optional LLM endpoints are healthy; otherwise prefer mock/local fallback.  
- Highest-risk subsystem: Cross-user Redis + scoring pipeline (Upstash + AI fallbacks).  
- Safest demo path: Local dev with mock events (`src/mocks/mockEvents.ts`) and rule-based scoring.

---

Files referenced (examples):
- `api/events.js` — events endpoint and normalization
- `api/_upstash-json.js` — Upstash read/write helpers
- `server/_shared/redis.ts` — shared Redis + cachedFetchJson
- `shared/risk-score.js` — scoring formula & fallback spec
- `src/mocks/mockEvents.ts` — test/mock event fixtures
- `src/services/bootstrap.ts` — bootstrap hydration and persistent cache usage
- `src/services/persistent-cache.ts` — browser persistent cache
- `src/services/ml-worker.ts` — ML worker initialization
- `e2e/runtime-fetch.spec.ts` — runtime e2e test


If you want, I can now run the quick smoke commands locally (tests or dev server) or generate a short demo-run script with exact commands you'll run on the demo machine.
