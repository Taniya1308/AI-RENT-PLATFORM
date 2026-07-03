const { db } = require('../models/database');

// GET /api/tenant/profile
function getProfile(req, res) {
  const profile = db.prepare(`
    SELECT tp.*, u.name, u.email, u.avatar
    FROM tenant_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE tp.user_id = ?
  `).get(req.user.id);

  if (!profile) return res.status(404).json({ error: 'Profile not found. Please create one.' });
  res.json({ profile });
}

// POST /api/tenant/profile - create profile
function createProfile(req, res) {
  const existing = db.prepare('SELECT id FROM tenant_profiles WHERE user_id = ?').get(req.user.id);
  if (existing) return res.status(409).json({ error: 'Profile already exists. Use PUT to update.' });

  const { preferred_location, preferred_city, budget_min, budget_max, move_in_date, about_me, occupation } = req.body;

  if (!preferred_location || !preferred_city || !budget_max || !move_in_date) {
    return res.status(400).json({ error: 'preferred_location, preferred_city, budget_max, and move_in_date are required' });
  }

  if (parseInt(budget_min || 0) > parseInt(budget_max)) {
    return res.status(400).json({ error: 'budget_min cannot be greater than budget_max' });
  }

  const result = db.prepare(`
    INSERT INTO tenant_profiles (user_id, preferred_location, preferred_city, budget_min, budget_max, move_in_date, about_me, occupation)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, preferred_location.trim(), preferred_city.trim(),
    parseInt(budget_min || 0), parseInt(budget_max), move_in_date,
    about_me || null, occupation || null);

  const profile = db.prepare('SELECT * FROM tenant_profiles WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json({ profile });
}

// PUT /api/tenant/profile - update profile
function updateProfile(req, res) {
  const existing = db.prepare('SELECT id FROM tenant_profiles WHERE user_id = ?').get(req.user.id);
  if (!existing) return res.status(404).json({ error: 'Profile not found. Use POST to create one.' });

  const { preferred_location, preferred_city, budget_min, budget_max, move_in_date, about_me, occupation } = req.body;

  if (budget_min !== undefined && budget_max !== undefined) {
    if (parseInt(budget_min) > parseInt(budget_max)) {
      return res.status(400).json({ error: 'budget_min cannot be greater than budget_max' });
    }
  }

  db.prepare(`
    UPDATE tenant_profiles SET
      preferred_location = COALESCE(?, preferred_location),
      preferred_city = COALESCE(?, preferred_city),
      budget_min = COALESCE(?, budget_min),
      budget_max = COALESCE(?, budget_max),
      move_in_date = COALESCE(?, move_in_date),
      about_me = COALESCE(?, about_me),
      occupation = COALESCE(?, occupation),
      updated_at = datetime('now')
    WHERE user_id = ?
  `).run(
    preferred_location || null, preferred_city || null,
    budget_min !== undefined ? parseInt(budget_min) : null,
    budget_max !== undefined ? parseInt(budget_max) : null,
    move_in_date || null, about_me || null, occupation || null,
    req.user.id
  );

  // Invalidate existing compatibility scores since preferences changed
  db.prepare('DELETE FROM compatibility_scores WHERE tenant_id = ?').run(req.user.id);

  const profile = db.prepare('SELECT * FROM tenant_profiles WHERE user_id = ?').get(req.user.id);
  res.json({ profile, message: 'Profile updated. Compatibility scores will be recomputed.' });
}

// GET /api/tenant/profile/:userId - get any tenant profile (admin/owner)
function getProfileById(req, res) {
  const profile = db.prepare(`
    SELECT tp.*, u.name, u.email, u.avatar
    FROM tenant_profiles tp
    JOIN users u ON tp.user_id = u.id
    WHERE tp.user_id = ?
  `).get(req.params.userId);

  if (!profile) return res.status(404).json({ error: 'Tenant profile not found' });
  res.json({ profile });
}

module.exports = { getProfile, createProfile, updateProfile, getProfileById };
