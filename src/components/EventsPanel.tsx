import { useEffect, useState } from 'preact/hooks'

type Event = {
  id: string
  title: string
  type: string
  location: { lat: number; lng: number }
  severity: number
  risk_score: number | null
  timestamp: number
}

export default function EventsPanel() {
  const [events, setEvents] = useState<Event[]>([])

  useEffect(() => {
    fetch('/api/events?lat=21.0285&lon=105.8542&radius=10000')
      .then(res => res.json())
      .then(data => setEvents(data.events || []))
  }, [])

  return (
    <div>
      <h2>Events</h2>
      {events.map(ev => (
        <div key={ev.id} style={{ border: '1px solid #ccc', margin: 8, padding: 8 }}>
          <div><b>{ev.title || ev.id}</b></div>
          <div>Severity: {ev.severity}</div>
          <div>Risk Score: {ev.risk_score ?? 'N/A'}</div>
        </div>
      ))}
    </div>
  )
}
