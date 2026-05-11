/**
 * Quick Integration Guide: Intelligent_Travelling Risk API
 * 
 * This file shows how Frontend and QA teams can use the Events API immediately
 * without waiting for real backend integration.
 */

import type { Event, EventsResponse } from './types/event';
import { MOCK_EVENTS, getMockEventsInRadius, getHighSeverityEvents } from './mocks/mockEvents';

/**
 * === FOR FRONTEND DEVELOPERS ===
 * 
 * 1. FETCH EVENTS NEAR USER LOCATION
 */
export async function fetchEventsNearUser(
  latitude: number,
  longitude: number,
  radiusKm: number = 50,
  options: {
    page?: number
    page_size?: number
    sort?: 'risk_score:desc' | 'risk_score:asc' | 'occurred_at:desc' | 'occurred_at:asc'
  } = {}
): Promise<EventsResponse> {
  try {
    const params = new URLSearchParams({
      lat: latitude.toString(),
      lon: longitude.toString(),
      radius: radiusKm.toString(),
      page: String(options.page ?? 1),
      page_size: String(options.page_size ?? 10),
      sort: options.sort ?? 'risk_score:desc',
    });

    const response = await fetch(`/api/events?${params}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to fetch events');
    }

    return response.json();
  } catch (error) {
    console.error('Error fetching events:', error);
    throw error;
  }
}

/**
 * === FOR TESTING: LOCAL USAGE (No network required) ===
 * 
 * For early-stage component testing, use mock data directly:
 */

// Example 1: Get all mock events
export function getAllMockEventsForTesting(): Event[] {
  return MOCK_EVENTS;
}

// Example 2: Get events in a radius (no API call needed)
export function getEventsInRadiusForTesting(
  latitude: number,
  longitude: number,
  radiusKm: number
): Event[] {
  return getMockEventsInRadius(latitude, longitude, radiusKm);
}

// Example 3: Get only high-severity events for critical alerts testing
export function getCriticalEventsForTesting(minSeverity: number = 7): Event[] {
  return getHighSeverityEvents(minSeverity);
}

/**
 * === USAGE EXAMPLES ===
 */

export const USAGE_EXAMPLES = {
  // Frontend: Fetch events and display on map
  frontendMapExample: `
    import { fetchEventsNearUser } from './api-integration';
    
    async function loadTravelWarnigs(userLat: number, userLon: number) {
      const result = await fetchEventsNearUser(userLat, userLon, 100);
      console.log(\`Found \${result.total} events near your location\`);
      
      // Separate events by severity for color-coding on map
      const criticalEvents = result.events.filter(e => e.severity >= 8);
      const warningEvents = result.events.filter(e => e.severity >= 5 && e.severity < 8);
      const infoEvents = result.events.filter(e => e.severity < 5);
      
      // Render pins on map with color based on severity
      renderMapPins(criticalEvents, 'red');
      renderMapPins(warningEvents, 'orange');
      renderMapPins(infoEvents, 'yellow');
    }
  `,

  // QA: Test with mock data before real backend
  qaTestExample: `
    import { getEventsInRadiusForTesting, getCriticalEventsForTesting } from './api-integration';
    
    // Test nearby events functionality
    const eventsMiami = getEventsInRadiusForTesting(25.7617, -80.1918, 50);
    console.assert(eventsMiami.length > 0, 'Should find Miami hurricane');
    
    // Test critical alert filtering
    const critical = getCriticalEventsForTesting(8);
    console.assert(critical.every(e => e.severity >= 8), 'All critical events should have severity >= 8');
    
    // Test event type diversity
    const allEvents = getAllMockEventsForTesting();
    const types = new Set(allEvents.map(e => e.type));
    console.log('Event types covered:', Array.from(types));
  `,

  // API Response Example (real endpoint)
  apiResponseExample: `
    GET /api/events?lat=25.7617&lon=-80.1918&radius=150
    
    Response:
    {
      "events": [
        {
          "id": "evt-001-hurricane-miami",
          "location": { "lat": 25.7617, "lon": -80.1918 },
          "type": "weather",
          "severity": 9,
          "severity_level": "critical",
          "risk_score": 95,
          "title": "Hurricane Orange - Category 4",
          "description": "Major hurricane approaching Miami...",
          "radius_km": 150,
          "timestamp": 1712534400000,
          "source": "weather-api",
          "duration_hours": 24
        },
        ... // more events
      ],
      "total": 5,
      "query": {
        "lat": 25.7617,
        "lon": -80.1918,
        "radius_km": 150
      },
      "timestamp": 1712534400000
    }
  `,
};

/**
 * === ALERT EXAMPLES (Use in UI) ===
 */

export const ALERT_MESSAGES = {
  // Use for UI toast notifications, banners, etc.
  formatEventAlert: (event: Event): string => {
    return `🚨 ${event.severity >= 8 ? 'CRITICAL' : 'WARNING'}: ${event.title} near ${event.location.lat.toFixed(2)}, ${event.location.lng.toFixed(2)}`;
  },

  getRiskDescription: (riskScore: number): string => {
    if (riskScore >= 80) return 'Extremely High Risk - Reconsider Travel';
    if (riskScore >= 60) return 'High Risk - Exercise Caution';
    if (riskScore >= 40) return 'Moderate Risk - Be Aware';
    return 'Low Risk - Monitor Situation';
  },

  colorCodeBySeverity: (severity: number): string => {
    if (severity >= 9) return '#FF0000'; // Critical: Red
    if (severity >= 7) return '#FF6600'; // High: Orange
    if (severity >= 5) return '#FFCC00'; // Medium: Yellow
    return '#00CC00'; // Low: Green
  },
};

/**
 * === TESTING CHECKLIST ===
 * 
 * ✅ API Endpoint Tests:
 *   - [ ] GET /api/events?lat=25.7617&lon=-80.1918 returns events
 *   - [ ] radius parameter filters correctly (50km default)
 *   - [ ] Missing lat/lon returns 400 error
 *   - [ ] Invalid coordinates return 400 error
 *   - [ ] Response includes all required fields
 *   - [ ] Events sorted by distance (closest first)
 *   - [ ] CORS headers present for browser requests
 * 
 * ✅ Frontend Component Tests:
 *   - [ ] Map render pins for each event with correct color
 *   - [ ] Click event pin shows detailed info popup
 *   - [ ] Severity filter toggles work (show/hide by severity)
 *   - [ ] Event type filter works (weather, crime, riot, etc.)
 *   - [ ] Loading state while fetching events
 *   - [ ] Error handling for failed API calls
 * 
 * ✅ Integration Tests:
 *   - [ ] Real API returns same schema as mock data
 *   - [ ] Frontend gracefully switches from mock to real data
 *   - [ ] No breaking changes when schema evolves
 */
