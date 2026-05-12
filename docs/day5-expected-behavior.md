# Day 5 Expected Behavior Matrix

Date: 2026-05-09
Owner: BA + Tester

| Scenario | Backend behavior | Frontend behavior | Message/marker | Test anchor |
|---|---|---|---|---|
| No data | Return `200` with `events: []`, `total: 0`, `has_next: false`, valid pagination fields | Render empty state without crash | `No events found.` | `tests/events-day5-regression.test.mjs` (empty result case) |
| AI scoring fail | Return valid `risk_score` from deterministic fallback, `source: rule_based`, `fallback_used: true`, `fallback_version` set | Continue rendering risk visuals; show internal fallback marker if available | Optional internal badge: `Fallback Active` | `tests/ai-score-contract.test.mjs` |
| Cache unavailable (Redis down) | Continue serving response via compute and in-memory fallback; set `X-Cache: BYPASS` | No UI crash, normal list/map render | Internal debug header only | `tests/events-day5-regression.test.mjs` (Redis-down case) |

Notes:

- Tester can derive test cases directly from this table without additional clarification.
- UI message consistency is mandatory for demo stability.
