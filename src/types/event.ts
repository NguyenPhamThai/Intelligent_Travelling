export type Event = {
  id: string
  location: { lat: number; lng: number }
  type: "weather" | "crime" | "riot"
  severity: number
  severity_level?: string
  risk_score?: number
  title?: string
  description?: string
  radius_km?: number
  source?: 'ai' | 'rule_based'
  fallback_used?: boolean
  threshold?: 'green' | 'yellow' | 'red'
  duration_hours?: number
  timestamp: number
}

export type EventsResponse = {
  events: Event[]
  total: number
  has_next: boolean
  page: number
  page_size: number
  query: {
    lat: number
    lon: number
    radius_km: number
    page?: number
    page_size?: number
    sort?: string
    category?: string
    risk_level?: string
    time_range?: string
  }
  timestamp: number
}