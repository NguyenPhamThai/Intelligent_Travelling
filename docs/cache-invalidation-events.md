# Events Cache Invalidation (Day 5)

Purpose: document when and how to purge or flush `events` cache entries safely during Day 5 work.


Key namespace

- All keys are namespaced with a version prefix: `events:v1:...`.


When to purge (triggers)

- Data ingestion: new upstream batch or bootstrap writes replace event sets for a region.
- Scoring change: risk scoring algorithm version bump (major change to `calculateRiskScore`).
- Hotfix: discovered cache poisoning or stale leak for a specific query.


Recommended purge patterns

- Exact key (preferred when you know the canonical key):
  - `events:v1:lat:21.0285|lon:105.8542|...` (use `buildCanonicalCacheKey(params)` to compute exact key)
- Region-level purge (rounded lat/lon):
  - `events:v1:*lat:21.0285*lon:105.8542*` — scans keys containing both rounded lat and lon
- Category-level purge:
  - `events:v1:*category:crime*`
- Full namespace purge (use only in emergencies):
  - `events:v1:*`


How to purge via API

- Use `api/cache-purge` POST with `patterns` array. Example curl (requires `RELAY_SHARED_SECRET`):

```bash
curl -X POST https://your-deploy-url/api/cache-purge \
  -H "Authorization: Bearer $RELAY_SHARED_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"patterns":["events:v1:*lat:21.0285*lon:105.8542*"]}'
```


Seed-meta

- For every cache write the handler also writes a `seed-meta:<key>` object containing `{ fetchedAt, recordCount }`.
- `seed-meta` is used by health checks to detect staleness and by operators to audit purges.


Safe purge rules

- Do NOT purge keys without confirming the prefix or you may delete unrelated data.
- Avoid broad `events:v1:*` in normal operations — use region or category-level patterns.
- Blocklisted prefixes are protected by `api/cache-purge` (see `DURABLE_DATA_PREFIXES`).


Automation suggestions

- In ingestion pipeline, after atomic publish (seed) call `api/cache-purge` for the exact affected keys or patterns.
- When rolling scoring version, bump the namespace (e.g., `events:v2:`) to avoid live purges; then schedule old key expiry.

Contact
- For emergency purge, tag @oncall and include the matching patterns and `seed-meta` evidence.
