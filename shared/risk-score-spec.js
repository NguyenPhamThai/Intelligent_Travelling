import {
  calculateRiskScore,
  clampRiskScore,
  getRiskLevel,
  RISK_SCORE_MAX,
  RISK_SCORE_MIN,
  RISK_SCORE_THRESHOLDS,
  sanitizeRiskScore,
} from './risk-score.js';

export const UI_STATE_MAP = Object.freeze({
  loading: 'loading',
  error: 'error',
  success: 'success',
});

export const EVENT_CONTRACT = Object.freeze({
  required: Object.freeze({
    id: 'string',
    location: Object.freeze({ lat: 'number', lng: 'number' }),
    type: 'riot|crime|weather',
    severity: 'number',
    timestamp: 'number',
  }),
});

const TYPE_WEIGHTS = Object.freeze({
  riot: 1,
  crime: 0.8,
  weather: 0.5,
});

export const RISK_SCORE_SPEC = Object.freeze({
  scale: { min: RISK_SCORE_MIN, max: RISK_SCORE_MAX },
  formula: 'risk_score = clamp(severity × typeWeight × 100, 0..100)',
  typeWeights: TYPE_WEIGHTS,
  thresholds: RISK_SCORE_THRESHOLDS,
  uiStates: UI_STATE_MAP,
  apiContract: {
    input: {
      type: 'full Event',
      required: EVENT_CONTRACT.required,
    },
    output: {
      // Core response fields
      risk_score: 'number (0-100)',
      source: 'string (ai|rule_based)',
      score_source: 'string (ai|rule_based, alias for source)',
      fallback_used: 'boolean',
      fallback_reason: 'string|undefined (forced_by_env|model_timeout|model_http_error|model_unavailable|invalid_score|ai_unavailable)',
      threshold: 'green|yellow|red',
      // Metadata
      fallback_version: 'string (version identifier)',
    },
    responseHeaders: {
      'X-Cache': 'HIT|MISS|BYPASS',
      'X-Score-Source': 'ai|rule_based|mixed',
      'X-Fallback-Count': 'number (count of fallback-scored events)',
      'X-AI-Score-Count': 'number (count of AI-scored events)',
    },
  },
  examples: {
    request: {
      id: 'evt_20260412_001',
      location: { lat: 10.7769, lng: 106.7009 },
      type: 'riot',
      severity: 0.72,
      timestamp: 1775952000000,
    },
    response: {
      risk_score: 72,
      source: 'ai',
      score_source: 'ai',
      fallback_used: false,
      fallback_reason: undefined,
      threshold: 'red',
      fallback_version: 'rb-v1',
    },
    responseWithFallback: {
      risk_score: 60,
      source: 'rule_based',
      score_source: 'rule_based',
      fallback_used: true,
      fallback_reason: 'model_timeout',
      threshold: 'yellow',
      fallback_version: 'rb-v1',
    },
  },
});

export function isFullEvent(event) {
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

export { calculateRiskScore, clampRiskScore, getRiskLevel, sanitizeRiskScore };

// Backward-compatible alias for older callers.
export const getThreshold = getRiskLevel;