'use strict';

/**
 * Review Reply AI — AI-powered review response generator for local businesses.
 *
 * Local businesses (restaurants, salons, clinics) get dozens of Google/Yelp
 * reviews but rarely respond — it's time-consuming and hard to stay professional.
 * This API generates 3 personalized, on-brand responses per review in seconds.
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { v4: uuidv4 } = require('uuid');
const Database = require('better-sqlite3');
const reviewRoutes = require('./routes/reviews');
const businessRoutes = require('./routes/businesses');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10kb' }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// ── Database setup ────────────────────────────────────────────────────────────
const db = new Database(process.env.DATABASE_PATH || 'reviewreply.db');

db.exec(`
  CREATE TABLE IF NOT EXISTS businesses (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL,
    tone        TEXT NOT NULL DEFAULT 'professional',
    api_key     TEXT UNIQUE NOT NULL,
    plan        TEXT NOT NULL DEFAULT 'free',
    replies_used INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS reviews (
    id            TEXT PRIMARY KEY,
    business_id   TEXT NOT NULL REFERENCES businesses(id),
    platform      TEXT NOT NULL,
    reviewer_name TEXT,
    rating        INTEGER NOT NULL,
    review_text   TEXT NOT NULL,
    created_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS replies (
    id          TEXT PRIMARY KEY,
    review_id   TEXT NOT NULL REFERENCES reviews(id),
    business_id TEXT NOT NULL,
    variant     INTEGER NOT NULL,
    reply_text  TEXT NOT NULL,
    used        INTEGER NOT NULL DEFAULT 0,
    generated_at TEXT NOT NULL
  );
`);

// Expose db to routes
app.set('db', db);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    service: 'review-reply-ai',
    version: '1.0.0',
    status: 'ok',
    docs: '/api-docs',
  });
});

app.use('/businesses', businessRoutes);
app.use('/reviews', reviewRoutes);

// ── Error handler ─────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`Review Reply AI running on http://localhost:${PORT}`);
});

module.exports = app;
