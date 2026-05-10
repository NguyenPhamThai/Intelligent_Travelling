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
  total: number
  has_next: boolean
  page: number
  page_size: number
  query: {
    sort?: string
  }
}

type EventsQuery = {
  page: number
  pageSize: number
  sort: 'risk_score:desc' | 'risk_score:asc' | 'occurred_at:desc' | 'occurred_at:asc'
  category: 'all' | 'riot' | 'crime' | 'weather'
  riskLevel: 'all' | 'low' | 'medium' | 'high'
  timeRange: 'all' | 'last_1h' | 'last_24h' | 'last_7d'
}

const DEFAULT_QUERY: EventsQuery = {
  page: 1,
  pageSize: 10,
  sort: 'risk_score:desc',
  category: 'all',
  riskLevel: 'all',
  timeRange: 'all',
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
  return (
    Array.isArray(response.events) &&
    response.events.every(isValidEvent) &&
    Number.isFinite(response.total) &&
    typeof response.has_next === 'boolean' &&
    Number.isFinite(response.page) &&
    Number.isFinite(response.page_size)
  )
}

function buildEventsQuery(query: EventsQuery): string {
  const params = new URLSearchParams({
    lat: '21.0285',
    lon: '105.8542',
    radius: '10000',
    page: String(query.page),
    page_size: String(query.pageSize),
    sort: query.sort,
    category: query.category,
    risk_level: query.riskLevel,
    time_range: query.timeRange,
  })
  return params.toString()
}

export async function loadEventsState(
  fetchImpl: typeof fetch = globalThis.fetch,
  query: EventsQuery = DEFAULT_QUERY,
): Promise<{ events: Event[]; uiState: UiState; error: string | null; hasNext: boolean; page: number }> {
  try {
    const res = await fetchImpl(`/api/events?${buildEventsQuery(query)}`)
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
      hasNext: data.has_next,
      page: data.page,
    }
  } catch (err) {
    console.error('[EventsPanel] Failed to load events', err)
    return {
      events: [],
      uiState: UI_STATE_MAP.error,
      error: 'Unable to load events. Please try again.',
      hasNext: false,
      page: query.page,
    }
  }
}

export function EventsPanelView({
  uiState,
  error,
  events,
  page,
  hasNext,
  sort,
  category,
  riskLevel,
  timeRange,
  onSortChange,
  onCategoryChange,
  onRiskLevelChange,
  onTimeRangeChange,
  onPreviousPage,
  onNextPage,
  onRetry,
}: {
  uiState: UiState
  error: string | null
  events: Event[]
  page: number
  hasNext: boolean
  sort: EventsQuery['sort']
  category: EventsQuery['category']
  riskLevel: EventsQuery['riskLevel']
  timeRange: EventsQuery['timeRange']
  onSortChange: (value: EventsQuery['sort']) => void
  onCategoryChange: (value: EventsQuery['category']) => void
  onRiskLevelChange: (value: EventsQuery['riskLevel']) => void
  onTimeRangeChange: (value: EventsQuery['timeRange']) => void
  onPreviousPage: () => void
  onNextPage: () => void
  onRetry: () => void
}) {
  return (
    <div>
      <h2>Events</h2>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <select value={category} onChange={(e) => onCategoryChange((e.currentTarget as HTMLSelectElement).value as EventsQuery['category'])}>
          <option value="all">All categories</option>
          <option value="riot">Riot</option>
          <option value="crime">Crime</option>
          <option value="weather">Weather</option>
        </select>
        <select value={riskLevel} onChange={(e) => onRiskLevelChange((e.currentTarget as HTMLSelectElement).value as EventsQuery['riskLevel'])}>
          <option value="all">All risks</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
        <select value={timeRange} onChange={(e) => onTimeRangeChange((e.currentTarget as HTMLSelectElement).value as EventsQuery['timeRange'])}>
          <option value="all">All time</option>
          <option value="last_1h">Last 1h</option>
          <option value="last_24h">Last 24h</option>
          <option value="last_7d">Last 7d</option>
        </select>
        <select value={sort} onChange={(e) => onSortChange((e.currentTarget as HTMLSelectElement).value as EventsQuery['sort'])}>
          <option value="risk_score:desc">Risk high to low</option>
          <option value="risk_score:asc">Risk low to high</option>
          <option value="occurred_at:desc">Newest first</option>
          <option value="occurred_at:asc">Oldest first</option>
        </select>
      </div>
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
          {ev.fallback_used && <div style={{ color: '#b45309' }}>Fallback Active</div>}
        </div>
      ))}

      {uiState === UI_STATE_MAP.success && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" onClick={onPreviousPage} disabled={page <= 1}>Prev</button>
          <span>Page {page}</span>
          <button type="button" onClick={onNextPage} disabled={!hasNext}>Next</button>
        </div>
      )}
    </div>
  )
}

export default function EventsPanel() {
  const [events, setEvents] = useState<Event[]>([])
  const [uiState, setUiState] = useState<UiState>(UI_STATE_MAP.loading)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState<EventsQuery>(DEFAULT_QUERY)
  const [hasNext, setHasNext] = useState(false)

  const loadEvents = async (nextQuery: EventsQuery) => {
    setUiState(UI_STATE_MAP.loading)
    setError(null)

    const nextState = await loadEventsState(globalThis.fetch, nextQuery)
    setEvents(nextState.events)
    setUiState(nextState.uiState)
    setError(nextState.error)
    setHasNext(nextState.hasNext)
  }

  useEffect(() => {
    void loadEvents(query)
  }, [query])

  const updateFilterAndResetPage = (patch: Partial<EventsQuery>) => {
    setQuery((prev) => ({ ...prev, ...patch, page: 1 }))
  }

  return (
    <EventsPanelView
      uiState={uiState}
      error={error}
      events={events}
      page={query.page}
      hasNext={hasNext}
      sort={query.sort}
      category={query.category}
      riskLevel={query.riskLevel}
      timeRange={query.timeRange}
      onSortChange={(sort) => updateFilterAndResetPage({ sort })}
      onCategoryChange={(category) => updateFilterAndResetPage({ category })}
      onRiskLevelChange={(riskLevel) => updateFilterAndResetPage({ riskLevel })}
      onTimeRangeChange={(timeRange) => updateFilterAndResetPage({ timeRange })}
      onPreviousPage={() => setQuery((prev) => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
      onNextPage={() => setQuery((prev) => ({ ...prev, page: prev.page + 1 }))}
      onRetry={() => void loadEvents(query)}
    />
  )
}
