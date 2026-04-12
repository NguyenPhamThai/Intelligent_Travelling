export type { EventType, RiskEvent as Event, RiskThreshold } from '../../shared/risk-score-spec.js';
export {
  EVENT_CONTRACT,
  RISK_SCORE_MAX,
  RISK_SCORE_MIN,
  RISK_SCORE_SPEC,
  RISK_SCORE_THRESHOLDS,
  UI_STATE_MAP,
  calculateRiskScore,
  clampRiskScore,
  getThreshold,
  isFullEvent,
} from '../../shared/risk-score-spec.js';