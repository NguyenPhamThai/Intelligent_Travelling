import { useEffect, useState } from 'preact/hooks'
import { UI_STATE_MAP } from '../../shared/risk-score-spec.js'

export type Event = {
  id: string
  title: string
  type: string
  location: { lat: number; lon: number }
  severity: number
  risk_score: number
  threshold: 'green' | 'yellow' | 'red'
  timestamp: number
}

type EventsResponse = {
  events: Event[]
}

export type UiState = (typeof UI_STATE_MAP)[keyof typeof UI_STATE_MAP]

const THRESHOLD_COLOR: Record<Event['threshold'], string> = {
  green: '#16a34a',
  yellow: '#ca8a04',
  red: '#dc2626',
}

function isValidEvent(value: unknown): value is Event {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<Event>
  const location = event.location as Event['location'] | undefined
  return (
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.severity === 'number' &&
    Number.isFinite(event.risk_score) &&
    typeof event.timestamp === 'number' &&
    typeof location === 'object' &&
    typeof location?.lat === 'number' &&
    typeof location?.lon === 'number' &&
    (event.threshold === 'green' || event.threshold === 'yellow' || event.threshold === 'red')
  )
}

function isValidEventsResponse(value: unknown): value is EventsResponse {
  if (!value || typeof value !== 'object') return false
  const response = value as Partial<EventsResponse>
  return Array.isArray(response.events) && response.events.every(isValidEvent)
}

export async function loadEventsState(
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<{ events: Event[]; uiState: UiState; error: string | null }> {
  try {
    const res = await fetchImpl('/api/events?lat=21.0285&lon=105.8542&radius=10000')
    if (!res.ok) {
      throw new Error('Failed to fetch events')
    }

    const data: unknown = await res.json()
    if (!isValidEventsResponse(data)) {
      throw new Error('Invalid events payload')
    }

    return {
      events: data.events,
      uiState: UI_STATE_MAP.success,
      error: null,
    }
  } catch (err) {
    console.error('[EventsPanel] Failed to load events', err)
    return {
      events: [],
      uiState: UI_STATE_MAP.error,
      error: 'Unable to load events. Please try again.',
    }
  }
}

export function EventsPanelView({
  uiState,
  error,
  events,
  onRetry,
}: {
  uiState: UiState
  error: string | null
  events: Event[]
  onRetry: () => void
}) {
  return (
    <div>
      <h2>Events</h2>
      {uiState === UI_STATE_MAP.loading && <div>Loading events...</div>}

      {uiState === UI_STATE_MAP.error && (
        <div>
          <div>{error ?? 'Something went wrong.'}</div>
          <button type="button" onClick={onRetry}>
            Retry
          </button>
        </div>
      )}

      {uiState === UI_STATE_MAP.success && events.length === 0 && <div>No events found.</div>}

      {uiState === UI_STATE_MAP.success && events.map(ev => (
        <div key={ev.id} style={{ border: '1px solid #ccc', margin: 8, padding: 8 }}>
          <div><b>{ev.title || ev.id}</b></div>
          <div>Severity: {ev.severity}</div>
          <div style={{ color: THRESHOLD_COLOR[ev.threshold] }}>
            Risk Score: {ev.risk_score} ({ev.threshold.toUpperCase()})
          </div>
        </div>
      ))}
    </div>
  )
}

export default function EventsPanel() {
  const [events, setEvents] = useState<Event[]>([])
  const [uiState, setUiState] = useState<UiState>(UI_STATE_MAP.loading)
  const [error, setError] = useState<string | null>(null)

  const loadEvents = async () => {
    setUiState(UI_STATE_MAP.loading)
    setError(null)

    const nextState = await loadEventsState()
    setEvents(nextState.events)
    setUiState(nextState.uiState)
    setError(nextState.error)
  }

  useEffect(() => {
    void loadEvents()
  }, [])

  return (
    <EventsPanelView
      uiState={uiState}
      error={error}
      events={events}
      onRetry={() => void loadEvents()}
    />
  )
}
