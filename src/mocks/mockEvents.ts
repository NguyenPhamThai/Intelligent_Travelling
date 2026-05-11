import type { Event } from '../types/event';

export const MOCK_EVENTS: Event[] = [
  {
    id: "1",
    location: { lat: 21.0285, lng: 105.8542, lon: 105.8542 },
    type: "riot",
    severity: 0.9,
    timestamp: Date.now()
  },
  {
    id: "2",
    location: { lat: 10.7769, lng: 106.7009, lon: 106.7009 },
    type: "crime",
    severity: 0.6,
    timestamp: Date.now()
  },
  {
    id: "3",
    location: { lat: 16.0544, lng: 108.2022, lon: 108.2022 },
    type: "weather",
    severity: 0.4,
    timestamp: Date.now()
  },
  {
    id: "4",
    location: { lat: 35.6762, lng: 139.6503, lon: 139.6503 },
    type: "weather",
    severity: 0.1,
    timestamp: Date.now()
  },
  {
    id: "5",
    location: { lat: 48.8566, lng: 2.3522, lon: 2.3522 },
    type: "crime",
    severity: 0.5,
    timestamp: Date.now()
  },
  {
    id: "6",
    location: { lat: 34.5553, lng: 69.2075, lon: 69.2075 },
    type: "riot",
    severity: 0.9,
    timestamp: Date.now()
  }
];

export function getMockEventsInRadius(lat: number, lng: number, radius: number): Event[] {
  return MOCK_EVENTS.filter(event => {
    const elng = event.location.lng ?? event.location.lon;
    const distance = Math.sqrt(
      (event.location.lat - lat) ** 2 +
      (elng - lng) ** 2
    );
    return distance <= radius;
  });
}

export function getHighSeverityEvents(threshold = 0.7): Event[] {
  return MOCK_EVENTS.filter(event => event.severity >= threshold);
}