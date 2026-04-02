// api/safety/events-nearby.js
const { getAllEvents } = require('../../src/services/safety/data-pipeline');
const { filterDistance, filterTime, calculateRisk, sortEvents } = require('../../src/services/safety/filter-rank');

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const { lat, lng, radius = 10 } = req.query;
  if (!lat || !lng) return res.status(400).json({ error: 'Missing lat/lng' });

  const events = await getAllEvents();
  const nearby = filterDistance(events, parseFloat(lat), parseFloat(lng), parseFloat(radius));
  const valid = filterTime(nearby, 24); // Last 24h
  const scored = valid.map(e => calculateRisk(e, parseFloat(lat), parseFloat(lng)));
  const sorted = sortEvents(scored);

  res.json(sorted);
}