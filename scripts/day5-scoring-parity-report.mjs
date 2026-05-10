import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { calculateRiskScore } from '../shared/risk-score.js';

const INPUT_PATH = 'src/mocks/sample_events.json';
const OUTPUT_DIR = 'artifacts';
const OUTPUT_PATH = `${OUTPUT_DIR}/day5-scoring-parity-report.json`;

function normalizeEvent(rawEvent) {
  const aiScore = Number.isFinite(Number(rawEvent?.risk_score)) ? Number(rawEvent.risk_score) : 0;
  // Sample fixture does not always include severity, so derive a stable proxy.
  const severity = Number.isFinite(Number(rawEvent?.severity)) ? Number(rawEvent.severity) : aiScore / 100;
  return {
    id: String(rawEvent?.id || 'unknown'),
    type: String(rawEvent?.type || 'weather'),
    severity,
    location: {
      lat: Number(rawEvent?.location?.lat || 0),
      lon: Number(rawEvent?.location?.lon || 0),
    },
    timestamp: Number(rawEvent?.timestamp || Date.now()),
    ai_score: aiScore,
  };
}

function summarizeDeltas(rows) {
  if (rows.length === 0) {
    return { count: 0, average_delta: 0, max_delta: 0, warning_threshold: 0.35, warning_count: 0 };
  }

  const sum = rows.reduce((acc, row) => acc + row.delta, 0);
  const max = rows.reduce((acc, row) => Math.max(acc, row.delta), 0);
  const warningThreshold = 35;
  const warningCount = rows.filter((row) => row.delta > warningThreshold).length;

  return {
    count: rows.length,
    average_delta: Number((sum / rows.length).toFixed(2)),
    max_delta: Number(max.toFixed(2)),
    warning_threshold: warningThreshold,
    warning_count: warningCount,
  };
}

async function main() {
  const raw = await readFile(INPUT_PATH, 'utf8');
  const events = JSON.parse(raw).map(normalizeEvent);

  const rows = events.map((event) => {
    const fallbackScore = Number(calculateRiskScore(event));
    const delta = Math.abs(event.ai_score - fallbackScore);
    return {
      id: event.id,
      type: event.type,
      ai_score: Number(event.ai_score.toFixed(2)),
      rule_based_score: Number(fallbackScore.toFixed(2)),
      delta: Number(delta.toFixed(2)),
    };
  });

  const report = {
    generated_at: new Date().toISOString(),
    input: INPUT_PATH,
    summary: summarizeDeltas(rows),
    rows,
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  await writeFile(OUTPUT_PATH, JSON.stringify(report, null, 2), 'utf8');

  console.log(`Parity report written: ${OUTPUT_PATH}`);
  console.log(`Average delta: ${report.summary.average_delta}`);
  console.log(`Max delta: ${report.summary.max_delta}`);
}

main().catch((error) => {
  console.error('Failed to generate parity report:', error);
  process.exitCode = 1;
});
