const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

// HTTPS is the primary entry point on 3000; plain HTTP listens on 3080.
const PORT = 3080;
const HTTPS_PORT = 3000;

// Self-signed certificate for local HTTPS (see certs/).
const KEY_FILE = path.join(__dirname, 'certs', 'server.key');
const CERT_FILE = path.join(__dirname, 'certs', 'server.crt');

// Every browser replicates the same collections. `removedUsers` holds bare
// username strings; every other collection holds objects with an `id`.
const DB_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'alorica.db');
const COLLECTIONS = [
  'bookings',
  'users',
  'removedUsers',
  'passwordRequests',
  'changeRequests',
  'notifications',
  'buses',
  'audit',
  'sheet',
];

/* =============================================================
 * Database
 * =============================================================
 * SQLite keeps the shared state so several devices can work on the
 * same bookings. Every write bumps a revision counter the clients
 * poll, which is what makes cross-device sync cheap.
 */

fs.mkdirSync(DB_DIR, { recursive: true });
const db = new DatabaseSync(DB_FILE);
db.exec(`
    CREATE TABLE IF NOT EXISTS items (
        collection TEXT NOT NULL,
        id         TEXT NOT NULL,
        data       TEXT NOT NULL,
        PRIMARY KEY (collection, id)
    );
    CREATE TABLE IF NOT EXISTS meta (
        key   TEXT PRIMARY KEY,
        value INTEGER NOT NULL
    );
`);
db.prepare("INSERT INTO meta (key, value) VALUES ('rev', 0) ON CONFLICT(key) DO NOTHING").run();

const upsertStmt = db.prepare(`
    INSERT INTO items (collection, id, data) VALUES (?, ?, ?)
    ON CONFLICT(collection, id) DO UPDATE SET data = excluded.data
`);
const removeStmt = db.prepare('DELETE FROM items WHERE collection = ? AND id = ?');
const clearStmt = db.prepare('DELETE FROM items WHERE collection = ?');
const selectStmt = db.prepare('SELECT data FROM items WHERE collection = ?');

const getRev = () => db.prepare("SELECT value FROM meta WHERE key = 'rev'").get().value;
const bumpRev = () => {
  db.prepare("UPDATE meta SET value = value + 1 WHERE key = 'rev'").run();
  return getRev();
};

// An item is either a bare string (a removed username) or an object.
const itemId = (item) =>
  item && typeof item === 'object'
    ? String(item.id != null ? item.id : item.username)
    : String(item);

const readState = () => {
  const collections = {};
  for (const name of COLLECTIONS) {
    collections[name] = selectStmt.all(name).map((row) => JSON.parse(row.data));
  }
  return { rev: getRev(), collections };
};

const applyOps = (ops) => {
  db.exec('BEGIN');
  try {
    for (const op of ops || []) {
      const name = op && op.collection;
      if (!COLLECTIONS.includes(name)) continue;
      // `replace` rewrites a whole collection (used for the first seed).
      if (op.replace) clearStmt.run(name);
      for (const id of op.remove || []) removeStmt.run(name, String(id));
      for (const item of op.upsert || []) upsertStmt.run(name, itemId(item), JSON.stringify(item));
    }
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
  return bumpRev();
};

/* =============================================================
 * HTTP
 * ============================================================= */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

const sendJSON = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
  });
  res.end(body);
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error('Payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch (err) {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });

// `GET /api/state` returns every collection, `GET /api/rev` only the revision.
const handleApi = async (req, res, urlPath) => {
  if (req.method === 'GET' && urlPath === '/api/state') {
    sendJSON(res, 200, readState());
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/rev') {
    sendJSON(res, 200, { rev: getRev() });
    return true;
  }

  if (req.method === 'POST' && urlPath === '/api/seed') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
      return true;
    }
    // Only the very first client may hand over its local data. The check
    // and the write happen without an await in between, so two devices
    // starting at once cannot both win.
    if (getRev() !== 0) {
      sendJSON(res, 409, { rev: getRev(), seeded: false });
      return true;
    }
    try {
      sendJSON(res, 200, { rev: applyOps(body.ops), seeded: true });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return true;
  }

  if (req.method === 'POST' && urlPath === '/api/ops') {
    let body;
    try {
      body = await readBody(req);
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
      return true;
    }
    try {
      const rev = applyOps(body.ops);
      sendJSON(res, 200, { rev });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return true;
  }

  sendJSON(res, 404, { error: 'Unknown API route' });
  return true;
};

const serveStatic = (req, res, urlPath) => {
  const filePath = path.join(__dirname, urlPath);
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': Buffer.byteLength(data),
      'Cache-Control': 'no-store',
    });
    res.end(data);
  });
};

const handler = (req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') {
    res.writeHead(302, { Location: '/index.html', 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  // The preview tool injects Vite client requests. Serve a no-op module
  // so they don't 404 and abort.
  if (
    urlPath.startsWith('/@vite/') ||
    urlPath.startsWith('/@react-refresh') ||
    urlPath.startsWith('/@id/')
  ) {
    res.writeHead(200, {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-store',
    });
    res.end(
      'export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; }\nexport function injectQuery(url) { return url; }\nexport function updateStyle() {}\nexport function removeStyle() {}\n'
    );
    return;
  }

  if (urlPath.startsWith('/api/')) {
    handleApi(req, res, urlPath).catch(() => sendJSON(res, 500, { error: 'Server error' }));
    return;
  }

  serveStatic(req, res, urlPath);
};

http.createServer(handler).listen(PORT, () => {
  console.log(`HTTP  server running at http://localhost:${PORT}`);
  console.log(`Data  stored in ${DB_FILE} (revision ${getRev()})`);
});

if (fs.existsSync(KEY_FILE) && fs.existsSync(CERT_FILE)) {
  https
    .createServer({ key: fs.readFileSync(KEY_FILE), cert: fs.readFileSync(CERT_FILE) }, handler)
    .listen(HTTPS_PORT, () => {
      console.log(
        `HTTPS server running at https://localhost:${HTTPS_PORT} (self-signed certificate)`
      );
    });
} else {
  console.log(`HTTPS disabled — missing ${KEY_FILE} or ${CERT_FILE}`);
}
