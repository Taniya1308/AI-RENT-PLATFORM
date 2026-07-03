const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const { sendInterest, getInterests, acceptInterest, declineInterest } = require('../controllers/interestController');

// POST /api/interests - tenant sends interest
router.post('/', authenticate, authorize('tenant'), sendInterest);

// GET /api/interests - get my interests (tenant sees own, owner sees received)
router.get('/', authenticate, getInterests);

// PATCH /api/interests/:id/accept - owner accepts
router.patch('/:id/accept', authenticate, authorize('owner'), acceptInterest);

// PATCH /api/interests/:id/decline - owner declines
router.patch('/:id/decline', authenticate, authorize('owner'), declineInterest);

module.exports = router;
