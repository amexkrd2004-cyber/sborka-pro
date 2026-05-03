const SENSITIVE_KEY = /^(.*)(token|password|secret|authorization|bearer|credential)(.*)$/i;

function redactDeep(value, depth = 0) {
  if (depth > 12) return '[MAX_DEPTH]';
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 2000) return `${value.slice(0, 2000)}… [truncated ${value.length} chars]`;
    return value;
  }
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map((v) => redactDeep(v, depth + 1));

  const out = {};
  for (const [k, v] of Object.entries(value)) {
    if (SENSITIVE_KEY.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = redactDeep(v, depth + 1);
    }
  }
  return out;
}

function summarizeWebhookPayload(body) {
  if (!body || typeof body !== 'object') {
    return { rawType: typeof body };
  }

  const events = body.events;
  if (!Array.isArray(events)) {
    return { keys: Object.keys(body), eventCount: null };
  }

  const auditUid = body.auditContext?.uid;

  return {
    eventCount: events.length,
    auditUid: auditUid || undefined,
    actions: events.map((e) => e?.action ?? '?').slice(0, 15),
    types: events.map((e) => e?.meta?.type ?? '?').slice(0, 15),
  };
}

module.exports = { redactDeep, summarizeWebhookPayload };
