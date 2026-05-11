// src/services/safety/types.ts
export interface Event {
  id: string;
  location: { lat: number; lng: number; lon?: number };
  type: "weather" | "crime" | "riot";
  severity: number; // 1-10
  risk_score?: number;
  timestamp: number;
}