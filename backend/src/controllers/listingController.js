const { db } = require('../models/database');
const path = require('path');
const fs = require('fs');

// GET /api/listings - browse with filters, ranked by compatibility
function getListings(req, res) {
  const { city, min_budget, max_budget, room_type, furnishing, page = 1, limit = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);

  let query = `
    SELECT l.*, u.name AS owner_name,
      (SELECT GROUP_CONCAT(lp.url) FROM listing_photos lp WHERE lp.listing_id = l.id) AS photos
    FROM listings l
    JOIN users u ON l.owner_id = u.id
    WHERE l.is_active = 1 AND l.is_filled = 0
  `;
  const params = [];

  if (city) { query += ` AND LOWER(l.city) LIKE LOWER(?)`; params.push(`%${city}%`); }
  if (min_budget) { query += ` AND l.rent >= ?`; params.push(parseInt(min_budget)); }
  if (max_budget) { query += ` AND l.rent <= ?`; params.push(parseInt(max_budget)); }
  if (room_type) { query += ` AND l.room_type = ?`; params.push(room_type); }
  if (furnishing) { query += ` AND l.furnishing = ?`; params.push(furnishing); }

  // If tenant is logged in, attach their compatibility score and sort by it
  const tenantId = req.user && req.user.role === 'tenant' ? req.user.id : null;

  if (tenantId) {
    query = `
      SELECT l.*, u.name AS owner_name,
        (SELECT GROUP_CONCAT(lp.url) FROM listing_photos lp WHERE lp.listing_id = l.id) AS photos,
        cs.score AS compatibility_score,
        cs.explanation AS compatibility_explanation,
        cs.computed_by
      FROM listings l
      JOIN users u ON l.owner_id = u.id
      LEFT JOIN compatibility_scores cs ON cs.listing_id = l.id AND cs.tenant_id = ?
      WHERE l.is_active = 1 AND l.is_filled = 0
    `;
    params.unshift(tenantId);

    if (city) { query += ` AND LOWER(l.city) LIKE LOWER(?)`; params.push(`%${city}%`); }
    if (min_budget) { query += ` AND l.rent >= ?`; params.push(parseInt(min_budget)); }
    if (max_budget) { query += ` AND l.rent <= ?`; params.push(parseInt(max_budget)); }
    if (room_type) { query += ` AND l.room_type = ?`; params.push(room_type); }
    if (furnishing) { query += ` AND l.furnishing = ?`; params.push(furnishing); }

    query += ` ORDER BY COALESCE(cs.score, 0) DESC, l.created_at DESC`;
  } else {
    query += ` ORDER BY l.created_at DESC`;
  }

  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  const listings = db.prepare(query).all(...params);

  // Parse photos string into array
  const result = listings.map(l => ({
    ...l,
    photos: l.photos ? l.photos.split(',') : []
  }));

  // Total count for pagination
  let countQuery = `SELECT COUNT(*) as total FROM listings l WHERE l.is_active = 1 AND l.is_filled = 0`;
  const countParams = [];
  if (city) { countQuery += ` AND LOWER(l.city) LIKE LOWER(?)`; countParams.push(`%${city}%`); }
  if (min_budget) { countQuery += ` AND l.rent >= ?`; countParams.push(parseInt(min_budget)); }
  if (max_budget) { countQuery += ` AND l.rent <= ?`; countParams.push(parseInt(max_budget)); }
  if (room_type) { countQuery += ` AND l.room_type = ?`; countParams.push(room_type); }
  if (furnishing) { countQuery += ` AND l.furnishing = ?`; countParams.push(furnishing); }

  const { total } = db.prepare(countQuery).get(...countParams);

  res.json({ listings: result, total, page: parseInt(page), limit: parseInt(limit) });
}

// GET /api/listings/:id
function getListing(req, res) {
  const { id } = req.params;
  const tenantId = req.user && req.user.role === 'tenant' ? req.user.id : null;

  let listing;
  if (tenantId) {
    listing = db.prepare(`
      SELECT l.*, u.name AS owner_name, u.email AS owner_email,
        cs.score AS compatibility_score,
        cs.explanation AS compatibility_explanation,
        cs.computed_by
      FROM listings l
      JOIN users u ON l.owner_id = u.id
      LEFT JOIN compatibility_scores cs ON cs.listing_id = l.id AND cs.tenant_id = ?
      WHERE l.id = ? AND l.is_active = 1
    `).get(tenantId, id);
  } else {
    listing = db.prepare(`
      SELECT l.*, u.name AS owner_name, u.email AS owner_email
      FROM listings l
      JOIN users u ON l.owner_id = u.id
      WHERE l.id = ? AND l.is_active = 1
    `).get(id);
  }

  if (!listing) return res.status(404).json({ error: 'Listing not found' });

  const photos = db.prepare('SELECT id, url, filename FROM listing_photos WHERE listing_id = ?').all(id);
  listing.photos = photos;

  // If tenant, also return interest request status
  if (tenantId) {
    const interest = db.prepare(
      'SELECT id, status FROM interest_requests WHERE tenant_id = ? AND listing_id = ?'
    ).get(tenantId, id);
    listing.interest_request = interest || null;
  }

  res.json({ listing });
}

// POST /api/listings - owner creates listing
function createListing(req, res) {
  const { title, description, location, city, rent, available_from, room_type, furnishing } = req.body;

  if (!title || !location || !city || !rent || !available_from || !room_type || !furnishing) {
    return res.status(400).json({ error: 'title, location, city, rent, available_from, room_type, and furnishing are required' });
  }

  const validRoomTypes = ['single', 'double', 'shared', 'studio', 'entire_flat'];
  const validFurnishing = ['furnished', 'semi-furnished', 'unfurnished'];

  if (!validRoomTypes.includes(room_type)) {
    return res.status(400).json({ error: `room_type must be one of: ${validRoomTypes.join(', ')}` });
  }
  if (!validFurnishing.includes(furnishing)) {
    return res.status(400).json({ error: `furnishing must be one of: ${validFurnishing.join(', ')}` });
  }

  const result = db.prepare(`
    INSERT INTO listings (owner_id, title, description, location, city, rent, available_from, room_type, furnishing)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.user.id, title.trim(), description || null, location.trim(), city.trim(), parseInt(rent), available_from, room_type, furnishing);

  // Handle uploaded photos
  if (req.files && req.files.length > 0) {
    const insertPhoto = db.prepare('INSERT INTO listing_photos (listing_id, filename, url) VALUES (?, ?, ?)');
    for (const file of req.files) {
      const url = `/uploads/${file.filename}`;
      insertPhoto.run(result.lastInsertRowid, file.filename, url);
    }
  }

  const listing = db.prepare(`
    SELECT l.*, 
      (SELECT GROUP_CONCAT(lp.url) FROM listing_photos lp WHERE lp.listing_id = l.id) AS photos
    FROM listings l WHERE l.id = ?
  `).get(result.lastInsertRowid);

  listing.photos = listing.photos ? listing.photos.split(',') : [];

  res.status(201).json({ listing });
}

// PUT /api/listings/:id - owner updates listing
function updateListing(req, res) {
  const { id } = req.params;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ? AND is_active = 1').get(id);

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized to update this listing' });
  }

  const { title, description, location, city, rent, available_from, room_type, furnishing } = req.body;

  db.prepare(`
    UPDATE listings SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      location = COALESCE(?, location),
      city = COALESCE(?, city),
      rent = COALESCE(?, rent),
      available_from = COALESCE(?, available_from),
      room_type = COALESCE(?, room_type),
      furnishing = COALESCE(?, furnishing),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(title || null, description || null, location || null, city || null,
    rent ? parseInt(rent) : null, available_from || null, room_type || null,
    furnishing || null, id);

  // Handle new photos
  if (req.files && req.files.length > 0) {
    const insertPhoto = db.prepare('INSERT INTO listing_photos (listing_id, filename, url) VALUES (?, ?, ?)');
    for (const file of req.files) {
      insertPhoto.run(id, file.filename, `/uploads/${file.filename}`);
    }
  }

  const updated = db.prepare('SELECT l.*, (SELECT GROUP_CONCAT(lp.url) FROM listing_photos lp WHERE lp.listing_id = l.id) AS photos FROM listings l WHERE l.id = ?').get(id);
  updated.photos = updated.photos ? updated.photos.split(',') : [];

  res.json({ listing: updated });
}

// DELETE /api/listings/:id/photos/:photoId
function deletePhoto(req, res) {
  const { id, photoId } = req.params;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ?').get(id);
  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const photo = db.prepare('SELECT * FROM listing_photos WHERE id = ? AND listing_id = ?').get(photoId, id);
  if (!photo) return res.status(404).json({ error: 'Photo not found' });

  // Remove file from disk
  const filePath = path.join(__dirname, '../../uploads', photo.filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  db.prepare('DELETE FROM listing_photos WHERE id = ?').run(photoId);
  res.json({ message: 'Photo deleted' });
}

// PATCH /api/listings/:id/mark-filled
function markFilled(req, res) {
  const { id } = req.params;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ? AND is_active = 1').get(id);

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  db.prepare("UPDATE listings SET is_filled = 1, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ message: 'Listing marked as filled' });
}

// DELETE /api/listings/:id - soft delete
function deleteListing(req, res) {
  const { id } = req.params;
  const listing = db.prepare('SELECT * FROM listings WHERE id = ? AND is_active = 1').get(id);

  if (!listing) return res.status(404).json({ error: 'Listing not found' });
  if (listing.owner_id !== req.user.id && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Not authorized' });
  }

  db.prepare("UPDATE listings SET is_active = 0, updated_at = datetime('now') WHERE id = ?").run(id);
  res.json({ message: 'Listing deleted' });
}

// GET /api/listings/my - owner's own listings
function getMyListings(req, res) {
  const listings = db.prepare(`
    SELECT l.*,
      (SELECT GROUP_CONCAT(lp.url) FROM listing_photos lp WHERE lp.listing_id = l.id) AS photos,
      (SELECT COUNT(*) FROM interest_requests ir WHERE ir.listing_id = l.id AND ir.status = 'pending') AS pending_interests,
      (SELECT COUNT(*) FROM interest_requests ir WHERE ir.listing_id = l.id) AS total_interests
    FROM listings l
    WHERE l.owner_id = ? AND l.is_active = 1
    ORDER BY l.created_at DESC
  `).all(req.user.id);

  const result = listings.map(l => ({
    ...l,
    photos: l.photos ? l.photos.split(',') : []
  }));

  res.json({ listings: result });
}

module.exports = { getListings, getListing, createListing, updateListing, deleteListing, markFilled, getMyListings, deletePhoto };
