# AI Engineering Rules

Purpose: authoritative engineering governance for AI-assisted development in this repository.

This document prescribes how AI coding agents (Copilot, Cursor, internal assistants) and humans must work together to change, extend, or maintain the system. It focuses on architecture preservation, dependency safety, regression prevention, and preparing a safe path for future AI chatbox features.

--

## Core Engineering Philosophy

- **Reuse over replace:** Extend existing components, pipelines, and schemas instead of implementing parallel systems.
- **Single Source of Truth (SSoT):** One canonical definition for any concept (Event schema, scoring algorithm, API contract, type definitions). Reference it; do not copy-and-paste.
- **Preserve contracts:** FE ↔ BE contracts are binding. Changes require explicit compatibility and versioning plans.
- **Minimize regression risk:** Small, incremental PRs with explicit impact analysis are required for any shared-module change.
- **Architecture consistency over coding speed:** Prefer abiding by the repository's dependency direction and module ownership rules even if it slows the change.

## Scope & Audience

This file targets:
- AI coding agents (Copilot, Cursor, internal LLMs) assisting on code edits
- Human engineers implementing or reviewing changes
- CI automation that may run automated refactors or codemods

Apply these rules to any changes involving `src/`, `api/`, `server/`, `proto/`, `shared/`, `src-tauri/`, and `scripts/`.

## Repository Safety Rules

DO:
- Use repository search and usage-tracing before editing shared modules.
- Create focused, small PRs that modify one canonical area at a time.
- Add or update unit/integration tests that validate contract behavior.

DO NOT:
- DO NOT invent or introduce new schemas that duplicate existing concepts.
- DO NOT bypass established abstractions (e.g., call Redis or cache clients directly if a shared helper exists in `server/_shared/`).
- DO NOT introduce local-only fixes that patch symptoms in callers instead of addressing root causes in the canonical module.
- DO NOT let AI agents commit changes without a human architecture reviewer sign-off on shared-module edits.

Guidance for AI agents (explicit):
- When suggesting code, output only diffs or single-file patches and include an explicit `Impact:` note listing likely consumers, backward-compatibility risks, and required tests.
- When proposing new files, ask: "Is this concept already represented in `proto/`, `server/`, `src/generated/`, `shared/` or `src/config/`?" If yes, propose extending the canonical artifact.

## Event Schema Rules

Canonical source: the Event schema lives in `proto/` and the canonical generated TypeScript/JS artifacts under `src/generated/` or `server/generated/` (if present). The canonical JSON / TypeScript type must be referenced everywhere; do not create a competing `Event` type.

Field rules (strict):
- `timestamp`: Always ISO 8601 strings in UTC. FE and BE must accept and emit UTC-only values. Do not use local timezones in persisted data.
- `id`: Use stable string IDs. New IDs must be globally unique; prefer UUIDv4 or proto-defined ID generation.
- `location.lng` vs `location.lon`: Use `lon` as the canonical key. If existing code uses `lng`, add a single canonical adapter that maps `lng` -> `lon` at ingestion time. Example adapter location conversion must live in `server/_shared/geo.ts` or a single agreed location.
- `risk_score`: Must be compatible with the `risk_score` contract defined in `server/worldmonitor/*` and any `src/services/score` modules. Raw numeric scores must be accompanied by a `score_version` and `score_explain` keys.

Schema change rules:
- Schema changes MUST follow: update `proto/` definitions -> `make generate` -> update generated stubs -> update consumers. Do not hand-edit generated files.
- Any additive field is allowed only if accompanied by a migration plan and compatibility tests showing old clients still parse payloads.
- Breaking changes require versioning via a new API route or an explicit `proto`-level version bump and coordinated rollout.

## Risk Scoring Rules

Single Source of Truth (SSoT): The canonical scoring logic is located in `server/worldmonitor/*` and mirrored (only for read-only inference) in `workers/` or `src/services/score` as documented. There must be one authoritative implementation per scoring domain.

DO:
- Add new scoring features by modifying the canonical scoring service and adding explicit feature flags and `score_version` numbers.
- Add unit tests that cover edge cases and regression samples (include example events and expected outputs in `tests/` or `tests/data/`).

DO NOT:
- DO NOT implement a local, alternate scoring function inside a panel or component. If a component needs an adjusted score, request a derived-score endpoint or feature-flagged post-processing in `workers/`.
- DO NOT change scoring constants (thresholds, weights) without documenting rationale and expected impact on consumers.

Compatibility rules:
- Every change to scoring must emit `score_version` and include migration notes in the changelog. CI must run scoring unit tests and compare outputs against a golden-data fixture set.

## Frontend State Rules

State ownership:
- Use existing stores and context layers in `src/app/` and `src/utils/`. Do not create a second global state container.

Map & synchronization:
- Map state synchronization must remain driven by the single map controller (see `src/components/map*` / `src/utils/map-state.ts`). If you need additional map-level behavior, extend the controller rather than creating independent state.

Filters & ranking:
- Use central filter and ranking APIs. UI-only filters that don't affect the server-side query MUST be explicit and stored in the same UI store so the back/forward and URL-state features work.

DO NOT:
- Introduce parallel state systems (e.g., local `useState` copies of global filters) that will deserialize into inconsistent UIs or cause desynchronization on navigation.

## API Contract Rules

Preserve FE ↔ BE compatibility:
- Any API response shape change must be additive or versioned.
- Consumers must never rely on transitive implementation details (internal field names) that are not part of the public contract.

Versioning expectations:
- For breaking changes, publish a new endpoint version (e.g., `/v2/...`) and provide a migration guide in the API changelog.

Testing and CI:
- All API changes require contract tests that assert response shapes and types. Add tests under `tests/` or `tests/api/` and include sample requests and responses.

DO NOT:
- Silently change status codes, field names, or pagination semantics.

## Dependency-Aware Engineering Rules

Before modifying any of the following shared artifacts: `proto/`, `shared/`, `server/_shared/`, `src/generated/`, `src/config/`, `src/services/*`, `src/components/*` — perform and document the steps below.

Mandatory pre-change checklist (must be in PR description):
1. Search usages for the symbol/module across repo (`grep`/IDE references). List the top 5 consumers.
2. Identify downstream consumers and runtimes (Edge Functions, Vercel, Tauri sidecar, Workers).
3. Estimate runtime impacts (memory, cold-start, bundle size changes). Document if change increases client bundle size.
4. Update or add type definitions and generated artifacts (run `make generate` if proto changed).
5. Run FE & BE typechecks: `npm run typecheck` and `npm run typecheck:api`.
6. Run unit and integration tests relevant to the area (`npm run test:data`, `npm run test:sidecar`).

Required commands (examples):
```bash
npm run typecheck         # tsc --noEmit
npm run typecheck:api     # API-specific typecheck
npm run test:data         # unit/integration tests
npm run test:sidecar      # sidecar + API handler tests
``` 

AI agent-specific instructions when proposing changes:
- Include an explicit `Impact:` section with search results and a list of files to update.
- Provide precise code locations to change and tests to add. Do not offer vague suggestions like "update all references" without a list.

## AI Chatbox Integration Rules

Design principles:
- The AI chatbox is an integration surface — it must reuse existing filtering, ranking, and state APIs rather than reimplementing logic in the client.
- No raw dataset dumps: never send PII, raw private streams, or bulk data directly into the model context. Use summarized vectors or pre-filtered excerpts via server-side context builders.

Context builder rules:
- Build context on the server using `workers/` or `server/_shared/` helpers. Create narrow, pre-specified slices of data with explicit provenance. Each slice must include source IDs and timestamps.
- Limit prompt tokens: prefer index + retrieval patterns (vector store + short context) over embedding entire events lists.

Realtime synchronization:
- The chatbox must call server APIs that return a consistent snapshot (e.g., using a `snapshot_id` or event watermark) and maintain map and filter synchronization with the dashboard's current state.

Privacy & security:
- Redact sensitive fields server-side before inclusion in prompts. Ensure redaction code is unit-tested.

## Prompt Engineering Rules

Grounding:
- Prompts must be anchored to specific event IDs, time windows, or snapshot identifiers. Avoid prompts like "what do you think" without a referenced data slice.

Avoid hallucination:
- Always include provenance with statements that reference external sources or scoring: "score computed by `server/worldmonitor/score.js` v1.4.2".

Explainability:
- When the assistant discusses `risk_score`, it must include the contributing features and their weights where available, or say "weights not available".

Token optimization:
- Use scalar summaries, not raw event dumps. Example: instead of sending 10 full events, send a 3-line summary per event plus a pointer to the event IDs for on-demand retrieval.

## High-Risk Files (Examples and Rationale)

The following are high-risk and require mandatory architecture review and extra tests:

- `proto/` — canonical contract: changing causes multi-language breakage.
- `server/_shared/redis.ts` or Redis helpers — central cache and stampede protection; small changes can cause widespread cache stampedes.
- `server/worldmonitor/*` (scoring handlers) — authoritative scoring logic; changes alter downstream risk signals.
- `api/*.js` (Edge Functions) — runtime constraints and bundling; Edge functions are self-contained and must not import server-only modules.
- `src/services/*` and `src/generated/*` — type shape and client/server bindings.
- `src/components/map*` and `src/utils/map-state.ts` — map synchronization; desyncs cause UI drift.
- `shared/` and `src/config/variants/` — variant configs drive which panels load; mistakes here create inconsistent product variants.

Why these are high-risk: they are either SSoT artifacts, cross-runtime boundaries, or performance-sensitive. Any change must include an impact paragraph in the PR.

## Regression Prevention Checklist (must be completed and referenced in PR body)

Before a PR merges, ensure the following (add checkboxes to PR):
- [ ] I searched for usages of changed symbols and listed top consumers.
- [ ] I updated `proto/` and regenerated code (if schema changed).
- [ ] I ran `npm run typecheck` and `npm run typecheck:api` locally and fixed issues.
- [ ] I added or updated unit tests and integration tests; CI coverage passes.
- [ ] I wrote or updated contract tests for API response shapes.
- [ ] I documented the change in `CHANGELOG.md` and included `Impact:` and `Rollback:` sections.
- [ ] I assigned a human architecture reviewer (must be on-call for the owning domain).
- [ ] I added `score_version` or feature flag (if scoring change).

## Anti-Butterfly-Effect Protections

Small changes in shared modules can cascade. Adopt these protections:
- Feature flags: guard behavior changes behind feature flags with a one-click kill switch.
- Canary rollouts: deploy scoring/contract changes to a canary path or shadow traffic before full rollout.
- Golden fixtures: maintain a set of golden input/output pairs for scoring, filtering and ranking to detect tiny deltas.
- Automated differential tests: CI should compare current scoring outputs against golden fixtures and block regressions.

## AI-Assisted Workflow (roles and limits)

Rules of engagement:
- AI = accelerator. Use AI to draft code, unit tests, and search-and-summarize results.
- Human = architecture reviewer. Every PR touching SSoT, scoring, API contracts, or `proto/` must be approved by a human reviewer from the owning team.

Hard limits for AI agents:
- AI must not autonomously refactor or rename SSoT symbols across files without an explicit migration plan and human approval.
- AI suggested changes must include: `SearchMatchCount: N`, `TopConsumers: [files...]`, `ImpactSummary:` and `TestsToAdd:`.

Recommended AI prompts for code authors (examples):
"List all files that import `Event` and show their TS signatures and callsites; include likely runtime environments." — good.

Bad prompt:
"Refactor the scoring to be simpler and update references everywhere" — DO NOT run this automatically. Requires manual planning.

## PR Template Additions (required fields)

Every PR that modifies shared/SSoT areas must include these fields in the description:
- Changed files summary
- Impact: list of likely downstream consumers
- Compatibility: additive | patch | breaking
- Tests added/updated
- Rollback plan (how to revert runtime behavior)

## Examples (concrete)

Example 1 — Adding a new Event field `source_confidence`:
1. Update `proto/worldmonitor/events.proto` with the new field (additive).
2. Run `make generate` and check generated files in `src/generated/`.
3. Add adapter code in `server/_shared/ingest.ts` to populate `source_confidence` with defaults for legacy data.
4. Add unit tests in `tests/event-schema.test.mjs` verifying both old and new payloads parse correctly.
5. Update `CHANGELOG.md` and PR `Impact:` section.

Example 2 — Tweaking a scoring weight:
1. Open `server/worldmonitor/score.js` (or canonical scoring file).
2. Add a new `score_version` and feature flag guarded rollout.
3. Add regression test comparing golden fixtures before and after.
4. Submit PR with canary rollout plan.

## Enforcement and Automation

Automated checks in CI must include:
- Typechecks: `npm run typecheck` and `npm run typecheck:api`.
- Contract tests for changed endpoints.
- Scoring delta tests against golden fixtures.
- Linting of `proto/` vs generated code freshness check (fail if out-of-sync).

Suggested CI job names:
- `typecheck:all`
- `test:contracts`
- `test:scoring-diff`
- `proto:check`

## Appendix — Quick commands and search examples

- Search for Event usages (example):
```bash
git grep "interface Event" -n || git grep "type Event" -n
```

- Run typechecks and tests:
```bash
npm run typecheck
npm run typecheck:api
npm run test:data
npm run test:sidecar
```

--

File ownership note: this document is itself a living artifact. Changes to `AI_ENGINEERING_RULES.md` MUST be approved by an architecture owner and reflected in the repo `CONTRIBUTING.md` and team onboarding materials.

See also: `AGENTS.md`, `proto/`, `server/_shared/`, and `src/config/variants/` for related conventions.
