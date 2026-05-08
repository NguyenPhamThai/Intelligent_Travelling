// Lightweight in-memory metrics for demo/CI. Not persistent across instances.
const metrics = new Map();

export function incrementMetric(key, amount = 1) {
  const prev = metrics.get(key) || 0;
  metrics.set(key, prev + amount);
}

export function getMetric(key) {
  return metrics.get(key) || 0;
}

export function resetMetrics() {
  metrics.clear();
}

export default { incrementMetric, getMetric, resetMetrics };
