// src/services/safety/risk-score.ts

interface Event {
  id: string;
  location: { lat: number; lng: number };
  type: string;
  severity: number;
  timestamp: string;
}

export function calculateRiskScore(event: Event, userLat: number, userLng: number): number {
  const distance = Math.sqrt((event.location.lat - userLat) ** 2 + (event.location.lng - userLng) ** 2) * 111; // approx km
  const recencyHours = (Date.now() - new Date(event.timestamp).getTime()) / (1000 * 60 * 60);
  const typeWeight = { weather: 1, crime: 2, riot: 3, disaster: 4 }[event.type] || 1;
  return Math.min(100, Math.max(0, (event.severity * 10) + (typeWeight * 10) - (distance * 5) - (recencyHours * 2)));
}

export function clampRiskScore(score: number): number {
  return Math.min(100, Math.max(0, score));
}

export function getRiskLevel(score: number): string {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}

// Example: distance=5km, severity=7, recency=2h, type='riot' -> score ~ 70