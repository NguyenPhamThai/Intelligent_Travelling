import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { h } from 'preact';
import render from 'preact-render-to-string';
import { UI_STATE_MAP } from '../shared/risk-score-spec.js';
import { EventsPanelView, type Event } from '../src/components/EventsPanel';

function renderView(uiState: string, events: Event[] = [], error: string | null = null): string {
  return render(
    h(EventsPanelView, {
      uiState,
      events,
      error,
      page: 1,
      hasNext: false,
      sort: 'risk_score:desc',
      category: 'all',
      riskLevel: 'all',
      timeRange: 'all',
      onSortChange: () => {},
      onCategoryChange: () => {},
      onRiskLevelChange: () => {},
      onTimeRangeChange: () => {},
      onPreviousPage: () => {},
      onNextPage: () => {},
      onRetry: () => {},
    }),
  );
}

describe('EventsPanel frontend UI states', () => {
  it('renders loading state while events are being fetched', () => {
    const html = renderView(UI_STATE_MAP.loading);

    assert.ok(html.includes('Loading events...'));
    assert.ok(!html.includes('Retry'));
  });

  it('renders error state with retry action', () => {
    const html = renderView(UI_STATE_MAP.error, [], 'Unable to load events. Please try again.');

    assert.ok(html.includes('Unable to load events. Please try again.'));
    assert.ok(html.includes('Retry'));
  });

  it('renders success state with backend-provided risk_score and threshold', () => {
    const html = renderView(UI_STATE_MAP.success, [
      {
        id: 'evt-1',
        title: 'City Center Riot',
        type: 'riot',
        location: { lat: 10.77, lon: 106.7 },
        severity: 0.8,
        risk_score: 88,
        threshold: 'red',
        timestamp: 1775952000000,
      },
    ]);

    assert.ok(html.includes('City Center Riot'));
    assert.ok(html.includes('Risk Score: 88 (RED)'));
    assert.ok(!html.includes('N/A'));
  });
});
