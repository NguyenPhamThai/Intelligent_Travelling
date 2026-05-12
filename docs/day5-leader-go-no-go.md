# Day 5 Leader Go/No-Go and Safe Mode

Date: 2026-05-09
Owner: Leader


## Go/No-Go Gates

- [x] No stale/leak risk in cache keying (query-affecting params included).
- [x] AI fail path returns valid schema (`risk_score`, `source`, `fallback_used`, `fallback_version`).
- [x] Cache behavior observable via `X-Cache` header.
- [x] Contract lock tests present for `/api/events`.
- [x] Regression suite covers pagination + cache + fallback + empty flow.


## Evidence

- `tests/events-day5-regression.test.mjs`
- `tests/events-contract-lock.test.mjs`
- `tests/ai-score-contract.test.mjs`
- `tests/risk-score-shared-contract.test.mjs`
- `docs/day5-scope-freeze.md`
- `docs/day5-expected-behavior.md`


## Rollback / Safe Mode Switches (no code redeploy)

- Disable Redis cache path:
  - `DISABLE_EVENTS_REDIS_CACHE=1`
- Force deterministic fallback scoring:
  - `FORCE_RULE_BASED_SCORING=1`
- Force fixed safe page size:
  - `EVENTS_SAFE_PAGE_SIZE=10`


## Operational Drill (target < 1 minute)

1. Set one or more safe-mode env vars.
2. Restart runtime/container.
3. Verify `/api/events` returns with `X-Cache: BYPASS` (if Redis disabled) and valid payload.
4. Verify `/api/ai/score` returns `source: rule_based` when force fallback enabled.
