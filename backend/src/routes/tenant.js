const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { getProfile, createProfile, updateProfile, getProfileById } = require('../controllers/tenantController');

// GET /api/tenant/profile - my profile
router.get('/profile', authenticate, authorize('tenant'), getProfile);

// POST /api/tenant/profile - create profile
router.post('/profile', authenticate, authorize('tenant'), createProfile);

// PUT /api/tenant/profile - update profile
router.put('/profile', authenticate, authorize('tenant'), updateProfile);

// GET /api/tenant/profile/:userId - view a tenant's profile (owner or admin)
router.get('/profile/:userId', authenticate, authorize('owner', 'admin'), getProfileById);

module.exports = router;
