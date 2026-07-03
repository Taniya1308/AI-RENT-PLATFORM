const { db } = require('../models/database');

// GET /api/chat/conversations - get all conversations for current user
function getConversations(req, res) {
  const userId = req.user.id;
  const conversations = db.prepare(`
    SELECT c.*,
      l.title AS listing_title, l.city, l.rent,
      t.name AS tenant_name, t.email AS tenant_email,
      o.name AS owner_name, o.email AS owner_email,
      (
        SELECT m.content FROM messages m WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message,
      (
        SELECT m.created_at FROM messages m WHERE m.conversation_id = c.id
        ORDER BY m.created_at DESC LIMIT 1
      ) AS last_message_at,
      (
        SELECT COUNT(*) FROM messages m
        WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.is_read = 0
      ) AS unread_count
    FROM conversations c
    JOIN listings l ON c.listing_id = l.id
    JOIN users t ON c.tenant_id = t.id
    JOIN users o ON c.owner_id = o.id
    WHERE c.tenant_id = ? OR c.owner_id = ?
    ORDER BY COALESCE(last_message_at, c.created_at) DESC
  `).all(userId, userId, userId);

  res.json({ conversations });
}

// GET /api/chat/conversations/:id/messages - get messages in a conversation
function getMessages(req, res) {
  const { id } = req.params;
  const { page = 1, limit = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(limit);
  const userId = req.user.id;

  const conversation = db.prepare(
    'SELECT * FROM conversations WHERE id = ? AND (tenant_id = ? OR owner_id = ?)'
  ).get(id, userId, userId);

  if (!conversation) return res.status(404).json({ error: 'Conversation not found or not accessible' });

  const messages = db.prepare(`
    SELECT m.*, u.name AS sender_name, u.role AS sender_role
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at DESC
    LIMIT ? OFFSET ?
  `).all(id, parseInt(limit), offset);

  // Mark messages from other user as read
  db.prepare(`
    UPDATE messages SET is_read = 1
    WHERE conversation_id = ? AND sender_id != ? AND is_read = 0
  `).run(id, userId);

  const total = db.prepare('SELECT COUNT(*) as count FROM messages WHERE conversation_id = ?').get(id);

  res.json({
    conversation,
    messages: messages.reverse(), // Chronological order
    total: total.count,
    page: parseInt(page),
    limit: parseInt(limit)
  });
}

// POST /api/chat/conversations/:id/messages - send a message (REST fallback)
function sendMessage(req, res) {
  const { id } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty' });
  }

  const conversation = db.prepare(
    'SELECT * FROM conversations WHERE id = ? AND (tenant_id = ? OR owner_id = ?)'
  ).get(id, userId, userId);

  if (!conversation) return res.status(404).json({ error: 'Conversation not found or not accessible' });

  const result = db.prepare(`
    INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)
  `).run(id, userId, content.trim());

  const message = db.prepare(`
    SELECT m.*, u.name AS sender_name, u.role AS sender_role
    FROM messages m JOIN users u ON m.sender_id = u.id
    WHERE m.id = ?
  `).get(result.lastInsertRowid);

  res.status(201).json({ message });
}

module.exports = { getConversations, getMessages, sendMessage };
