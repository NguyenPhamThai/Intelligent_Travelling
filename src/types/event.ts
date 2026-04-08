export type Event = {
  id: string
  location: { lat: number; lon: number }
  type: "weather" | "crime" | "riot"
  severity: number
  severity_level?: string
  risk_score?: number
  title?: string
  description?: string
  radius_km?: number
  source?: string
  duration_hours?: number
  timestamp: number
}

export type EventsResponse = {
  events: Event[]
  total: number
  query: {
    lat: number
    lon: number
    radius_km: number
  }
  timestamp: number
}