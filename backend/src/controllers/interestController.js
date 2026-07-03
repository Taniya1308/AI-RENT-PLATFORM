const { db } = require('../models/database');
const { computeCompatibility } = require('../services/compatibilityService');
const {
  notifyOwnerInterest,
  notifyOwnerHighCompatibility,
  notifyTenantAccepted,
  notifyTenantDeclined
} = require('../services/emailService');

const HIGH_SCORE_THRESHOLD = parseInt(process.env.HIGH_SCORE_THRESHOLD || '80');

// POST /api/interests - tenant sends interest request
async function sendInterest(req, res) {
  const { listing_id, message } = req.body;
  if (!listing_id) return res.status(400).json({ error: 'listing_id is required' });

  const listing = db.prepare(`
    SELECT l.*, u.name AS owner_name, u.email AS owner_email
    FROM listings l JOIN users u ON l.owner_id = u.id
    WHERE l.id = ? AND l.is_active = 1 AND l.is_filled = 0
  `).get(listing_id);
  if (!listing) return res.status(404).json({ error: 'Listing not found or already filled' });

  if (listing.owner_id === req.user.id) {
    return res.status(400).json({ error: 'You cannot express interest in your own listing' });
  }

  const existing = db.prepare(
    'SELECT id, status FROM interest_requests WHERE tenant_id = ? AND listing_id = ?'
  ).get(req.user.id, listing_id);
  if (existing) {
    return res.status(409).json({ error: `Interest request already exists with status: ${existing.status}` });
  }

  const profile = db.prepare('SELECT id FROM tenant_profiles WHERE user_id = ?').get(req.user.id);
  if (!profile) {
    return res.status(400).json({ error: 'You need a tenant profile to express interest' });
  }

  const result = db.prepare(`
    INSERT INTO interest_requests (tenant_id, listing_id, owner_id, message)
    VALUES (?, ?, ?, ?)
  `).run(req.user.id, listing_id, listing.owner_id, message || null);

  const interest = db.prepare('SELECT * FROM interest_requests WHERE id = ?').get(result.lastInsertRowid);

  // Compute compatibility score (or get cached)
  let scoreData = null;
  try {
    scoreData = await computeCompatibility(req.user.id, listing_id);
  } catch (err) {
    console.warn('Could not compute score for notification:', err.message);
  }

  // Send email notifications asynchronously (don't block response)
  const tenant = db.prepare('SELECT name, email FROM users WHERE id = ?').get(req.user.id);

  if (scoreData && scoreData.score >= HIGH_SCORE_THRESHOLD) {
    notifyOwnerHighCompatibility({
      ownerEmail: listing.owner_email,
      ownerName: listing.owner_name,
      tenantName: tenant.name,
      listingTitle: listing.title,
      score: scoreData.score,
      explanation: scoreData.explanation,
      interestId: interest.id
    }).catch(console.error);
  } else {
    notifyOwnerInterest({
      ownerEmail: listing.owner_email,
      ownerName: listing.owner_name,
      tenantName: tenant.name,
      listingTitle: listing.title,
      score: scoreData ? scoreData.score : null
    }).catch(console.error);
  }

  res.status(201).json({ interest, score: scoreData });
}

// GET /api/interests - get interests relevant to current user
function getInterests(req, res) {
  let interests;
  if (req.user.role === 'tenant') {
    interests = db.prepare(`
      SELECT ir.*, l.title AS listing_title, l.city, l.rent, l.room_type,
        u.name AS owner_name,
        cs.score AS compatibility_score
      FROM interest_requests ir
      JOIN listings l ON ir.listing_id = l.id
      JOIN users u ON ir.owner_id = u.id
      LEFT JOIN compatibility_scores cs ON cs.tenant_id = ir.tenant_id AND cs.listing_id = ir.listing_id
      WHERE ir.tenant_id = ?
      ORDER BY ir.created_at DESC
    `).all(req.user.id);
  } else if (req.user.role === 'owner') {
    interests = db.prepare(`
      SELECT ir.*, l.title AS listing_title, l.city, l.rent,
        u.name AS tenant_name, u.email AS tenant_email,
        tp.preferred_location, tp.budget_min, tp.budget_max,
        cs.score AS compatibility_score, cs.explanation AS compatibility_explanation
      FROM interest_requests ir
      JOIN listings l ON ir.listing_id = l.id
      JOIN users u ON ir.tenant_id = u.id
      LEFT JOIN tenant_profiles tp ON tp.user_id = ir.tenant_id
      LEFT JOIN compatibility_scores cs ON cs.tenant_id = ir.tenant_id AND cs.listing_id = ir.listing_id
      WHERE ir.owner_id = ?
      ORDER BY COALESCE(cs.score, 0) DESC, ir.created_at DESC
    `).all(req.user.id);
  } else {
    // Admin: all interests
    interests = db.prepare(`
      SELECT ir.*, l.title AS listing_title,
        t.name AS tenant_name, o.name AS owner_name,
        cs.score AS compatibility_score
      FROM interest_requests ir
      JOIN listings l ON ir.listing_id = l.id
      JOIN users t ON ir.tenant_id = t.id
      JOIN users o ON ir.owner_id = o.id
      LEFT JOIN compatibility_scores cs ON cs.tenant_id = ir.tenant_id AND cs.listing_id = ir.listing_id
      ORDER BY ir.created_at DESC
    `).all();
  }

  res.json({ interests });
}

// PATCH /api/interests/:id/accept - owner accepts
async function acceptInterest(req, res) {
  const { id } = req.params;
  const interest = db.prepare(`
    SELECT ir.*, l.title AS listing_title, u.name AS tenant_name, u.email AS tenant_email
    FROM interest_requests ir
    JOIN listings l ON ir.listing_id = l.id
    JOIN users u ON ir.tenant_id = u.id
    WHERE ir.id = ?
  `).get(id);

  if (!interest) return res.status(404).json({ error: 'Interest request not found' });
  if (interest.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  if (interest.status !== 'pending') return res.status(400).json({ error: `Request is already ${interest.status}` });

  db.prepare("UPDATE interest_requests SET status = 'accepted', updated_at = datetime('now') WHERE id = ?").run(id);

  // Create conversation
  const convResult = db.prepare(`
    INSERT INTO conversations (interest_request_id, tenant_id, owner_id, listing_id)
    VALUES (?, ?, ?, ?)
  `).run(id, interest.tenant_id, interest.owner_id, interest.listing_id);

  const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);

  // Notify tenant async
  notifyTenantAccepted({
    tenantEmail: interest.tenant_email,
    tenantName: interest.tenant_name,
    ownerName: owner.name,
    listingTitle: interest.listing_title
  }).catch(console.error);

  res.json({
    message: 'Interest accepted. Chat conversation created.',
    conversation_id: convResult.lastInsertRowid
  });
}

// PATCH /api/interests/:id/decline - owner declines
async function declineInterest(req, res) {
  const { id } = req.params;
  const interest = db.prepare(`
    SELECT ir.*, l.title AS listing_title, u.name AS tenant_name, u.email AS tenant_email
    FROM interest_requests ir
    JOIN listings l ON ir.listing_id = l.id
    JOIN users u ON ir.tenant_id = u.id
    WHERE ir.id = ?
  `).get(id);

  if (!interest) return res.status(404).json({ error: 'Interest request not found' });
  if (interest.owner_id !== req.user.id) return res.status(403).json({ error: 'Not authorized' });
  if (interest.status !== 'pending') return res.status(400).json({ error: `Request is already ${interest.status}` });

  db.prepare("UPDATE interest_requests SET status = 'declined', updated_at = datetime('now') WHERE id = ?").run(id);

  const owner = db.prepare('SELECT name FROM users WHERE id = ?').get(req.user.id);

  notifyTenantDeclined({
    tenantEmail: interest.tenant_email,
    tenantName: interest.tenant_name,
    ownerName: owner.name,
    listingTitle: interest.listing_title
  }).catch(console.error);

  res.json({ message: 'Interest declined.' });
}

module.exports = { sendInterest, getInterests, acceptInterest, declineInterest };
