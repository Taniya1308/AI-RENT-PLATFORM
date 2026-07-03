const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { computeCompatibility, batchComputeForTenant } = require('../services/compatibilityService');
const { db } = require('../models/database');

// POST /api/compatibility/score - compute/get score for one listing
router.post('/score', authenticate, authorize('tenant'), async (req, res) => {
  const { listing_id } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required' });

  const listing = db.prepare('SELECT id FROM listings WHERE id = ? AND is_active = 1').get(listing_id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const profile = db.prepare('SELECT id FROM tenant_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) return res.status(400).json({ error: 'You need a tenant profile to compute compatibility' });

  try {
    const result = await computeCompatibility(req.user.id, listing_id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute compatibility score' });
  }
});

// POST /api/compatibility/batch - compute scores for multiple listings at once
router.post('/batch', authenticate, authorize('tenant'), async (req, res) => {
  const { listing_ids } = req.body;
  if (!Array.isArray(listing_ids) || listing_ids.length === 0) {
    return res.status(400).json({ error: 'listing_ids must be a non-empty array' });
  }

  const profile = db.prepare('SELECT id FROM tenant_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) return res.status(400).json({ error: 'You need a tenant profile to compute compatibility' });

  try {
    const results = await batchComputeForTenant(req.user.id, listing_ids);
    res.json({ scores: results });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute compatibility scores' });
  }
});

// GET /api/compatibility/scores - get all cached scores for current tenant
router.get('/scores', authenticate, authorize('tenant'), (req, res) => {
  const scores = db.prepare(`
    SELECT cs.*, l.title, l.city, l.rent
    FROM compatibility_scores cs
    JOIN listings l ON cs.listing_id = l.id
    WHERE cs.tenant_id = ?
    ORDER BY cs.score DESC
  `).all(req.user.id);
  res.json({ scores });
});

module.exports = router;
