require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { initializeDatabase } = require('./models/database');
const { setupWebSocket } = require('./services/websocketService');

async function startServer() {
  const app = express();
  const server = http.createServer(app);

  // Middleware
  const allowedOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
    : ['http://localhost:3000'];

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, Render health checks)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }
      callback(new Error(`CORS blocked: ${origin}`));
    },
    credentials: true
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

  // Initialize database FIRST (sql.js requires async init)
  await initializeDatabase();

  // Setup WebSocket
  setupWebSocket(server);

  // Routes (loaded after DB is ready)
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/listings', require('./routes/listings'));
  app.use('/api/tenant', require('./routes/tenant'));
  app.use('/api/compatibility', require('./routes/compatibility'));
  app.use('/api/interests', require('./routes/interests'));
  app.use('/api/chat', require('./routes/chat'));
  app.use('/api/admin', require('./routes/admin'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File too large. Maximum size is 5MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum is 10 photos.' });
    }
    if (err.message && err.message.includes('Only image files')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`WebSocket available at ws://localhost:${PORT}/ws`);
  });

  return { app, server };
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
