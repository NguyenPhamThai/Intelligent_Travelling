// api/safety/safety-score.js
const { getAllEvents } = require('../../src/services/safety/data-pipeline');
const { filterDistance, filterTime, calculateRisk } = require('../../src/services/safety/filter-rank');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lat, lng } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'Missing lat/lng' });

  const events = await getAllEvents();
  const nearby = filterDistance(events, parseFloat(lat), parseFloat(lng), 10);
  const valid = filterTime(nearby, 24);
  const scores = valid.map(e => calculateRisk(e, parseFloat(lat), parseFloat(lng)).risk_score);
  const avgScore = scores.length ? scores.reduce((a, b) => a + b) / scores.length : 100;
  const safetyScore = Math.max(0, 100 - avgScore);

  res.json({ safety_score: safetyScore });
}