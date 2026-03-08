// functions/api/contact.js
// Cloudflare Pages Function — замена Netlify Function /.netlify/functions/contact
// Доступна по адресу: /api/contact
'use strict';

const RATE_WINDOW_MS = 10 * 60 * 1000; // 10 минут
const RATE_LIMIT = 8;
const ipBucket = new Map();

function json(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

function clean(s, max = 2000) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, max);
}

function getClientIp(request) {
  return (
    request.headers.get('CF-Connecting-IP') ||
    request.headers.get('X-Forwarded-For')?.split(',')[0].trim() ||
    'unknown'
  );
}

function rateLimit(ip) {
  const now = Date.now();
  for (const [k, v] of ipBucket.entries()) {
    if (now - v.ts > RATE_WINDOW_MS) ipBucket.delete(k);
  }
  const item = ipBucket.get(ip);
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

export async function onRequestPost(context) {
  const { request, env } = context;

  const ip = getClientIp(request);
  const rl = rateLimit(ip);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ ok: false, error: 'Too many requests' }), {
      status: 429,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Retry-After': String(rl.retryAfterSec ?? 600),
      },
    });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return json(400, { ok: false, error: 'Invalid JSON' });
  }

  const hp = clean(payload.hp, 200);
  if (hp) return json(200, { ok: true }); // honeypot

  const source = clean(payload.source, 20);

  // Квиз
  if (source === 'quiz') {
    const service        = clean(payload.service, 200);
    const timing         = clean(payload.timing, 200);
    const contact_method = clean(payload.contact_method, 200);
    const name           = clean(payload.name, 120);
    const contact        = clean(payload.contact, 200);

    if (!name || !contact) {
      return json(400, { ok: false, error: 'Missing required fields' });
    }

    const botToken = env.TG_BOT_TOKEN;
    const chatId   = env.TG_CHAT_ID;
    if (!botToken || !chatId) {
      return json(500, { ok: false, error: 'Server is not configured' });
    }

    const text =
      `📋 Новая заявка с квиза\n\n` +
      `👤 Имя: ${name}\n` +
      `📞 Контакт: ${contact}\n` +
      `🛠 Услуга: ${service || '—'}\n` +
      `⏱ Сроки: ${timing || '—'}\n` +
      `💬 Способ связи: ${contact_method || '—'}`;

    return await sendToTelegram(botToken, chatId, text);
  }

  // Обычная форма
  const name    = clean(payload.name, 120);
  const contact = clean(payload.contact, 200);
  const message = clean(payload.message, 3000);

  if (!name || !contact || !message) {
    return json(400, { ok: false, error: 'Missing required fields' });
  }

  const botToken = env.TG_BOT_TOKEN;
  const chatId   = env.TG_CHAT_ID;
  if (!botToken || !chatId) {
    return json(500, { ok: false, error: 'Server is not configured' });
  }

  const normalizeContact = s => {
    const digits = s.replace(/\D/g, '');
    if (/^[\d\s+\-()]{7,}$/.test(s)) {
      if (digits.length === 11 && digits.startsWith('8')) return '+7' + digits.slice(1);
      if (digits.length === 11 && digits.startsWith('7')) return '+' + digits;
      if (digits.length === 10) return '+7' + digits;
    }
    return s;
  };

  const text =
    `📩 Новое сообщение с сайта\n\n` +
    `👤 Имя: ${name}\n` +
    `📞 Контакт: ${normalizeContact(contact)}\n` +
    `💬 Сообщение: ${message}`;

  return await sendToTelegram(botToken, chatId, text);
}

async function sendToTelegram(botToken, chatId, text) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      return json(502, { ok: false, error: 'Telegram sendMessage failed' });
    }
    return json(200, { ok: true });
  } catch {
    return json(502, { ok: false, error: 'Upstream request failed' });
  }
}
