const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, '../../data');
const DB_PATH = path.join(DATA_DIR, 'app.db');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// sql.js is pure-JS SQLite — no native compilation needed
const initSqlJs = require('sql.js');

// We wrap the async init so callers can use db synchronously after initializeDatabase()
let _db = null;

/**
 * Tiny synchronous-style wrapper around sql.js so the rest of the codebase
 * can call db.prepare(...).get/all/run just like better-sqlite3.
 */
class SyncDB {
  constructor(sqlJsDb) {
    this._db = sqlJsDb;
    this._dirty = false; // track whether we need to flush to disk
  }

  /** Persist the in-memory DB to disk (called after every write) */
  _flush() {
    const data = this._db.export();
    fs.writeFileSync(DB_PATH, Buffer.from(data));
  }

  exec(sql) {
    this._db.run(sql);
    this._flush();
  }

  /**
   * Returns a prepared-statement-like object with get / all / run methods.
   * Supports positional (?) parameters.
   */
  prepare(sql) {
    const self = this;
    return {
      /** Return first row as plain object, or undefined */
      get(...params) {
        const flat = params.flat();
        const stmt = self._db.prepare(sql);
        stmt.bind(flat.length ? flat : []);
        const row = stmt.step() ? stmt.getAsObject() : undefined;
        stmt.free();
        return row || undefined;
      },

      /** Return all rows as array of plain objects */
      all(...params) {
        const flat = params.flat();
        const stmt = self._db.prepare(sql);
        stmt.bind(flat.length ? flat : []);
        const rows = [];
        while (stmt.step()) rows.push(stmt.getAsObject());
        stmt.free();
        return rows;
      },

      /** Execute a write statement, return { lastInsertRowid, changes } */
      run(...params) {
        const flat = params.flat();
        const stmt = self._db.prepare(sql);
        stmt.bind(flat.length ? flat : []);
        stmt.step();
        stmt.free();
        const lastInsertRowid = self._db.exec('SELECT last_insert_rowid() as id')[0]?.values[0][0] ?? 0;
        self._flush();
        return { lastInsertRowid, changes: 1 };
      }
    };
  }

  // sql.js doesn't support pragma as a statement in the same way; we exec them directly
  pragma(str) {
    try { this._db.run(`PRAGMA ${str}`); } catch (_) {}
  }
}

async function initializeDatabase() {
  const SQL = await initSqlJs();

  let sqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    sqlJsDb = new SQL.Database(fileBuffer);
  } else {
    sqlJsDb = new SQL.Database();
  }

  _db = new SyncDB(sqlJsDb);
  _db.pragma('foreign_keys = ON');

  _db._db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('tenant','owner','admin')),
      avatar TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      description TEXT,
      location TEXT NOT NULL,
      city TEXT NOT NULL,
      rent INTEGER NOT NULL,
      available_from TEXT NOT NULL,
      room_type TEXT NOT NULL CHECK(room_type IN ('single','double','shared','studio','entire_flat')),
      furnishing TEXT NOT NULL CHECK(furnishing IN ('furnished','semi-furnished','unfurnished')),
      is_filled INTEGER NOT NULL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS listing_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      filename TEXT NOT NULL,
      url TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tenant_profiles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
      preferred_location TEXT NOT NULL,
      preferred_city TEXT NOT NULL,
      budget_min INTEGER NOT NULL DEFAULT 0,
      budget_max INTEGER NOT NULL,
      move_in_date TEXT NOT NULL,
      about_me TEXT,
      occupation TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS compatibility_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES users(id),
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      score INTEGER NOT NULL,
      explanation TEXT NOT NULL,
      computed_by TEXT NOT NULL DEFAULT 'llm',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS interest_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL REFERENCES users(id),
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      owner_id INTEGER NOT NULL REFERENCES users(id),
      status TEXT NOT NULL DEFAULT 'pending',
      message TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(tenant_id, listing_id)
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interest_request_id INTEGER UNIQUE NOT NULL REFERENCES interest_requests(id),
      tenant_id INTEGER NOT NULL REFERENCES users(id),
      owner_id INTEGER NOT NULL REFERENCES users(id),
      listing_id INTEGER NOT NULL REFERENCES listings(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL REFERENCES conversations(id),
      sender_id INTEGER NOT NULL REFERENCES users(id),
      content TEXT NOT NULL,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      sent INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_listings_owner ON listings(owner_id);
    CREATE INDEX IF NOT EXISTS idx_listings_city ON listings(city);
    CREATE INDEX IF NOT EXISTS idx_listings_active ON listings(is_active, is_filled);
    CREATE INDEX IF NOT EXISTS idx_compatibility_tenant ON compatibility_scores(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
  `);

  _db._flush();

  // Seed default admin if not present
  const adminExists = _db.prepare("SELECT id FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!adminExists) {
    const bcrypt = require('bcryptjs');
    const hash = bcrypt.hashSync('admin123', 10);
    _db.prepare(
      "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, 'admin')"
    ).run('Admin', 'admin@rentfinder.com', hash);
    console.log('Default admin seeded: admin@rentfinder.com / admin123');
  }

  console.log('Database initialized successfully');
  return _db;
}

/** Accessor — throws if called before initializeDatabase() resolves */
function getDb() {
  if (!_db) throw new Error('Database not initialized yet. Await initializeDatabase() first.');
  return _db;
}

// Proxy so existing code can do:  const { db } = require('./database')
// and it will always resolve against the live _db instance.
const db = new Proxy({}, {
  get(_, prop) {
    return getDb()[prop];
  }
});

module.exports = { db, initializeDatabase };
