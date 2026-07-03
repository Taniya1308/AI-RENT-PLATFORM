const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const {
  getStats, getUsers, getUser, toggleUserActive,
  getListings, deleteListing, getNotifications, getInterests
} = require('../controllers/adminController');

// All routes require admin role
router.use(authenticate, authorize('admin'));

router.get('/stats', getStats);
router.get('/users', getUsers);
router.get('/users/:id', getUser);
router.patch('/users/:id/toggle-active', toggleUserActive);
router.get('/listings', getListings);
router.delete('/listings/:id', deleteListing);
router.get('/interests', getInterests);
router.get('/notifications', getNotifications);

module.exports = router;
