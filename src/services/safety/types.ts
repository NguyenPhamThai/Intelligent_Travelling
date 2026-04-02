// src/services/safety/types.ts
export interface Event {
  id: string;
  location: { lat: number; lng: number };
  type: "weather" | "crime" | "riot" | "disaster";
  severity: number; // 1-10
  risk_score: number;
  timestamp: number;
}