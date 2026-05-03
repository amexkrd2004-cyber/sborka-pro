'use strict';

const { isDbEnabled, getPool } = require('../db');

function requireDb(req, res, next) {
  if (!isDbEnabled() || !getPool()) {
    return res.status(503).json({ error: 'database_unavailable', message: 'Задайте DATABASE_URL и перезапустите сервис.' });
  }
  next();
}

module.exports = { requireDb };
