'use strict';

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();
const { requireApiKey } = require('./businesses');
const { generateReplies } = require('../services/ai');

const PLAN_LIMITS = { free: 30, starter: 200, pro: Infinity };
const VALID_PLATFORMS = ['google', 'yelp', 'tripadvisor', 'facebook', 'airbnb', 'other'];

// POST /reviews — submit a review and get AI responses
router.post('/', requireApiKey, async (req, res, next) => {
  const db = req.app.get('db');
  const { platform, reviewer_name, rating, review_text } = req.body;
  const biz = req.business;

  if (!platform || !rating || !review_text) {
    return res.status(400).json({ error: 'platform, rating, and review_text are required' });
  }
  if (!VALID_PLATFORMS.includes(platform)) {
    return res.status(400).json({ error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}` });
  }
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'rating must be an integer 1-5' });
  }
  if (review_text.length > 2000) {
    return res.status(400).json({ error: 'review_text must be under 2000 characters' });
  }

  // Check usage limit
  const limit = PLAN_LIMITS[biz.plan] || PLAN_LIMITS.free;
  if (biz.replies_used >= limit) {
    return res.status(429).json({
      error: 'Monthly reply limit reached',
      plan: biz.plan,
      limit,
      upgrade_url: 'https://reviewreplyai.com/pricing',
    });
  }

  try {
    const now = new Date().toISOString();
    const reviewId = uuidv4();

    // Save review
    db.prepare('INSERT INTO reviews VALUES (?, ?, ?, ?, ?, ?, ?)').run(
      reviewId, biz.id, platform, reviewer_name || null, rating, review_text, now
    );

    // Generate AI replies
    const replies = await generateReplies({
      businessName: biz.name,
      category: biz.category,
      tone: biz.tone,
      reviewerName: reviewer_name,
      rating,
      reviewText: review_text,
    });

    // Save replies
    const replyRecords = replies.map((text, i) => {
      const replyId = uuidv4();
      db.prepare('INSERT INTO replies VALUES (?, ?, ?, ?, ?, ?, ?)').run(
        replyId, reviewId, biz.id, i + 1, text, 0, now
      );
      return { id: replyId, variant: i + 1, text };
    });

    // Increment usage counter
    db.prepare('UPDATE businesses SET replies_used = replies_used + 1 WHERE id = ?').run(biz.id);

    res.status(201).json({
      review_id: reviewId,
      platform,
      rating,
      reviewer: reviewer_name || 'Anonymous',
      replies: replyRecords,
      replies_remaining: limit === Infinity ? 'unlimited' : limit - biz.replies_used - 1,
    });
  } catch (err) {
    next(err);
  }
});

// GET /reviews — list reviews for a business
router.get('/', requireApiKey, (req, res) => {
  const db = req.app.get('db');
  const { platform, rating_min, rating_max, limit = 20, offset = 0 } = req.query;

  let query = 'SELECT * FROM reviews WHERE business_id = ?';
  const params = [req.business.id];

  if (platform) { query += ' AND platform = ?'; params.push(platform); }
  if (rating_min) { query += ' AND rating >= ?'; params.push(parseInt(rating_min)); }
  if (rating_max) { query += ' AND rating <= ?'; params.push(parseInt(rating_max)); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const reviews = db.prepare(query).all(...params);
  res.json(reviews);
});

// GET /reviews/:id/replies — get generated replies for a review
router.get('/:id/replies', requireApiKey, (req, res) => {
  const db = req.app.get('db');
  const review = db.prepare('SELECT * FROM reviews WHERE id = ? AND business_id = ?').get(req.params.id, req.business.id);
  if (!review) return res.status(404).json({ error: 'Review not found' });

  const replies = db.prepare('SELECT * FROM replies WHERE review_id = ? ORDER BY variant').all(req.params.id);
  res.json({ review, replies });
});

// POST /reviews/:id/replies/:replyId/use — mark a reply as used (copied)
router.post('/:id/replies/:replyId/use', requireApiKey, (req, res) => {
  const db = req.app.get('db');
  const result = db.prepare(
    'UPDATE replies SET used = 1 WHERE id = ? AND business_id = ?'
  ).run(req.params.replyId, req.business.id);

  if (result.changes === 0) return res.status(404).json({ error: 'Reply not found' });
  res.json({ message: 'Marked as used', reply_id: req.params.replyId });
});

// POST /reviews/bulk — process multiple reviews at once
router.post('/bulk', requireApiKey, async (req, res, next) => {
  const { reviews } = req.body;
  if (!Array.isArray(reviews) || reviews.length === 0) {
    return res.status(400).json({ error: 'reviews array required' });
  }
  if (reviews.length > 10) {
    return res.status(400).json({ error: 'Max 10 reviews per bulk request' });
  }

  const results = [];
  for (const review of reviews) {
    try {
      const replies = await generateReplies({
        businessName: req.business.name,
        category: req.business.category,
        tone: req.business.tone,
        reviewerName: review.reviewer_name,
        rating: review.rating,
        reviewText: review.review_text,
      });
      results.push({ review, replies, status: 'success' });
    } catch (err) {
      results.push({ review, error: err.message, status: 'error' });
    }
  }

  res.json({ processed: results.length, results });
});

module.exports = router;
