const WebSocket = require('ws');
const jwt = require('jsonwebtoken');
const { db } = require('../models/database');

// Map: userId -> Set of WebSocket connections
const clients = new Map();

function setupWebSocket(server) {
  const wss = new WebSocket.Server({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    // Authenticate via ?token= query param
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(1008, 'Authentication required');
      return;
    }

    let user;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      user = db.prepare('SELECT id, name, role FROM users WHERE id = ? AND is_active = 1').get(decoded.userId);
    } catch {
      ws.close(1008, 'Invalid token');
      return;
    }

    if (!user) {
      ws.close(1008, 'User not found');
      return;
    }

    ws.userId = user.id;
    ws.userName = user.name;
    ws.userRole = user.role;
    ws.isAlive = true;

    // Register client
    if (!clients.has(user.id)) clients.set(user.id, new Set());
    clients.get(user.id).add(ws);

    console.log(`WebSocket connected: user ${user.id} (${user.name})`);

    // Send connection confirmation
    ws.send(JSON.stringify({ type: 'connected', userId: user.id, userName: user.name }));

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (raw) => {
      try {
        const data = JSON.parse(raw.toString());
        handleMessage(ws, user, data);
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
      }
    });

    ws.on('close', () => {
      const userClients = clients.get(user.id);
      if (userClients) {
        userClients.delete(ws);
        if (userClients.size === 0) clients.delete(user.id);
      }
      console.log(`WebSocket disconnected: user ${user.id}`);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for user ${user.id}:`, err.message);
    });
  });

  // Heartbeat: ping all clients every 30s to detect stale connections
  const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on('close', () => clearInterval(heartbeatInterval));

  console.log('WebSocket server initialized at /ws');
  return wss;
}

function handleMessage(ws, user, data) {
  const { type } = data;

  if (type === 'send_message') {
    const { conversation_id, content } = data;

    if (!conversation_id || !content || !content.trim()) {
      ws.send(JSON.stringify({ type: 'error', message: 'conversation_id and content are required' }));
      return;
    }

    // Verify user has access to this conversation
    const conversation = db.prepare(
      'SELECT * FROM conversations WHERE id = ? AND (tenant_id = ? OR owner_id = ?)'
    ).get(conversation_id, user.id, user.id);

    if (!conversation) {
      ws.send(JSON.stringify({ type: 'error', message: 'Conversation not found or not accessible' }));
      return;
    }

    // Persist message to DB
    const result = db.prepare(
      'INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)'
    ).run(conversation_id, user.id, content.trim());

    const message = db.prepare(`
      SELECT m.*, u.name AS sender_name, u.role AS sender_role
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(result.lastInsertRowid);

    const payload = JSON.stringify({ type: 'new_message', message });

    // Determine recipient
    const recipientId = conversation.tenant_id === user.id
      ? conversation.owner_id
      : conversation.tenant_id;

    // Send to all connections of sender (echo) and recipient
    sendToUser(user.id, payload);
    sendToUser(recipientId, payload);

  } else if (type === 'mark_read') {
    const { conversation_id } = data;
    if (conversation_id) {
      db.prepare(
        'UPDATE messages SET is_read = 1 WHERE conversation_id = ? AND sender_id != ? AND is_read = 0'
      ).run(conversation_id, user.id);
      ws.send(JSON.stringify({ type: 'marked_read', conversation_id }));
    }

  } else if (type === 'ping') {
    ws.send(JSON.stringify({ type: 'pong' }));
  } else {
    ws.send(JSON.stringify({ type: 'error', message: `Unknown message type: ${type}` }));
  }
}

function sendToUser(userId, payload) {
  const userClients = clients.get(userId);
  if (userClients) {
    for (const client of userClients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }
}

// Push a notification to a user (called from other parts of the app)
function pushNotification(userId, notification) {
  sendToUser(userId, JSON.stringify({ type: 'notification', ...notification }));
}

module.exports = { setupWebSocket, pushNotification };
