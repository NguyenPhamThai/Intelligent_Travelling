import type { Event } from '../types/event';

export const MOCK_EVENTS: Event[] = [
  {
    id: "1",
    location: { lat: 21.0285, lon: 105.8542 },
    type: "riot",
    severity: 0.9,
    risk_score: 80,
    timestamp: Date.now()
  },
  {
    id: "2",
    location: { lat: 10.7769, lon: 106.7009 },
    type: "crime",
    severity: 0.6,
    risk_score: 55,
    timestamp: Date.now()
  },
  {
    id: "3",
    location: { lat: 16.0544, lon: 108.2022 },
    type: "weather",
    severity: 0.4,
    risk_score: 30,
    timestamp: Date.now()
  }
];

export function getMockEventsInRadius(lat: number, lon: number, radius: number): Event[] {
  return MOCK_EVENTS.filter(event => {
    const distance = Math.sqrt(
      (event.location.lat - lat) ** 2 +
      (event.location.lon - lon) ** 2
    );
    return distance <= radius;
  });
}

export function getHighSeverityEvents(threshold = 0.7): Event[] {
  return MOCK_EVENTS.filter(event => event.severity >= threshold);
}