const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { getConversations, getMessages, sendMessage } = require('../controllers/chatController');

// GET /api/chat/conversations
router.get('/conversations', authenticate, getConversations);

// GET /api/chat/conversations/:id/messages
router.get('/conversations/:id/messages', authenticate, getMessages);

// POST /api/chat/conversations/:id/messages (REST fallback when WS not available)
router.post('/conversations/:id/messages', authenticate, sendMessage);

module.exports = router;
