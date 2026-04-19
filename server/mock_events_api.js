import { createServer } from 'node:http';
import { readFileSync, existsSync, createReadStream } from 'node:fs';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

const DATA_PATH = resolve(__dirname, '../src/mocks/sample_events.json');
const AI_PATH = resolve(__dirname, '../ai');
const DEMO_PATH = resolve(__dirname, '../demo/filter_ui');

let EVENTS = [];
try {
  EVENTS = JSON.parse(readFileSync(DATA_PATH, 'utf8')) || [];
} catch (error) {
  console.error('Failed to load sample events:', error.message);
  EVENTS = [];
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(text);
}

function parseTypes(typeValue) {
  if (!typeValue) return null;
  return String(typeValue)
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseRisk(value) {
  if (value === undefined || value === null || value === '') {
    return { value: null, invalid: false };
  }

  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0 || numeric > 100) {
    return { value: null, invalid: true };
  }

  return { value: Math.floor(numeric), invalid: false };
}

function serveStaticFile(res, filePath) {
  if (!existsSync(filePath)) {
    sendText(res, 404, 'Not found');
    return;
  }

  const contentTypeMap = {
    '.html': 'text/html; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };

  const contentType = contentTypeMap[extname(filePath)] || 'application/octet-stream';
  res.writeHead(200, {
    'Content-Type': contentType,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer((req, res) => {
  if (!req.url) {
    sendText(res, 400, 'Bad request');
    return;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname;

  if (pathname === '/events') {
    const types = parseTypes(url.searchParams.get('type'));
    const minRisk = parseRisk(url.searchParams.get('min_risk'));
    const maxRisk = parseRisk(url.searchParams.get('max_risk'));

    if (minRisk.invalid || maxRisk.invalid) {
      sendJson(res, 400, { error: 'min_risk and max_risk must be numbers between 0 and 100' });
      return;
    }

    if (minRisk.value !== null && maxRisk.value !== null && minRisk.value > maxRisk.value) {
      sendJson(res, 400, { error: 'min_risk cannot be greater than max_risk' });
      return;
    }

    let filtered = EVENTS.slice();
    if (types && types.length > 0) {
      filtered = filtered.filter((event) => types.includes(event.type));
    }
    if (minRisk.value !== null) {
      filtered = filtered.filter((event) => typeof event.risk_score === 'number' && event.risk_score >= minRisk.value);
    }
    if (maxRisk.value !== null) {
      filtered = filtered.filter((event) => typeof event.risk_score === 'number' && event.risk_score <= maxRisk.value);
    }

    sendJson(res, 200, filtered);
    return;
  }

  if (pathname === '/ai/risk_color_mapping.json') {
    serveStaticFile(res, resolve(AI_PATH, 'risk_color_mapping.json'));
    return;
  }

  if (pathname === '/ai/event_color_labels.json') {
    serveStaticFile(res, resolve(AI_PATH, 'event_color_labels.json'));
    return;
  }

  if (pathname === '/ai/edge_cases.json') {
    serveStaticFile(res, resolve(AI_PATH, 'edge_cases.json'));
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    serveStaticFile(res, resolve(DEMO_PATH, 'index.html'));
    return;
  }

  sendText(res, 404, 'Not found');
});

const PORT = Number(process.env.PORT || 3000);
server.listen(PORT, () => {
  console.log(`Mock Events API listening on http://localhost:${PORT}`);
});
