# Event Schema Documentation

This document describes the real event schemas used across the WorldMonitor project, based on actual implementation code, type definitions, protobuf contracts, and API specifications.

**Last updated:** May 11, 2026  
**Source of truth:** Implementation-driven from TypeScript types, protobuf definitions, and API handlers

---

## Table of Contents

1. [Project Schema Overview](#project-schema-overview)
2. [Canonical Event Schema](#canonical-event-schema)
3. [Domain-Specific Event Schemas](#domain-specific-event-schemas)
4. [API Response Structures](#api-response-structures)
5. [Risk Scoring Contract](#risk-scoring-contract)
6. [Validation Rules](#validation-rules)
7. [Schema Inconsistencies & Risks](#schema-inconsistencies--risks)
8. [Recommended Fixes](#recommended-fixes)
9. [Files Involved](#files-involved)

---

## Project Schema Overview

WorldMonitor aggregates 30+ data sources and defines events across multiple layers:

| Layer | Purpose | Primary Types |
|-------|---------|---------------|
| **Core Frontend** | User-facing safety/risk events | `Event`, `SafetyEvent` |
| **Protobuf Contracts** | Backend domain services | `AcledConflictEvent`, `UcdpViolenceEvent`, `UnrestEvent`, `TechEvent`, etc. |
| **API Response** | HTTP endpoint contracts | `EventsResponse`, risk-scored event payloads |
| **AI Scoring** | Risk quantification | Score input/output contract |
| **Geo Core** | Canonical coordinate representation | `GeoCoordinates` (proto) |

**Key Pattern:** Proto definitions define domain-specific events → TypeScript generates server/client stubs → API normalizes responses → Frontend renders with risk scoring.

---

## Canonical Event Schema

### Core Frontend Event Type

**File:** [`src/types/event.ts`](src/types/event.ts)

The canonical event type for safety/risk alerts in the browser:

```typescript
export type Event = {
  id: string                                    // Unique event identifier
  location: { lat: number; lng: number }       // WGS84 coordinates (INCONSISTENCY: uses 'lng')
  type: "weather" | "crime" | "riot"           // Event classification
  severity: number                             // Source severity: 0.0 to 1.0
  severity_level?: string                      // Optional: 'green', 'yellow', 'red', etc.
  risk_score?: number                          // AI-calculated risk score: 0-100 (optional in type, required in API)
  title?: string                               // Event headline
  description?: string                         // Event summary
  radius_km?: number                           // Impact radius in kilometers
  source?: 'ai' | 'rule_based'                 // Risk scoring source
  fallback_used?: boolean                      // Whether rule-based fallback was used
  threshold?: 'green' | 'yellow' | 'red'       // Risk threshold (derived from risk_score)
  duration_hours?: number                      // Event duration estimate
  timestamp: number                            // Unix epoch milliseconds (when event occurred)
}
```

### SafetyEvent (Shared Type)

**File:** [`shared/safety-types.ts`](shared/safety-types.ts)

Domain-specific safety event with AI scoring:

```typescript
export interface SafetyEvent {
  id: string                              // Unique identifier
  location: { lat: number; lon: number }  // INCONSISTENCY: uses 'lon' not 'lng'
  type: "weather" | "crime" | "riot" | "disaster"
  severity: number                        // 0.0 to 1.0 (source severity)
  risk_score: number                      // AI-computed: 0 to 100
  description: string                     // Event details
  timestamp: number                       // Unix epoch milliseconds
}
```

**Note:** `SafetyEvent` uses `lon` while core `Event` uses `lng`. API normalizes both.

### Risk Event (Scoring Contract)

**File:** [`shared/risk-score-spec.d.ts`](shared/risk-score-spec.d.ts)

Minimal required structure for risk scoring:

```typescript
export interface RiskEvent {
  id: string
  location: { lat: number; lon: number }  // Uses 'lon'
  type: EventType                         // 'weather' | 'crime' | 'riot'
  severity: number
  risk_score?: number
  timestamp: number
  [key: string]: unknown                  // Allows additional fields
}
```

---

## Domain-Specific Event Schemas

### 1. ACLED Conflict Event

**File:** [`proto/worldmonitor/conflict/v1/acled_event.proto`](proto/worldmonitor/conflict/v1/acled_event.proto)

Armed conflict events from ACLED dataset:

```typescript
export interface AcledConflictEvent {
  id: string                              // ACLED identifier
  eventType: string                       // e.g., "Battles", "Explosions/Remote violence"
  country: string                         // Country code or name
  location?: GeoCoordinates                // Proto-generated: {latitude, longitude}
  occurredAt: number                      // Unix epoch milliseconds
  fatalities: number                      // Death toll estimate
  actors: string[]                        // Named parties involved
  source: string                          // Original report source
  admin1: string                          // Administrative region
}

export interface GeoCoordinates {
  latitude: number                        // -90 to 90
  longitude: number                       // -180 to 180
}
```

### 2. UCDP Violence Event

**File:** [`proto/worldmonitor/conflict/v1/ucdp_event.proto`](proto/worldmonitor/conflict/v1/ucdp_event.proto)

Georeferenced violence from UCDP dataset:

```typescript
export interface UcdpViolenceEvent {
  id: string                              // UCDP event ID
  dateStart: number                       // Conflict start (Unix ms)
  dateEnd: number                         // Conflict end (Unix ms)
  location?: GeoCoordinates                // {latitude, longitude}
  country: string                         // Country
  sideA: string                           // Primary party
  sideB: string                           // Secondary party
  deathsBest: number                      // Best estimate of deaths
  deathsLow: number                       // Conservative estimate
  deathsHigh: number                      // High estimate
  violenceType: UcdpViolenceType          // 'state-based' | 'non-state' | 'one-sided'
  sourceOriginal: string                  // Original source
}
```

### 3. Unrest Event

**File:** [`proto/worldmonitor/unrest/v1/unrest_event.proto`](proto/worldmonitor/unrest/v1/unrest_event.proto)

Social unrest (protests, riots, strikes) aggregated from ACLED and GDELT:

```typescript
// Proto message structure:
message UnrestEvent {
  string id = 1;                          // Unique identifier
  string title = 2;                       // Headline
  string summary = 3;                     // Summary
  UnrestEventType event_type = 4;         // Enum: PROTEST, RIOT, STRIKE, DEMONSTRATION, etc.
  string city = 5;
  string country = 6;
  string region = 7;                      // Administrative region
  GeoCoordinates location = 8;            // {latitude, longitude}
  int64 occurred_at = 9;                  // Unix milliseconds
  SeverityLevel severity = 10;            // Enum: LOW, MEDIUM, HIGH, CRITICAL
  int32 fatalities = 11;
  repeated string sources = 12;           // Source IDs
  UnrestSourceType source_type = 13;      // ACLED, GDELT, etc.
  repeated string tags = 14;              // Descriptive tags
  repeated string actors = 15;            // Named actors/groups
  ConfidenceLevel confidence = 16;        // Confidence in data
}
```

### 4. Tech Event

**File:** [`proto/worldmonitor/research/v1/list_tech_events.proto`](proto/worldmonitor/research/v1/list_tech_events.proto)

Technology conferences, earnings, IPOs:

```typescript
export interface TechEvent {
  id: string                              // Unique ID
  title: string                           // Event title
  type: string                            // 'conference' | 'earnings' | 'ipo' | 'other'
  location: string                        // Location description
  coords?: TechEventCoords                 // Geocoded location (optional)
  startDate: string                       // YYYY-MM-DD
  endDate: string                         // YYYY-MM-DD
  url: string                             // Event URL
  source: string                          // 'techmeme', 'dev.events', 'curated'
  description: string                     // Event description
}

export interface TechEventCoords {
  lat: number                             // Latitude
  lng: number                             // Longitude (uses 'lng')
  country: string                         // Country name
  original: string                        // Raw location string
  virtual: boolean                        // Virtual/online event flag
}
```

---

## API Response Structures

### Events Endpoint Response

**File:** [`src/types/event.ts`](src/types/event.ts)

```typescript
export type EventsResponse = {
  events: Event[]                         // Array of risk-scored events
  total: number                           // Total count in dataset
  has_next: boolean                       // Pagination flag
  page: number                            // Current page
  page_size: number                       // Items per page
  query: {                                // Original query parameters
    lat: number
    lon: number                           // Query coords use 'lon'
    radius_km: number
    page?: number
    page_size?: number
    sort?: string                         // 'risk_score:desc' | 'occurred_at:desc'
    category?: string                     // Event category filter
    risk_level?: string                   // 'low' | 'medium' | 'high'
    time_range?: string                   // 'last_1h' | 'last_24h' | 'last_7d' | 'all'
  }
  timestamp: number                       // Response generation time (Unix ms)
}
```

### Normalized API Response (Internal)

**File:** [`api/events.js`](api/events.js) (line ~175)

Events after normalization through `normalizeEvent()`:

```javascript
{
  id: string                              // Event ID
  title: string                           // Event title
  location: { lat: number; lng: number }  // Normalized to 'lng'
  type: string                            // 'riot' | 'crime' | 'weather'
  severity: number                        // 0.0 to 1.0
  timestamp: number                       // Unix milliseconds
  risk_score: number                      // 0-100 (clamped)
  source: 'ai' | 'rule_based'             // Scoring source
  fallback_used: boolean                  // Fallback flag
  fallback_reason?: string                // Reason if fallback used
  threshold: 'green' | 'yellow' | 'red'   // Derived from risk_score
}
```

---

## Risk Scoring Contract

### Official Specification

**File:** [`shared/risk-score-spec.js`](shared/risk-score-spec.js)

The canonical risk scoring contract:

```javascript
export const EVENT_CONTRACT = Object.freeze({
  required: Object.freeze({
    id: 'string',
    location: Object.freeze({ lat: 'number', lng: 'number' }),
    type: 'riot|crime|weather',
    severity: 'number',
    timestamp: 'number',
  }),
});

export const RISK_SCORE_SPEC = Object.freeze({
  scale: { min: 0, max: 100 },
  formula: 'risk_score = clamp(severity × typeWeight × 100, 0..100)',
  typeWeights: {
    riot: 1.0,    // 100% multiplier
    crime: 0.8,   // 80% multiplier
    weather: 0.5, // 50% multiplier
  },
  thresholds: {
    green: 30,    // risk_score < 30
    yellow: 70,   // 30 ≤ risk_score < 70
    red: 100,     // risk_score ≥ 70
  },
  apiContract: {
    input: { type: 'full Event', required: EVENT_CONTRACT.required },
    output: {
      risk_score: 'number (0-100)',
      source: 'string (ai|rule_based)',
      score_source: 'string (ai|rule_based, alias for source)',
      fallback_used: 'boolean',
      fallback_reason: 'string|undefined',
      threshold: 'green|yellow|red',
      fallback_version: 'string (version identifier)',
    },
  },
});
```

### Request/Response Example

```javascript
// AI Scoring Request
{
  id: 'evt_20260412_001',
  location: { lat: 10.7769, lng: 106.7009 },
  type: 'riot',
  severity: 0.72,
  timestamp: 1775952000000,
}

// Response (AI Success)
{
  risk_score: 72,
  source: 'ai',
  score_source: 'ai',
  fallback_used: false,
  fallback_reason: undefined,
  threshold: 'red',
  fallback_version: 'rb-v1',
}

// Response (Fallback Used)
{
  risk_score: 60,
  source: 'rule_based',
  score_source: 'rule_based',
  fallback_used: true,
  fallback_reason: 'model_timeout',
  threshold: 'yellow',
  fallback_version: 'rb-v1',
}
```

### Response Headers

| Header | Values | Purpose |
|--------|--------|---------|
| `X-Cache` | `HIT` \| `MISS` \| `BYPASS` | Cache status |
| `X-Score-Source` | `ai` \| `rule_based` \| `mixed` | Which scorer was used |
| `X-Fallback-Count` | `number` | Count of fallback-scored events |
| `X-AI-Score-Count` | `number` | Count of AI-scored events |

---

## Validation Rules

### Core Event Validation

**File:** [`shared/risk-score-spec.js`](shared/risk-score-spec.js) (lines 91-115)

```javascript
export function isFullEvent(event) {
  // Check all required fields
  return (
    !!event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    typeof event.location === 'object' &&
    typeof event.location?.lat === 'number' &&
    typeof event.location?.lng === 'number' &&
    typeof event.type === 'string' &&
    ['riot', 'crime', 'weather'].includes(event.type) &&
    typeof event.severity === 'number' &&
    typeof event.timestamp === 'number'
  );
}

export function hasRequiredScoreFields(event) {
  // Stricter validation: requires numeric bounds
  return (
    !!event &&
    typeof event === 'object' &&
    typeof event.id === 'string' &&
    event.id.trim().length > 0 &&
    typeof event.type === 'string' &&
    ['riot', 'crime', 'weather'].includes(event.type) &&
    typeof event.severity === 'number' &&
    Number.isFinite(event.severity) &&
    typeof event.location === 'object' &&
    Number.isFinite(event.location?.lat) &&
    Number.isFinite(event.location?.lng) &&
    typeof event.timestamp === 'number' &&
    Number.isFinite(event.timestamp)
  );
}
```

### API Coordinate Validation

**File:** [`api/events.js`](api/events.js) (lines 530-545)

```javascript
function validateCoordinates(lat, lon) {
  const latNum = toNumber(lat);
  const lonNum = toNumber(lon);

  if (Number.isNaN(latNum) || Number.isNaN(lonNum)) {
    return { valid: false, error: 'Invalid lat/lon: must be numbers' };
  }
  if (latNum < -90 || latNum > 90) {
    return { valid: false, error: 'Latitude must be between -90 and 90' };
  }
  if (lonNum < -180 || lonNum > 180) {
    return { valid: false, error: 'Longitude must be between -180 and 180' };
  }

  return { valid: true };
}
```

### Proto Validation Constraints

Proto messages use `buf/validate` annotations:

```protobuf
// GeoCoordinates (proto/worldmonitor/core/v1/geo.proto)
message GeoCoordinates {
  double latitude = 1 [
    (buf.validate.field).double.gte = -90,
    (buf.validate.field).double.lte = 90
  ];
  double longitude = 2 [
    (buf.validate.field).double.gte = -180,
    (buf.validate.field).double.lte = 180
  ];
}

// Event ID requirements
string id = 1 [
  (buf.validate.field).required = true,
  (buf.validate.field).string.min_len = 1
];
```

---

## Schema Inconsistencies & Risks

### 🔴 CRITICAL: Coordinate Naming Mismatch

| File | Coordinate Names | Notes |
|------|------------------|-------|
| `src/types/event.ts` | `{ lat, lng }` | Frontend Event type |
| `shared/safety-types.ts` | `{ lat, lon }` | SafetyEvent type |
| `shared/risk-score-spec.js` | `{ lat, lng }` | Risk scoring contract |
| `api/events.js` | `{ lat, lon }` | Mock events |
| `src/mocks/mockEvents.ts` | `{ lat, lon }` | Test data |
| `proto/core/v1/geo.proto` | `{ latitude, longitude }` | Canonical protobuf |
| `proto/research/v1/list_tech_events.proto` | `{ lat, lng }` | TechEvent coordinates |

**Risk:** Function `normalizeEvent()` handles both as fallback:
```javascript
Number.isFinite(Number(rawEvent?.location?.lng ?? rawEvent?.location?.lon))
```
This silently accepts both but can lead to subtle cross-system bugs if callers send misnamed fields.

**Impact:** HIGH
- Frontend sends `lng`, API expects `lon` or `lng`
- Tests use `lon`, validators expect `lng`
- Proto uses `latitude`/`longitude`

### 🟡 MEDIUM: Risk Score Optionality

| Layer | risk_score | Notes |
|-------|-----------|-------|
| `Event` type | optional (`?`) | `risk_score?: number` |
| API response | required | Always included after scoring |
| RiskEvent | optional (`?`) | `risk_score?: number` |

**Risk:** Frontend code may not guard against `event.risk_score === undefined`

```typescript
// Unsafe - will fail if risk_score is undefined
const color = event.risk_score > 70 ? 'red' : 'yellow';

// Safe
const color = (event.risk_score ?? 0) > 70 ? 'red' : 'yellow';
```

**Impact:** MEDIUM - Can cause UI crashes on old cached events

### 🟡 MEDIUM: Timestamp Field Naming

| Layer | Timestamp Field | Notes |
|---------|----------------|-------|
| Core Event | `timestamp` | Unix ms |
| Proto (ACLED, UCDP, Unrest) | `occurred_at` | Unix ms |
| API Query | `last_1h`, `last_24h`, `last_7d`, `all` | Relative ranges |

**Risk:** Code must translate between `timestamp` ↔ `occurred_at`

**Impact:** MEDIUM - Potential confusion when mapping domain events to frontend

### 🟡 MEDIUM: Type Classification Drift

**File:** [`src/types/index.ts`](src/types/index.ts) defines many event categories:

```typescript
export type EventCategory =
  | 'conflict' | 'protest' | 'disaster' | 'diplomatic' | 'economic'
  | 'terrorism' | 'cyber' | 'health' | 'environmental' | 'military'
  | 'crime' | 'infrastructure' | 'tech' | 'general';
```

But core `Event` type only supports:
```typescript
type: "weather" | "crime" | "riot"
```

**Risk:** Richer event types (tech, military, cyber) get coerced to "weather" | "crime" | "riot"

**Impact:** LOW-MEDIUM - Scoring accuracy reduced for diverse event types

### 🟢 LOW: Severity Scale Ambiguity

- Core `severity` is float: 0.0 to 1.0
- `risk_score` is integer: 0 to 100
- Proto `SeverityLevel` is enum: LOW, MEDIUM, HIGH, CRITICAL

**Risk:** Conversion between scales may lose precision

**Impact:** LOW - Risk scoring formula compensates via type weights

### 🟢 LOW: Geographic Precision Loss

- Proto uses `double` (64-bit floats)
- TypeScript uses `number` (IEEE 754)
- API caches with 4 decimal place rounding (~11m precision)

```javascript
const lat = Math.round(params.lat * 10000) / 10000;  // 4 decimals
```

**Impact:** LOW - Acceptable for most use cases

---

## Recommended Fixes

### Priority 1: Normalize Coordinate Naming

**Action:** Standardize on `longitude`/`latitude` in proto, `lng`/`lat` in TypeScript.

```typescript
// CURRENT (mixed)
location: { lat: number; lng: number }  // Event.ts
location: { lat: number; lon: number }  // SafetyEvent.ts

// PROPOSED (consistent)
location: { lat: number; lng: number }  // All TypeScript types
// Proto remains: { latitude: double; longitude: double }
```

**Files to update:**
1. [`shared/safety-types.ts`](shared/safety-types.ts): Change `lon` → `lng`
2. [`api/events.js`](api/events.js): Remove fallback handling, enforce `lng`
3. [`src/mocks/mockEvents.ts`](src/mocks/mockEvents.ts): Change `lon` → `lng`
4. Test files: Update mock event fixtures

**Risk of change:** LOW (API normalizes both currently; adding migration layer is feasible)

### Priority 2: Make risk_score Required in Frontend Type

**Action:** Update `Event` type to require `risk_score`:

```typescript
// CURRENT
risk_score?: number

// PROPOSED
risk_score: number  // Always populated by API
```

**Rationale:** API always includes it after scoring; frontend should treat as required.

**Files to update:**
1. [`src/types/event.ts`](src/types/event.ts)
2. Add type guard in API response handler

### Priority 3: Unify Event Type Classification

**Action:** Expand core `Event.type` to support more categories:

```typescript
// CURRENT
type: "weather" | "crime" | "riot"

// PROPOSED
type: "weather" | "crime" | "riot" | "conflict" | "cyber" | "military" | "tech"
```

**Files to update:**
1. [`src/types/event.ts`](src/types/event.ts)
2. [`shared/risk-score-spec.js`](shared/risk-score-spec.js): Extend type weights
3. Update risk score formula for new types

### Priority 4: Document Timestamp Field Convention

**Action:** Create a mapping guide for callers translating between domain events and `Event`:

```typescript
// Proto ACLED event → Frontend Event
const frontendEvent: Event = {
  id: acledEvent.id,
  timestamp: acledEvent.occurredAt,  // ← occurredAt → timestamp
  location: { lat: acledEvent.location.latitude, lng: acledEvent.location.longitude },
  // ...
};
```

**Files to update:**
1. Create [`src/utils/event-mapper.ts`](src/utils/event-mapper.ts)
2. Update API handlers to use mapper

### Priority 5: Add Runtime Schema Validation

**Action:** Use runtime validators (e.g., Zod, io-ts) for API responses:

```typescript
// Example (Zod)
import { z } from 'zod';

const EventSchema = z.object({
  id: z.string().min(1),
  location: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  type: z.enum(['weather', 'crime', 'riot']),
  severity: z.number().min(0).max(1),
  risk_score: z.number().min(0).max(100),
  timestamp: z.number().int().positive(),
});

const events = EventSchema.array().parse(apiResponse.events);
```

**Current state:** Manual validation via `isFullEvent()`, `hasRequiredScoreFields()`

---

## Files Involved

### Type Definitions

| File | Purpose | Fields Defined |
|------|---------|-----------------|
| [`src/types/event.ts`](src/types/event.ts) | Core frontend event & response | `Event`, `EventsResponse` |
| [`shared/safety-types.ts`](shared/safety-types.ts) | Safety-specific types | `SafetyEvent`, `UserLocation` |
| [`shared/risk-score-spec.d.ts`](shared/risk-score-spec.d.ts) | Risk score types (generated) | `RiskEvent`, `RISK_SCORE_SPEC` |
| [`shared/risk-score-spec.js`](shared/risk-score-spec.js) | Risk score implementation | `EVENT_CONTRACT`, `RISK_SCORE_SPEC` |

### Proto Definitions

| File | Domain | Event Type |
|------|--------|-----------|
| [`proto/worldmonitor/core/v1/geo.proto`](proto/worldmonitor/core/v1/geo.proto) | Core | `GeoCoordinates` |
| [`proto/worldmonitor/conflict/v1/acled_event.proto`](proto/worldmonitor/conflict/v1/acled_event.proto) | Conflict | `AcledConflictEvent` |
| [`proto/worldmonitor/conflict/v1/ucdp_event.proto`](proto/worldmonitor/conflict/v1/ucdp_event.proto) | Conflict | `UcdpViolenceEvent` |
| [`proto/worldmonitor/unrest/v1/unrest_event.proto`](proto/worldmonitor/unrest/v1/unrest_event.proto) | Civil Unrest | `UnrestEvent` |
| [`proto/worldmonitor/research/v1/list_tech_events.proto`](proto/worldmonitor/research/v1/list_tech_events.proto) | Technology | `TechEvent` |

### API Implementation

| File | Purpose |
|------|---------|
| [`api/events.js`](api/events.js) | Main `/api/events` endpoint handler |
| [`api/_json-response.js`](api/_json-response.js) | Response formatting |
| [`api/_rate-limit.js`](api/_rate-limit.js) | Rate limiting |
| [`api/_upstash-json.js`](api/_upstash-json.js) | Redis caching |

### Tests & Mocks

| File | Purpose |
|------|---------|
| [`src/mocks/mockEvents.ts`](src/mocks/mockEvents.ts) | Mock events for dev/testing |
| [`api/events-cache.test.mjs`](api/events-cache.test.mjs) | API cache tests |
| [`e2e/runtime-fetch.spec.ts`](e2e/runtime-fetch.spec.ts) | E2E API tests |

### Generated Code (Do Not Edit)

| File | Source |
|------|--------|
| [`src/generated/server/worldmonitor/conflict/v1/service_server.ts`](src/generated/server/worldmonitor/conflict/v1/service_server.ts) | Proto → TypeScript (conflict service) |
| All `src/generated/**` | Proto → TypeScript stubs (readonly) |

---

## Schema Consistency Status

### Summary

| Aspect | Status | Severity |
|--------|--------|----------|
| Coordinate naming (`lng` vs `lon` vs `longitude`) | ⚠️ Inconsistent | HIGH |
| risk_score optionality | ⚠️ Mixed | MEDIUM |
| Timestamp field naming (`timestamp` vs `occurred_at`) | ⚠️ Inconsistent | MEDIUM |
| Event type classification | ⚠️ Limited | MEDIUM |
| Validation coverage | ✅ Adequate | N/A |
| Proto definitions | ✅ Well-defined | N/A |
| API response shape | ✅ Stable | N/A |

### Production Readiness Assessment

**Current State:** 🟡 YELLOW - Functional but with friction

- ✅ Core event scoring works
- ✅ API endpoints are stable
- ✅ Proto contracts are well-defined
- ⚠️ Coordinate naming requires developer awareness
- ⚠️ Risk score optionality can cause UI crashes
- ⚠️ Type narrowing limits scoring accuracy

**Recommendation:** Address Priority 1 & 2 before major client deployments. Current system works but is fragile to misuse.

---

## Appendix: Real-World Examples

### Example 1: Scoring a Riot Event

```javascript
// Input from ACLED
const acledEvent = {
  id: 'acled-20260510-001',
  event_type: 'Riots',
  country: 'VN',
  location: { latitude: 21.0285, longitude: 105.8542 },
  occurred_at: 1746932400000,
  fatalities: 2,
  actors: ['Students', 'Police'],
  source: 'ACLED Database',
  admin1: 'Hanoi',
};

// Frontend Event after API scoring
{
  id: 'evt-acled-20260510-001',
  location: { lat: 21.0285, lng: 105.8542 },
  type: 'riot',
  severity: 0.8,  // Estimated from fatalities + type
  risk_score: 80, // = clamp(0.8 × 1.0 × 100, 0..100)
  title: 'Hanoi Riots',
  description: 'Student protests turned violent',
  timestamp: 1746932400000,
  source: 'ai',  // or 'rule_based'
  fallback_used: false,
  threshold: 'red',  // risk_score >= 70
}
```

### Example 2: Weather Event Fallback

```javascript
// Input (incomplete)
{
  id: 'weather-20260510-002',
  type: 'weather',
  severity: 0.4,
  location: { lat: 35.6762 },  // Missing lng!
  timestamp: 1746936000000,
}

// API normalizes + falls back to rule-based scoring
{
  id: 'weather-20260510-002',
  location: { lat: 35.6762, lng: 0 },  // lng filled with 0
  type: 'weather',
  severity: 0.4,
  risk_score: 20,  // = clamp(0.4 × 0.5 × 100, 0..100)
  threshold: 'green',
  source: 'rule_based',
  fallback_used: true,
  fallback_reason: 'invalid_score',
}
```

### Example 3: Tech Event with Coordinates

```javascript
// Input from TechEvent proto
{
  id: 'tech-2026-pycon-001',
  title: 'PyCon 2026',
  type: 'conference',
  location: 'San Francisco, CA',
  coords: {
    lat: 37.7749,
    lng: -122.4194,
    country: 'US',
    virtual: false,
  },
  start_date: '2026-05-15',
  end_date: '2026-05-18',
  source: 'techmeme',
}

// Not directly mapped to core Event type (no risk_score)
// Used separately in tech-specific panels
```

---

**Document maintained by:** Engineering Team  
**Last validation:** May 2026  
**Next review:** Recommended after proto schema changes or coordinate naming fix
