const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../models/database');

function register(req, res) {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password || !role) {
    return res.status(400).json({ error: 'name, email, password, and role are required' });
  }

  const allowedRoles = ['tenant', 'owner'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Role must be tenant or owner' });
  }

  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const passwordHash = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password_hash, role)
    VALUES (?, ?, ?, ?)
  `).run(name.trim(), email.toLowerCase(), passwordHash, role);

  const user = db.prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?').get(result.lastInsertRowid);
  const token = generateToken(user.id);

  res.status(201).json({ user, token });
}

function login(req, res) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user || !user.is_active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = generateToken(user.id);
  const { password_hash, ...safeUser } = user;

  res.json({ user: safeUser, token });
}

function getMe(req, res) {
  const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
}

function updateProfile(req, res) {
  const { name, avatar } = req.body;
  db.prepare('UPDATE users SET name = ?, avatar = ?, updated_at = datetime("now") WHERE id = ?')
    .run(name || req.user.name, avatar || null, req.user.id);

  const user = db.prepare('SELECT id, name, email, role, avatar, created_at FROM users WHERE id = ?').get(req.user.id);
  res.json({ user });
}

function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  const valid = bcrypt.compareSync(currentPassword, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const newHash = bcrypt.hashSync(newPassword, 10);
  db.prepare('UPDATE users SET password_hash = ?, updated_at = datetime("now") WHERE id = ?').run(newHash, req.user.id);

  res.json({ message: 'Password updated successfully' });
}

function generateToken(userId) {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });
}

module.exports = { register, login, getMe, updateProfile, changePassword };
