'use strict';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

function isExpoPushToken(token) {
  const t = String(token || '').trim();
  return /^ExponentPushToken\[[^\]]+\]$/.test(t) || /^ExpoPushToken\[[^\]]+\]$/.test(t);
}

/**
 * Отправка push-уведомления в Expo.
 * @param {{ to: string, title: string, body: string, data?: object, sound?: string, priority?: string, channelId?: string }[]} messages
 */
async function sendExpoPushBatch(messages) {
  const clean = (messages || [])
    .filter((m) => isExpoPushToken(m.to))
    .map((m) => {
      const channelId = m.channelId || 'default';
      const priority = m.priority || 'high';
      return {
        to: m.to,
        title: m.title,
        body: m.body,
        data: m.data,
        sound: m.sound ?? 'default',
        priority,
        channelId,
      };
    });
  if (clean.length === 0) return { sent: 0, errors: [] };

  const res = await fetch(EXPO_PUSH_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Accept-Encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(clean),
  });

  const text = await res.text();
  let payload = null;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = { raw: text };
  }

  if (!res.ok) {
    const e = new Error(`Expo push HTTP ${res.status}: ${text.slice(0, 300)}`);
    e.code = 'EXPO_PUSH_HTTP';
    e.status = res.status;
    throw e;
  }

  const data = Array.isArray(payload?.data) ? payload.data : [];
  const errorReports = data
    .map((ticket, idx) => {
      if (ticket?.status !== 'error') return null;
      return {
        to: clean[idx]?.to ?? null,
        message: ticket?.message || null,
        details: ticket?.details || null,
      };
    })
    .filter(Boolean);
  return { sent: clean.length, errors: errorReports };
}

module.exports = {
  sendExpoPushBatch,
  isExpoPushToken,
};

