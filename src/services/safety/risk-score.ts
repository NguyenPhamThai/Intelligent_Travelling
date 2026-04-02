// src/services/safety/risk-score.ts

export function calculateRiskScore(distance: number, severity: number, recencyHours: number, type: string): number {
  const typeWeight = { weather: 1, crime: 2, riot: 3, disaster: 4 }[type] || 1;
  return Math.min(100, Math.max(0, (severity * 10) + (typeWeight * 10) - (distance * 5) - (recencyHours * 2)));
}

// Example: distance=5km, severity=7, recency=2h, type='riot' -> score ~ 70