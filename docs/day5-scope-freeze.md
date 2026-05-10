# Day 5 Scope Freeze (/events)

Date: 2026-05-09
Owner: BA
Status: Frozen

## Goal
Pagination and sorting are auxiliary transport concerns. They must not change business meaning of event data.

## In Scope
- Endpoint: `GET /api/events`
- Allowed new query params:
  - `page` (default `1`, min `1`)
  - `page_size` (default `10`, max `100`)
  - `sort` (whitelist only: `risk_score`, `occurred_at`, with `:asc|:desc`)
- Response metadata additions:
  - `total`, `has_next`, `page`, `page_size`
- Cache behavior observability:
  - `X-Cache: HIT|MISS|BYPASS`

## Non-goals
- Do not add new fields to `Event` domain object.
- Do not change risk semantics (`risk_score`, threshold mapping, type meaning).
- Do not reorder/filter before applying existing business filters.

## Acceptance Criteria
- Pagination is applied after filtering and deterministic sorting.
- Sort field is strictly whitelisted with fallback to safe default.
- Default `page_size` is explicit and consistent across BE/FE/tests.
- Contract tests fail if response shape/type drifts outside scope.

## Mapping of Day 5 Tasks to Scope
- Backend pagination/sort/cache/guard tasks: in scope.
- Frontend list/filter/map sync and page reset: in scope.
- Tester regression + contract lock tests: in scope.
- AI fallback metadata transparency (`source`, `fallback_used`, `fallback_version`): in scope.
- Broader event schema redesign: out of scope.

## Sign-off Checklist
- [x] Backend sign-off
- [x] Frontend sign-off
- [x] Tester sign-off
- [x] Leader sign-off
