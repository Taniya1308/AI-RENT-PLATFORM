const express = require('express');
const router = express.Router();
const { register, login, getMe, updateProfile, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

// POST /api/auth/register
router.post('/register', register);

// POST /api/auth/login
router.post('/login', login);

// GET /api/auth/me
router.get('/me', authenticate, getMe);

// PUT /api/auth/profile
router.put('/profile', authenticate, updateProfile);

// PUT /api/auth/change-password
router.put('/change-password', authenticate, changePassword);

module.exports = router;
