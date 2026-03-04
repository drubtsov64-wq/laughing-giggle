// netlify/functions/contact.js
'use strict';

const TG_API = 'https://api.telegram.org';

// In-memory rate limit (может сбрасываться между инстансами — это нормально для базовой защиты)
const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 минут
const RATE_LIMIT = 8;                  // 8 запросов / 10 минут / IP
const ipBucket = new Map();

function json(statusCode, data) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Если будешь вызывать с другого домена — добавишь CORS точечно.
      // 'Access-Control-Allow-Origin': 'https://your-domain.tld',
    },
    body: JSON.stringify(data),
  };
}

function clean(s, max = 2000) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function getClientIp(headers = {}) {
  const h = Object.fromEntries(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v])
  );

  // Netlify часто кладёт IP сюда
  const nfIp = h['x-nf-client-connection-ip'];
  if (nfIp) return String(nfIp);

  const xff = h['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();

  const clientIp = h['client-ip'];
  if (clientIp) return String(clientIp);

  return 'unknown';
}

function rateLimit(ip) {
  const now = Date.now();
  const item = ipBucket.get(ip);

  // чистим старые записи
  for (const [k, v] of ipBucket.entries()) {
    if (now - v.ts > RATE_WINDOW_MS) ipBucket.delete(k);
  }

  if (!item || now - item.ts > RATE_WINDOW_MS) {
    ipBucket.set(ip, { count: 1, ts: now });
    return { allowed: true };
  }

  item.count += 1;
  ipBucket.set(ip, item);

  if (item.count > RATE_LIMIT) {
    const retryAfterSec = Math.ceil((RATE_WINDOW_MS - (now - item.ts)) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { ok: false, error: 'Method not allowed' });
  }

  const ip = getClientIp(event.headers);
  const rl = rateLimit(ip);
  if (!rl.allowed) {
    return {
      statusCode: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': String(rl.retryAfterSec ?? 600),
      },
      body: JSON.stringify({ ok: false, error: 'Too many requests' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const hp = clean(payload.hp, 200);
  // Honeypot: если бот заполнил — отвечаем "успехом", но ничего не отправляем
  if (hp) return json(200, { ok: true });

  const name = clean(payload.name, 120);
  const contact = clean(payload.contact, 200);
  const message = clean(payload.message, 3000);

  if (!name || !contact || !message) {
    return json(400, { ok: false, error: 'Missing required fields' });
  }

  const botToken = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;

  if (!botToken || !chatId) {
    return json(500, { ok: false, error: 'Server is not configured' });
  }

  const text =
    `📩 Новое сообщение с сайта\n\n` +
    `👤 Имя: ${name}\n` +
    `📞 Контакт: ${contact}\n` +
    `💬 Сообщение: ${message}`;

  try {
    const res = await fetch(`${TG_API}/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        // disable_web_page_preview: true, // можно включить при желании
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return json(502, { ok: false, error: 'Telegram sendMessage failed' });
    }

    return json(200, { ok: true });
  } catch {
    return json(502, { ok: false, error: 'Upstream request failed' });
  }
};
