# WorldMonitor Project Issues Analysis

Based on the analysis of the main documents of the WorldMonitor project (AGENTS.md, ARCHITECTURE.md, CHANGELOG.md) and the list of todos/, I will divide the issues that the project solves into main groups, then summarize what has been resolved and what has not been resolved. The project focuses on building a real-time global intelligence dashboard, so the main issues revolve around collecting, processing, displaying, and deploying data from multiple sources.

## Overview of the Number of Issues

- **Total number of issues tracked in todos/**: 35 issues (based on the number of files in the todos/ directory).
  - **Resolved (status: complete)**: 18 issues (mainly security bugs, logic scoring, and performance improvements in the simulation package).
  - **Unresolved (status: pending)**: 17 issues (including high-priority issues like prompt injection, auth deadlock, and improvements in simulation/forecasting).
- In addition, CHANGELOG.md records hundreds of changes across versions (from 2.5.24 to Unreleased), including new features, bug fixes, and improvements. These issues have mainly been resolved in recent releases.

The project does not divide issues into a fixed list, but they are classified according to main areas such as data collection, processing, UI, deployment, security, and testing. Below is the division based on architecture and core functions.

## Main Groups of Issues Addressed by the Project

### 1. Data Ingestion & Aggregation
**Issues**: Collecting real-time data from 30+ external sources (geopolitics, military, finance, climate, cyber, maritime, aviation, etc.), processing RSS feeds, API calls, and satellite data.

**Resolved**:
- Seed scripts system on Railway for periodic data fetching (e.g., aviation seed every hour, UCDP conflict data, GPS jamming from Wingbits).
- Caching with Redis (Upstash) to prevent stampede and reduce API load.
- Bootstrap hydration for fast data preloading.

**Unresolved**:
- Some issues in the simulation package (e.g., prompt injection from unsanitized entity fields, missing cases in LLM provider routing).

### 2. Data Processing & AI
**Issues**: AI-based news classification (server-side batch classification), forecasting, entity extraction, and simulation for geopolitical scenarios.

**Resolved**:
- AI classification for headlines, ONNX models for embeddings/sentiment on client, and simulation rounds with LLM (Gemini 2.5 Flash).
- Caching tiers (fast, medium, slow, static, daily) for performance optimization.

**Unresolved**:
- Bugs in scoring math (e.g., third_order hypotheses cannot reach "mapped" status due to incorrect floor check), prompt injection risks, and missing guards in the simulation package.

### 3. UI & Visualization
**Issues**: Rendering dashboard with 86 panels, dual map system (DeckGL + Globe), variants (full, tech, finance, commodity, happy), and responsive layout.

**Resolved**:
- Panel system with event delegation, resizable spans, and i18n for 21 languages.
- Map layers with PMTiles basemap, satellite tracking, and H3 hexagons for GPS jamming.
- Command palette (Cmd+K) for searching panels/layers.

**Unresolved**:
- Some layout issues (e.g., reconcile ultrawide zones when map is hidden), and performance warnings when adding layers.

### 4. Deployment & Infrastructure
**Issues**: Hosting SPA on Vercel, relay service on Railway, desktop app with Tauri, and containerization with Docker.

**Resolved**:
- Vercel Edge Functions for API, Railway for seeds/cron jobs, Tauri for macOS/Windows/Linux with Node.js sidecar.
- Health check system with auto seed-meta tracking.
- CDN optimizations (POST→GET conversion, tiered bootstrap).

**Unresolved**:
- Some Railway build issues (e.g., custom railpack.json causing ENOENT), and pre-push hook checks (CJS syntax, import guards).

### 5. Security & Rate Limiting
**Issues**: Protecting API from abuse, XSS, injection, and per-user rate limiting.

**Resolved**:
- CSP script hashes instead of unsafe-inline, crypto.randomUUID() for IDs, Turnstile CAPTCHA for Pro waitlist, and per-endpoint rate limits.
- Sanitize functions for prompts.

**Unresolved**:
- Prompt injection risks in simulation (unsanitized entity fields), and auth deadlock (isProUser gating).

### 6. Testing & Quality Assurance
**Issues**: Unit/integration tests, E2E with Playwright, visual regression, and pre-push hooks.

**Resolved**:
- Tests for API handlers, sidecar, and edge functions.
- CI workflows for typecheck, lint, proto-check.
- Markdown lint and MDX compatibility.

**Unresolved**:
- Some flaky tests or missing test cases (e.g., asserts for third_order reachability).

### 7. Additional Features
**Issues**: Blog site (Astro), Pro tier (finance tools, waitlist), and documentation (Mintlify).

**Resolved**:
- Blog with 16 posts, Pro landing page with referral system, and docs proxied through Vercel.

**Unresolved**:
- Some SEO improvements or missing features like simulation completion status field.

## Summary
- **Resolved**: Most core issues have been implemented and stabilized through releases (e.g., data ingestion from 30+ sources, UI with 86 panels, deployment on Vercel/Railway/Tauri, and basic security). CHANGELOG.md shows the project is operating stably with continuous improvements.
- **Unresolved**: Mainly high-priority (P1) bugs in simulation/forecasting (prompt injection, scoring math), some layout/performance issues, and auth/security refinements. These issues are tracked in todos/ and may be fixed in upcoming releases.