// src/services/safety/filter-rank.ts
import { Event } from './types';
import { calculateRiskScore, type RiskEvent } from '../../../shared/risk-score-spec.js';

export function filterDistance(events: Event[], userLat: number, userLng: number, radiusKm: number): Event[] {
  return events.filter(event => {
    const distance = getDistance(userLat, userLng, event.location.lat, event.location.lon);
    return distance <= radiusKm;
  });
}

export function filterTime(events: Event[], maxHours: number): Event[] {
  const now = Date.now();
  return events.filter(event => (now - event.timestamp) / (1000 * 60 * 60) <= maxHours);
}

export function classify(event: Event): Event {
  // Simple rule-based classification (already in type)
  return event;
}

export function calculateRisk(event: Event, userLat: number, userLng: number): Event {
  // Keep signature stable for callers while delegating scoring to the shared source of truth.
  void userLat;
  void userLng;
  event.risk_score = calculateRiskScore(event as unknown as RiskEvent);
  return event;
}

export function sortEvents(events: Event[]): Event[] {
  return events.sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0));
}

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  // Haversine formula (approx km)
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}