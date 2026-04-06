'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const router = express.Router();

const VALID_TONES = ['professional', 'friendly', 'formal', 'casual', 'enthusiastic'];
const VALID_CATEGORIES = [
  'restaurant', 'cafe', 'bar', 'salon', 'spa', 'gym', 'clinic',
  'dentist', 'hotel', 'retail', 'automotive', 'legal', 'accounting', 'other',
];

function requireApiKey(req, res, next) {
  const db = req.app.get('db');
  const apiKey = req.headers['x-api-key'] || req.query.api_key;
  if (!apiKey) return res.status(401).json({ error: 'API key required' });
  const biz = db.prepare('SELECT * FROM businesses WHERE api_key = ?').get(apiKey);
  if (!biz) return res.status(401).json({ error: 'Invalid API key' });
  req.business = biz;
  next();
}

// POST /businesses — register a new business
router.post('/', (req, res) => {
  const db = req.app.get('db');
  const { name, category, tone } = req.body;

  if (!name || !category) {
    return res.status(400).json({ error: 'name and category are required' });
  }
  if (!VALID_CATEGORIES.includes(category)) {
    return res.status(400).json({ error: `category must be one of: ${VALID_CATEGORIES.join(', ')}` });
  }
  if (tone && !VALID_TONES.includes(tone)) {
    return res.status(400).json({ error: `tone must be one of: ${VALID_TONES.join(', ')}` });
  }

  const id = uuidv4();
  const apiKey = 'rr_' + crypto.randomBytes(24).toString('hex');
  const now = new Date().toISOString();

  db.prepare(
    'INSERT INTO businesses VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name, category, tone || 'professional', apiKey, 'free', 0, now);

  res.status(201).json({
    business_id: id,
    name,
    category,
    tone: tone || 'professional',
    api_key: apiKey,
    plan: 'free',
    message: 'Business registered. Use the api_key in X-Api-Key header.',
  });
});

// GET /businesses/me — get your business details
router.get('/me', requireApiKey, (req, res) => {
  const { api_key, ...safe } = req.business;
  res.json(safe);
});

// PATCH /businesses/me — update tone/name
router.patch('/me', requireApiKey, (req, res) => {
  const db = req.app.get('db');
  const { name, tone } = req.body;

  if (tone && !VALID_TONES.includes(tone)) {
    return res.status(400).json({ error: `tone must be one of: ${VALID_TONES.join(', ')}` });
  }

  const updates = [];
  const params = [];
  if (name) { updates.push('name = ?'); params.push(name); }
  if (tone) { updates.push('tone = ?'); params.push(tone); }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });

  params.push(req.business.id);
  db.prepare(`UPDATE businesses SET ${updates.join(', ')} WHERE id = ?`).run(...params);

  res.json({ message: 'Updated', name: name || req.business.name, tone: tone || req.business.tone });
});

// GET /businesses/me/stats — usage statistics
router.get('/me/stats', requireApiKey, (req, res) => {
  const db = req.app.get('db');
  const bid = req.business.id;

  const totalReviews = db.prepare('SELECT COUNT(*) as c FROM reviews WHERE business_id = ?').get(bid).c;
  const totalReplies = db.prepare('SELECT COUNT(*) as c FROM replies WHERE business_id = ?').get(bid).c;
  const usedReplies = db.prepare('SELECT COUNT(*) as c FROM replies WHERE business_id = ? AND used = 1').get(bid).c;
  const avgRating = db.prepare('SELECT AVG(rating) as avg FROM reviews WHERE business_id = ?').get(bid).avg;

  const ratingDist = db.prepare(
    'SELECT rating, COUNT(*) as count FROM reviews WHERE business_id = ? GROUP BY rating ORDER BY rating DESC'
  ).all(bid);

  res.json({
    plan: req.business.plan,
    total_reviews: totalReviews,
    total_reply_sets_generated: Math.floor(totalReplies / 3),
    replies_used: usedReplies,
    replies_used_month: req.business.replies_used,
    avg_rating: avgRating ? parseFloat(avgRating.toFixed(2)) : null,
    rating_distribution: ratingDist,
  });
});

module.exports = router;
module.exports.requireApiKey = requireApiKey;
