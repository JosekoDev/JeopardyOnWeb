const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_DIR = path.join(__dirname, '..', '..', 'data');
const DB_PATH = path.join(DB_DIR, 'jeopardy.sqlite3');

let db = null;

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

async function initDb() {
  if (db) return;
  fs.mkdirSync(DB_DIR, { recursive: true });
  db = new sqlite3.Database(DB_PATH);
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      content_json TEXT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

async function getUserByUsername(username) {
  return get(
    `SELECT id, username, password_hash, password_salt, content_json FROM users WHERE username = ?`,
    [username],
  );
}

async function createUser({ username, passwordHash, passwordSalt, contentJson }) {
  const result = await run(
    `INSERT INTO users (username, password_hash, password_salt, content_json) VALUES (?, ?, ?, ?)`,
    [username, passwordHash, passwordSalt, contentJson],
  );
  return get(`SELECT id, username, content_json FROM users WHERE id = ?`, [result.lastID]);
}

async function getUserById(id) {
  return get(`SELECT id, username, content_json FROM users WHERE id = ?`, [id]);
}

async function setUserContent(userId, contentJson) {
  await run(`UPDATE users SET content_json = ? WHERE id = ?`, [contentJson, userId]);
}

module.exports = {
  initDb,
  getUserByUsername,
  createUser,
  getUserById,
  setUserContent,
};

