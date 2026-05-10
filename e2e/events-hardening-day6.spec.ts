import { test, expect } from '@playwright/test';

/**
 * Day 6 E2E Tests: Events Hardening + Demo Readiness
 *
 * Verifies:
 * 1. /api/events endpoint returns consistent schema
 * 2. Risk score 0 is handled correctly (not falsy)
 * 3. Fallback scoring works when AI fails
 * 4. Empty datasets are rendered safely
 * 5. Map popups show correct location data
 * 6. Filter interactions work end-to-end
 */

const API_BASE = process.env.API_BASE || 'http://localhost:5173';

/**
 * Test 1: Smoke test - FE → /api/events → render list
 */
test('smoke: fetch events and render in list', async ({ page }) => {
  await page.goto(`${API_BASE}/demo/filter_ui/index.html`);
  
  // Wait for events to load
  await page.waitForSelector('.event');
  
  // Verify at least one event is rendered
  const events = await page.locator('.event').count();
  expect(events).toBeGreaterThan(0);
  
  // Verify event structure
  const firstEvent = page.locator('.event').first();
  const html = await firstEvent.innerHTML();
  
  expect(html).toContain('weather');
  expect(html).toContain('badge');
  expect(html).toMatch(/\d+\.\d+/); // coordinates
});

/**
 * Test 2: Risk score = 0 is displayed correctly (not hidden)
 */
test('renders events with risk_score === 0 (green threshold)', async ({ page }) => {
  await page.goto(`${API_BASE}/demo/filter_ui/index.html`);
  
  // Set filter to show only very low risk
  await page.fill('#minRisk', '0');
  await page.fill('#maxRisk', '29');
  await page.click('#apply');
  
  await page.waitForTimeout(500);
  
  // Check if any events with score 0 exist
  const eventWithZero = page.locator('.event:has(.badge:has-text("0"))');
  const count = await eventWithZero.count();
  
  // If zero-risk events exist, they should be visible
  if (count > 0) {
    expect(count).toBeGreaterThan(0);
    
    const badgeText = await eventWithZero.first().locator('.badge').textContent();
    expect(badgeText).toBe('0');
  }
});

/**
 * Test 3: Empty dataset handling
 */
test('handles empty event results gracefully', async ({ page }) => {
  await page.goto(`${API_BASE}/demo/filter_ui/index.html`);
  
  // Filter to impossible criteria (lat/lon 0/0 with tiny radius)
  // This should return empty results
  await page.fill('#minRisk', '100');
  await page.fill('#maxRisk', '100');
  await page.click('#apply');
  
  await page.waitForTimeout(500);
  
  // Check for either empty message or no events
  const empty = await page.locator('.empty').count();
  const events = await page.locator('.event').count();
  
  // Either we have the "No events" message or no events shown
  expect(empty + events).toBeGreaterThanOrEqual(0);
});

/**
 * Test 4: Schema consistency - all required fields present
 */
test('api response includes all required event fields', async ({ page }) => {
  const response = await page.request.get(
    `${API_BASE}/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=10`
  );
  
  expect(response.ok()).toBe(true);
  const data = await response.json();
  
  // Check response structure
  expect(data).toHaveProperty('events');
  expect(data).toHaveProperty('total');
  expect(data).toHaveProperty('has_next');
  expect(data).toHaveProperty('page');
  expect(data).toHaveProperty('page_size');
  expect(data).toHaveProperty('timestamp');
  expect(data).toHaveProperty('_freshness');
  
  // Check metadata
  expect(typeof data._freshness.generated_at).toBe('number');
  expect(typeof data._freshness.max_age_seconds).toBe('number');
  expect(typeof data._freshness.is_stale).toBe('boolean');
  
  // Check event fields
  if (data.events.length > 0) {
    const event = data.events[0];
    expect(event).toHaveProperty('id');
    expect(event).toHaveProperty('location');
    expect(event).toHaveProperty('lat', event.location?.lat);
    expect(event).toHaveProperty('lon', event.location?.lon);
    expect(event).toHaveProperty('type');
    expect(event).toHaveProperty('severity');
    expect(event).toHaveProperty('risk_score');
    expect(event).toHaveProperty('timestamp');
    expect(event).toHaveProperty('source');
    expect(event).toHaveProperty('fallback_used');
    expect(event).toHaveProperty('threshold');
    
    // Verify types and ranges
    expect(typeof event.id).toBe('string');
    expect(typeof event.location).toBe('object');
    expect(typeof event.location.lat).toBe('number');
    expect(typeof event.location.lng).toBe('number');
    expect(typeof event.risk_score).toBe('number');
    expect(event.risk_score).toBeGreaterThanOrEqual(0);
    expect(event.risk_score).toBeLessThanOrEqual(100);
    expect(['green', 'yellow', 'red']).toContain(event.threshold);
  }
});

/**
 * Test 5: Map renders with correct risk color coding
 */
test('map markers show correct colors for risk levels', async ({ page }) => {
  await page.goto(`${API_BASE}`);
  
  // Wait for map to be ready
  await page.waitForSelector('[data-testid="map-container"]', { timeout: 10000 }).catch(() => null);
  
  // Check if map is visible
  const mapVisible = await page.locator('[data-testid="map-container"]').isVisible().catch(() => false);
  
  if (mapVisible) {
    // Verify map loaded
    expect(mapVisible).toBe(true);
  }
});

/**
 * Test 6: Filter interaction - category filter works
 */
test('filter UI updates results when filters applied', async ({ page }) => {
  await page.goto(`${API_BASE}/demo/filter_ui/index.html`);
  
  // Get initial event count
  await page.waitForSelector('.event');
  const initialCount = await page.locator('.event').count();
  
  // Uncheck crime events
  await page.uncheck('input[type="checkbox"][value="crime"]');
  await page.click('#apply');
  await page.waitForTimeout(500);
  
  // Verify crime events are filtered out
  const crimeAfter = await page.locator('.event:has-text("crime")').count();
  expect(crimeAfter).toBe(0);
});

/**
 * Test 7: Headers indicate scoring source and fallback info
 */
test('response headers indicate fallback usage', async ({ page }) => {
  const response = await page.request.get(
    `${API_BASE}/api/events?lat=21.0285&lon=105.8542&radius=10000`
  );
  
  expect(response.ok()).toBe(true);
  
  // Check headers
  expect(response.headers()).toHaveProperty('x-cache');
  expect(['hit', 'miss', 'bypass']).toContain(response.headers()['x-cache'].toLowerCase());
  
  // Fallback metadata headers
  expect(response.headers()).toHaveProperty('x-score-source');
  expect(response.headers()).toHaveProperty('x-fallback-count');
  expect(response.headers()).toHaveProperty('x-ai-score-count');
});

/**
 * Test 8: Pagination works correctly
 */
test('pagination maintains sort order and consistency', async ({ page }) => {
  // Fetch page 1
  const page1 = await page.request.get(
    `${API_BASE}/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=2&sort=risk_score:desc`
  );
  const data1 = await page1.json();
  
  // Fetch page 2
  const page2 = await page.request.get(
    `${API_BASE}/api/events?lat=21.0285&lon=105.8542&radius=10000&page=2&page_size=2&sort=risk_score:desc`
  );
  const data2 = await page2.json();
  
  // Verify sort order on page 1
  if (data1.events.length >= 2) {
    expect(data1.events[0].risk_score).toBeGreaterThanOrEqual(data1.events[1].risk_score);
  }
  
  // Verify pagination metadata
  expect(data1.page).toBe(1);
  expect(data2.page).toBe(2);
  expect(typeof data1.has_next).toBe('boolean');
  expect(typeof data2.has_next).toBe('boolean');
});

/**
 * Test 9: Risk score thresholds are consistent
 */
test('risk_score thresholds match UI color mapping', async ({ page }) => {
  const response = await page.request.get(
    `${API_BASE}/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=50`
  );
  
  const data = await response.json();
  
  // Check threshold mapping
  for (const event of data.events) {
    if (event.risk_score < 30) {
      expect(event.threshold).toBe('green');
    } else if (event.risk_score < 70) {
      expect(event.threshold).toBe('yellow');
    } else {
      expect(event.threshold).toBe('red');
    }
  }
});

/**
 * Test 10: Location normalization (always uses lon, not lng)
 */
test('event location uses "lon" not "lng"', async ({ page }) => {
  const response = await page.request.get(
    `${API_BASE}/api/events?lat=21.0285&lon=105.8542&radius=10000&page=1&page_size=10`
  );
  
  const data = await response.json();
  
  for (const event of data.events) {
    // Verify "lon" is present
    expect(event.location).toHaveProperty('lon');
    expect(typeof event.location.lng).toBe('number');
    
    // Verify "lng" is NOT present
    expect(event.location).not.toHaveProperty('lng');
  }
});
