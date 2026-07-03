const { db } = require('../models/database');
const bcrypt = require('bcryptjs');

// GET /api/admin/stats - platform activity overview
function getStats(req, res) {
  const stats = {
    users: db.prepare("SELECT COUNT(*) as count FROM users WHERE is_active = 1").get().count,
    tenants: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'tenant' AND is_active = 1").get().count,
    owners: db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'owner' AND is_active = 1").get().count,
    listings: db.prepare("SELECT COUNT(*) as count FROM listings WHERE is_active = 1").get().count,
    active_listings: db.prepare("SELECT COUNT(*) as count FROM listings WHERE is_active = 1 AND is_filled = 0").get().count,
    filled_listings: db.prepare("SELECT COUNT(*) as count FROM listings WHERE is_filled = 1").get().count,
    interest_requests: db.prepare("SELECT COUNT(*) as count FROM interest_requests").get().count,
    pending_interests: db.prepare("SELECT COUNT(*) as count FROM interest_requests WHERE status = 'pending'").get().count,
    accepted_interests: db.prepare("SELECT COUNT(*) as count FROM interest_requests WHERE status = 'accepted'").get().count,
    conversations: db.prepare("SELECT COUNT(*) as count FROM conversations").get().count,
    messages: db.prepare("SELECT COUNT(*) as count FROM messages").get().count,
    compatibility_scores: db.prepare("SELECT COUNT(*) as count FROM compatibility_scores").get().count,
    llm_scores: db.prepare("SELECT COUNT(*) as count FROM compatibility_scores WHERE computed_by = 'llm'").get().count,
    rule_based_scores: db.prepare("SELECT COUNT(*) as count FROM compatibility_scores WHERE computed_by = 'rule_based'").get().count,
    notifications_sent: db.prepare("SELECT COUNT(*) as count FROM notifications WHERE sent = 1").get().count
  };
  res.json({ stats });
}

// GET /api/admin/users - list all users
function getUsers(req, res) {
  const { role, page = 1, limit = 20, search } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = 'SELECT id, name, email, role, is_active, created_at FROM users WHERE 1=1';
  const params = [];

  if (role) { query += ' AND role = ?'; params.push(role); }
  if (search) { query += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)'; params.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`); }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const users = db.prepare(query).all(...params);

  let countQ = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
  const countP = [];
  if (role) { countQ += ' AND role = ?'; countP.push(role); }
  if (search) { countQ += ' AND (LOWER(name) LIKE ? OR LOWER(email) LIKE ?)'; countP.push(`%${search.toLowerCase()}%`, `%${search.toLowerCase()}%`); }

  const { total } = db.prepare(countQ).get(...countP);
  res.json({ users, total, page: parseInt(page), limit: parseInt(limit) });
}

// GET /api/admin/users/:id
function getUser(req, res) {
  const user = db.prepare('SELECT id, name, email, role, is_active, avatar, created_at FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const profile = db.prepare('SELECT * FROM tenant_profiles WHERE user_id = ?').get(req.params.id);
  const listings = db.prepare('SELECT id, title, city, rent, is_filled, created_at FROM listings WHERE owner_id = ? AND is_active = 1').all(req.params.id);

  res.json({ user, profile: profile || null, listings });
}

// PATCH /api/admin/users/:id/toggle-active - activate/deactivate user
function toggleUserActive(req, res) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.status(400).json({ error: 'Cannot deactivate admin users' });

  const newStatus = user.is_active ? 0 : 1;
  db.prepare("UPDATE users SET is_active = ?, updated_at = datetime('now') WHERE id = ?").run(newStatus, req.params.id);
  res.json({ message: `User ${newStatus ? 'activated' : 'deactivated'}` });
}

// GET /api/admin/listings - all listings
function getListings(req, res) {
  const { page = 1, limit = 20, city, is_filled } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT l.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM interest_requests ir WHERE ir.listing_id = l.id) AS interest_count
    FROM listings l
    JOIN users u ON l.owner_id = u.id
    WHERE l.is_active = 1
  `;
  const params = [];

  if (city) { query += ' AND LOWER(l.city) LIKE ?'; params.push(`%${city.toLowerCase()}%`); }
  if (is_filled !== undefined) { query += ' AND l.is_filled = ?'; params.push(parseInt(is_filled)); }

  query += ' ORDER BY l.created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), offset);

  const listings = db.prepare(query).all(...params);
  const { total } = db.prepare("SELECT COUNT(*) as total FROM listings WHERE is_active = 1").get();

  res.json({ listings, total, page: parseInt(page), limit: parseInt(limit) });
}

// DELETE /api/admin/listings/:id - hard delete
function deleteListing(req, res) {
  const listing = db.prepare('SELECT id FROM listings WHERE id = ?').get(req.params.id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  db.prepare("UPDATE listings SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(req.params.id);
  res.json({ message: 'Listing removed' });
}

// GET /api/admin/notifications - email notification log
function getNotifications(req, res) {
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  const notifications = db.prepare(`
    SELECT n.*, u.name AS user_name, u.email AS user_email
    FROM notifications n
    LEFT JOIN users u ON n.user_id = u.id
    ORDER BY n.created_at DESC
    LIMIT ? OFFSET ?
  `).all(parseInt(limit), offset);

  const { total } = db.prepare('SELECT COUNT(*) as total FROM notifications').get();
  res.json({ notifications, total });
}

// GET /api/admin/interests - all interest requests
function getInterests(req, res) {
  const interests = db.prepare(`
    SELECT ir.*, l.title AS listing_title,
      t.name AS tenant_name, o.name AS owner_name,
      cs.score AS compatibility_score
    FROM interest_requests ir
    JOIN listings l ON ir.listing_id = l.id
    JOIN users t ON ir.tenant_id = t.id
    JOIN users o ON ir.owner_id = o.id
    LEFT JOIN compatibility_scores cs ON cs.tenant_id = ir.tenant_id AND cs.listing_id = ir.listing_id
    ORDER BY ir.created_at DESC
    LIMIT 200
  `).all();
  res.json({ interests });
}

module.exports = { getStats, getUsers, getUser, toggleUserActive, getListings, deleteListing, getNotifications, getInterests };
