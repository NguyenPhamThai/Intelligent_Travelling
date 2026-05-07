export async function readJsonFromUpstash(key, timeoutMs = 3_000) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const resp = await fetch(`${url}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!resp.ok) return null;

  const data = await resp.json();
  if (!data.result) return null;

  try {
    return JSON.parse(data.result);
  } catch {
    return null;
  }
}

export async function writeJsonToUpstash(key, value, ttlSeconds = 300, timeoutMs = 5_000) {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;

  const commands = [
    ['SET', key, JSON.stringify(value), 'EX', String(Math.max(1, Math.floor(ttlSeconds)))]
  ];

  const resp = await fetch(`${url}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!resp.ok) {
    throw new Error(`Upstash pipeline write HTTP ${resp.status}`);
  }

  const data = await resp.json();
  return data;
}
