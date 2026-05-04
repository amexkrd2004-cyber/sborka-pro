'use strict';

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { getPool } = require('../db');
const { requireDb } = require('../middleware/requireDb');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

router.post('/register-token', requireAuth, requireDb, express.json(), async (req, res) => {
  const token = req.body?.expoPushToken;
  if (!token || typeof token !== 'string' || !token.trim()) {
    return res.status(400).json({ error: 'bad_request', message: 'Нужно поле expoPushToken (строка).' });
  }
  const pool = getPool();
  await pool.query(
    `INSERT INTO push_tokens (user_id, expo_push_token, updated_at)
     VALUES ($1::uuid, $2, now())
     ON CONFLICT (user_id) DO UPDATE SET expo_push_token = EXCLUDED.expo_push_token, updated_at = now()`,
    [req.user.id, token.trim()]
  );
  res.json({ ok: true });
});

router.post('/login', requireDb, express.json(), async (req, res) => {
  const secret = process.env.JWT_SECRET;
  if (!secret || String(secret).trim().length < 32) {
    return res.status(503).json({
      error: 'jwt_not_configured',
      message: 'Задайте JWT_SECRET (не короче 32 символов).',
    });
  }

  const login = typeof req.body?.login === 'string' ? req.body.login.trim() : '';
  const password =
    typeof req.body?.password === 'string' ? req.body.password.trim() : '';
  if (!login || !password) {
    return res.status(400).json({ error: 'bad_request', message: 'Нужны поля login и password (строки).' });
  }

  const pool = getPool();
  const { rows } = await pool.query(
    'SELECT id, login, display_name, role, password_hash FROM users WHERE login = $1',
    [login]
  );
  const user = rows[0];
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'invalid_credentials' });
  }

  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';
  const token = jwt.sign(
    { sub: user.id, role: user.role, login: user.login },
    secret,
    { expiresIn }
  );

  res.json({
    token,
    expiresIn,
    user: {
      id: user.id,
      login: user.login,
      displayName: user.display_name,
      role: user.role,
    },
  });
});

module.exports = router;
