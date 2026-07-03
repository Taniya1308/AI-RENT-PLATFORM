const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const upload = require('../middleware/upload');
const {
  getListings, getListing, createListing, updateListing,
  deleteListing, markFilled, getMyListings, deletePhoto
} = require('../controllers/listingController');

// Public/tenant: browse listings
router.get('/', (req, res, next) => {
  // Optionally attach user if authenticated (for compatibility scores)
  const jwt = require('jsonwebtoken');
  const { db } = require('../models/database');
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(decoded.userId);
      if (user) req.user = user;
    } catch (_) {}
  }
  next();
}, getListings);

// GET single listing (optional auth for scores)
router.get('/my', authenticate, authorize('owner', 'admin'), getMyListings);

router.get('/:id', (req, res, next) => {
  const jwt = require('jsonwebtoken');
  const { db } = require('../models/database');
  const auth = req.headers.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    try {
      const decoded = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET);
      const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(decoded.userId);
      if (user) req.user = user;
    } catch (_) {}
  }
  next();
}, getListing);

// Owner: create listing with photos
router.post('/', authenticate, authorize('owner'), upload.array('photos', 10), createListing);

// Owner: update listing
router.put('/:id', authenticate, authorize('owner', 'admin'), upload.array('photos', 10), updateListing);

// Owner: mark listing as filled
router.patch('/:id/mark-filled', authenticate, authorize('owner', 'admin'), markFilled);

// Owner: delete a photo
router.delete('/:id/photos/:photoId', authenticate, authorize('owner', 'admin'), deletePhoto);

// Owner/Admin: delete listing
router.delete('/:id', authenticate, authorize('owner', 'admin'), deleteListing);

module.exports = router;
