// Định nghĩa Event Schema [cite: 30, 31, 38]
export type EventType = "weather" | "crime" | "riot";

export interface Event {
  id: string;
  location: { lat: number; lon: number };
  type: EventType;
  severity: number; // 0.0 - 1.0
  risk_score?: number; // 0 - 100
  timestamp: number;
}

// Công thức và Ngưỡng (Thresholds) [cite: 56, 165, 188]
const TYPE_WEIGHTS: Record<EventType, number> = {
  riot: 1.0,
  crime: 0.8,
  weather: 0.5,
};

export const calculateRiskScore = (event: Event): number => {
  const weight = TYPE_WEIGHTS[event.type] || 0.5;
  // Công thức: severity * weight * 100, giới hạn trong khoảng 0-100 
  const rawScore = event.severity * weight * 100;
  return Math.min(Math.max(rawScore, 0), 100);
};

export const getThreshold = (score: number): 'green' | 'yellow' | 'red' => {
  if (score < 30) return 'green'; // [cite: 189]
  if (score <= 70) return 'yellow'; // [cite: 190]
  return 'red'; // [cite: 191]
};