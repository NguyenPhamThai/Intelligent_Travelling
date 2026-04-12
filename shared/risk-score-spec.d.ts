export type RiskThreshold = 'green' | 'yellow' | 'red';

export type UiState = 'loading' | 'error' | 'success';

export type EventType = 'weather' | 'crime' | 'riot';

export interface RiskEvent {
  id: string;
  location: { lat: number; lon: number };
  type: EventType;
  severity: number;
  risk_score?: number;
  timestamp: number;
  [key: string]: unknown;
}

export declare const RISK_SCORE_MIN: 0;
export declare const RISK_SCORE_MAX: 100;
export declare const RISK_SCORE_THRESHOLDS: Readonly<{
  green: 30;
  yellow: 70;
  red: 100;
}>;
export declare const UI_STATE_MAP: Readonly<Record<UiState, UiState>>;
export declare const EVENT_CONTRACT: Readonly<{
  required: Readonly<{
    id: 'string';
    location: Readonly<{ lat: 'number'; lon: 'number' }>;
    type: 'riot|crime|weather';
    severity: 'number';
    timestamp: 'number';
  }>;
}>;
export declare const RISK_SCORE_SPEC: Readonly<{
  scale: Readonly<{ min: 0; max: 100 }>;
  formula: string;
  typeWeights: Readonly<Record<EventType, number>>;
  thresholds: typeof RISK_SCORE_THRESHOLDS;
  uiStates: typeof UI_STATE_MAP;
  apiContract: Readonly<{
    input: Readonly<{
      type: 'full Event';
      required: typeof EVENT_CONTRACT.required;
    }>;
    output: Readonly<{
      risk_score: 'number';
      source: 'string';
      fallback_used: 'boolean';
      threshold: 'green|yellow|red';
    }>;
  }>;
  examples: Readonly<{
    request: Readonly<{
      id: string;
      location: Readonly<{ lat: number; lon: number }>;
      type: EventType;
      severity: number;
      timestamp: number;
    }>;
    response: Readonly<{
      risk_score: number;
      source: string;
      fallback_used: boolean;
      threshold: RiskThreshold;
    }>;
  }>;
}>;

export declare function clampRiskScore(score: number): number;
export declare function calculateRiskScore(event: RiskEvent): number;
export declare function getThreshold(score: number): RiskThreshold;
export declare function isFullEvent(event: unknown): event is RiskEvent;