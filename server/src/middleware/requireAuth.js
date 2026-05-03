'use strict';

const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim().length < 32) {
    return res.status(503).json({
      error: 'jwt_not_configured',
      message: 'Задайте JWT_SECRET (не короче 32 символов) в переменных окружения.',
    });
  }

  const h = req.headers.authorization;
  if (!h || typeof h !== 'string' || !h.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Нужен заголовок Authorization: Bearer <token>' });
  }

  const raw = h.slice(7).trim();
  if (!raw) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  try {
    const payload = jwt.verify(raw, secret);
    req.user = {
      id: payload.sub,
      role: payload.role,
      login: payload.login,
    };
    next();
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
}

module.exports = { requireAuth };
