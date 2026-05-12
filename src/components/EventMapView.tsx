import { useMemo, useState } from 'preact/hooks';
import { getRiskLevel, RISK_SCORE_THRESHOLDS } from '../../shared/risk-score-spec.js';

interface MapEvent {
  id: string;
  title: string;
  type: string;
  location: { lat: number; lng: number };
  risk_score: number;
  timestamp: number;
}

interface EventMapViewProps {
  events: MapEvent[];
  loading?: boolean;
  error?: string;
  onEventSelect?: (event: MapEvent) => void;
}

const RISK_COLORS = {
  green: { label: 'Safe', hex: '#2ecc71', symbol: '🟢' },
  yellow: { label: 'Caution', hex: '#f1c40f', symbol: '🟡' },
  red: { label: 'Danger', hex: '#e74c3c', symbol: '🔴' },
};

const EventMapLegend = () => {
  return (
    <div style={{
      display: 'flex',
      gap: '16px',
      padding: '12px',
      backgroundColor: '#f8f9fa',
      borderRadius: '4px',
      fontSize: '14px',
      flexWrap: 'wrap',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{RISK_COLORS.green.symbol}</span>
        <span>Safe (&lt; {RISK_SCORE_THRESHOLDS.green})</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{RISK_COLORS.yellow.symbol}</span>
        <span>Caution ({RISK_SCORE_THRESHOLDS.green}-{RISK_SCORE_THRESHOLDS.yellow})</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span>{RISK_COLORS.red.symbol}</span>
        <span>Danger (&gt; {RISK_SCORE_THRESHOLDS.yellow})</span>
      </div>
    </div>
  );
};

const EventMarker = ({ event, onSelect }: { event: MapEvent; onSelect: (event: MapEvent) => void }) => {
  const threshold = getRiskLevel(event.risk_score);
  const color = RISK_COLORS[threshold as keyof typeof RISK_COLORS];

  return (
    <button
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: color.hex,
        color: 'white',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '13px',
        fontWeight: 'bold',
        transition: 'transform 0.2s',
        marginBottom: '8px',
      }}
      type="button"
      onClick={() => onSelect(event)}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.05)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)';
      }}
    >
      {color.symbol}
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 'bold' }}>{event.type.toUpperCase()}</div>
        <div style={{ fontSize: '12px', opacity: 0.9 }}>{event.title}</div>
        <div style={{ fontSize: '11px', opacity: 0.8 }}>
          Score: {event.risk_score} | Lat: {event.location.lat.toFixed(2)}, Lng: {event.location.lng.toFixed(2)}
        </div>
      </div>
    </button>
  );
};

const GridMapView = ({ events }: { events: MapEvent[] }) => {
  // Calculate bounding box
  const lats = events.map(e => e.location.lat);
  const lngs = events.map(e => e.location.lng);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const latRange = maxLat - minLat || 1;
  const lngRange = maxLng - minLng || 1;

  const gridWidth = 60;
  const gridHeight = 20;

  // Create grid with proper type
  const grid: Array<Array<MapEvent | null>> = Array(gridHeight)
    .fill(null)
    .map(() => Array(gridWidth).fill(null));

  events.forEach(event => {
    const x = Math.floor(((event.location.lng - minLng) / lngRange) * (gridWidth - 1));
    const y = Math.floor(((maxLat - event.location.lat) / latRange) * (gridHeight - 1));
    if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight && grid[y] !== undefined) {
      const row = grid[y];
      if (row && !row[x]) {
        row[x] = event;
      }
    }
  });

  return (
    <div style={{
      fontFamily: 'monospace',
      backgroundColor: '#1e1e1e',
      color: '#d4d4d4',
      padding: '12px',
      borderRadius: '4px',
      overflow: 'auto',
      maxHeight: '400px',
      fontSize: '12px',
      lineHeight: '1.2',
    }}>
      {grid.map((row, y) => (
        <div key={y} style={{ display: 'flex', height: '16px' }}>
          {row.map((cell, x) => {
            if (cell && cell !== null) {
              const threshold = getRiskLevel(cell.risk_score);
              const bgColor = RISK_COLORS[threshold as keyof typeof RISK_COLORS]?.hex || '#333';
              return (
                <div
                  key={`${x}-${y}`}
                  style={{
                    width: '10px',
                    height: '16px',
                    backgroundColor: bgColor,
                    margin: '0 1px',
                    title: `${cell.title} (${cell.risk_score})`,
                  }}
                />
              );
            }
            return <div key={`${x}-${y}`} style={{ width: '10px', height: '16px', margin: '0 1px', backgroundColor: '#333' }} />;
          })}
        </div>
      ))}
      <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>
        Lat: [{minLat.toFixed(2)}, {maxLat.toFixed(2)}] | Lon: [{minLng.toFixed(2)}, {maxLng.toFixed(2)}]
      </div>
    </div>
  );
};

export const EventMapView = ({ events, loading, error, onEventSelect }: EventMapViewProps) => {
  const [selectedEvent, setSelectedEvent] = useState<MapEvent | null>(null);

  const handleSelect = (event: MapEvent) => {
    setSelectedEvent(event);
    onEventSelect?.(event);
  };

  const riskStats = useMemo(() => {
    const stats = { green: 0, yellow: 0, red: 0 };
    events.forEach(e => {
      const level = getRiskLevel(e.risk_score);
      stats[level as keyof typeof stats]++;
    });
    return stats;
  }, [events]);

  if (error) {
    return (
      <div style={{ padding: '16px', backgroundColor: '#fee', color: '#c33', borderRadius: '4px' }}>
        <div style={{ fontWeight: 'bold' }}>Error loading map</div>
        <div style={{ fontSize: '13px' }}>{error}</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#666' }}>
        <div>⏳ Loading events...</div>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div style={{ padding: '16px', textAlign: 'center', color: '#999', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
        <div style={{ fontSize: '24px', marginBottom: '8px' }}>🗺️</div>
        <div>No events to display</div>
        <div style={{ fontSize: '12px', marginTop: '8px' }}>Try adjusting filters or search radius</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Stats Bar */}
      <div style={{
        display: 'flex',
        gap: '24px',
        padding: '12px',
        backgroundColor: '#f9f9f9',
        borderRadius: '4px',
        fontSize: '13px',
      }}>
        <div>Total Events: <strong>{events.length}</strong></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {RISK_COLORS.green.symbol} <strong>{riskStats.green}</strong> Safe
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {RISK_COLORS.yellow.symbol} <strong>{riskStats.yellow}</strong> Caution
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {RISK_COLORS.red.symbol} <strong>{riskStats.red}</strong> Danger
        </div>
      </div>

      {/* Legend */}
      <EventMapLegend />

      {/* Grid Map */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Geographic Distribution</div>
        <GridMapView events={events} />
      </div>

      {/* Event List */}
      <div>
        <div style={{ fontSize: '13px', fontWeight: 'bold', marginBottom: '8px' }}>Events (sorted by risk)</div>
        <div style={{ maxHeight: '500px', overflow: 'auto' }}>
          {events.map(event => (
            <EventMarker key={event.id} event={event} onSelect={handleSelect} />
          ))}
        </div>
      </div>

      {/* Selected Event Detail */}
      {selectedEvent && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f0f0f0',
          borderRadius: '4px',
          borderLeft: `4px solid ${RISK_COLORS[getRiskLevel(selectedEvent.risk_score) as keyof typeof RISK_COLORS].hex}`,
        }}>
          <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>📌 {selectedEvent.title}</div>
          <div style={{ fontSize: '12px', display: 'grid', gridTemplateColumns: '150px 1fr', gap: '8px' }}>
            <span>Type:</span>
            <span>{selectedEvent.type}</span>
            <span>Risk Score:</span>
            <span>{selectedEvent.risk_score}</span>
            <span>Threshold:</span>
            <span>{getRiskLevel(selectedEvent.risk_score)}</span>
            <span>Location:</span>
            <span>{selectedEvent.location.lat.toFixed(4)}, {selectedEvent.location.lng.toFixed(4)}</span>
            <span>Time:</span>
            <span>{new Date(selectedEvent.timestamp).toLocaleString()}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventMapView;
