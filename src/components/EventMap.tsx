import { UI_STATE_MAP, getThreshold } from '../../shared/risk-score-spec.js';

export const UIStateMap = UI_STATE_MAP;

export const EventMarker = ({ event }: { event: any }) => {
  const threshold = getThreshold(Number(event?.risk_score ?? 0));
  const color = threshold === 'green' ? 'green' : threshold === 'yellow' ? 'orange' : 'red';

  return (
    <div style={{ color }}>
      📍 {event.type.toUpperCase()} ({event.risk_score})
    </div>
  );
};