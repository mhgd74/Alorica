const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');
const {
  issueToken,
  verifyPassword,
  sanitizeUser,
  sanitizeUsers,
  claimsFromRequest,
  authorizeOps,
  resolveAccount,
} = require('./lib/auth');

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
  'vacations',
  'vacationBalances',
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
  // Password material never leaves the server; login compares it here.
  collections.users = sanitizeUsers(collections.users);
  return { rev: getRev(), collections };
};

/** The login endpoint is the only place that may see the stored hashes. */
const readAccounts = () => ({
  users: selectStmt.all('users').map((row) => JSON.parse(row.data)),
  removedUsers: selectStmt.all('removedUsers').map((row) => JSON.parse(row.data)),
});

/**
 * The browser no longer holds password hashes, so a record it sends back can
 * legitimately be missing them. Copying the stored values over stops a name or
 * role change from silently wiping somebody's password.
 */
const preserveUserSecrets = (ops) => {
  const touchesUsers = (ops || []).some(
    (op) => op && op.collection === 'users' && (op.upsert || []).length
  );
  if (!touchesUsers) return ops;

  const stored = new Map(
    selectStmt.all('users').map((row) => {
      const value = JSON.parse(row.data);
      return [itemId(value), value];
    })
  );

  return ops.map((op) => {
    if (!op || op.collection !== 'users' || !(op.upsert || []).length) return op;
    return {
      ...op,
      upsert: op.upsert.map((item) => {
        const previous = stored.get(itemId(item));
        if (!previous || item.passwordHash) return item;
        return { ...item, passwordHash: previous.passwordHash, passwordSalt: previous.passwordSalt };
      }),
    };
  });
};

const applyOps = (ops, seed = false) => {
  const prepared = seed ? ops : preserveUserSecrets(ops);
  db.exec('BEGIN');
  try {
    for (const op of prepared || []) {
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

// Every route below mirrors the Vercel functions: a signed token is required
// for anything that reads or writes shared state, and the write policy decides
// which collections a role may touch.
const handleApi = async (req, res, urlPath) => {
  const readJsonBody = async () => {
    try {
      return await readBody(req);
    } catch (err) {
      sendJSON(res, 400, { error: err.message });
      return null;
    }
  };

  if (req.method === 'POST' && urlPath === '/api/login') {
    const body = await readJsonBody();
    if (!body) return true;

    const username = typeof body.username === 'string' ? body.username.trim() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    if (!username || !password) {
      sendJSON(res, 400, { error: 'Username and password are required' });
      return true;
    }

    const { users, removedUsers } = readAccounts();
    const account = resolveAccount(username, users, removedUsers);

    // Same answer for "no such account" and "wrong password".
    if (!account || !verifyPassword(password, account)) {
      sendJSON(res, 401, { error: 'Invalid username or password' });
      return true;
    }

    if (
      account.mustChangePassword &&
      account.tempPasswordExpiresAt &&
      account.tempPasswordExpiresAt < Date.now()
    ) {
      sendJSON(res, 403, { error: 'This temporary password has expired. Please request a new one.' });
      return true;
    }

    const role = account.role || (account.username === 'admin' ? 'admin' : 'user');
    sendJSON(res, 200, {
      token: issueToken({ username: account.username, role }, Boolean(body.remember)),
      user: sanitizeUser(account),
      // Tells the browser this account still stores a plain password and
      // should be re-saved as a hash now that the password is known.
      legacy: !account.passwordHash && typeof account.password === 'string',
    });
    return true;
  }

  const claims = claimsFromRequest(req);

  const deny = () => {
    sendJSON(res, 401, { error: 'Authentication required' });
    return true;
  };

  if (req.method === 'GET' && urlPath === '/api/session') {
    if (!claims) return deny();
    const { users, removedUsers } = readAccounts();
    const account = resolveAccount(claims.username, users, removedUsers);
    if (!account) {
      sendJSON(res, 401, { error: 'This account no longer exists' });
      return true;
    }
    sendJSON(res, 200, { user: sanitizeUser(account) });
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/state') {
    if (!claims) return deny();
    sendJSON(res, 200, readState());
    return true;
  }

  if (req.method === 'GET' && urlPath === '/api/rev') {
    if (!claims) return deny();
    sendJSON(res, 200, { rev: getRev() });
    return true;
  }

  if (req.method === 'POST' && urlPath === '/api/seed') {
    const body = await readJsonBody();
    if (!body) return true;

    // An empty database holds no accounts, so there is nothing to
    // authenticate against — the very first seed is the one exception.
    if (getRev() !== 0 && !claims) return deny();

    // Only the very first client may hand over its local data. The check
    // and the write happen without an await in between, so two devices
    // starting at once cannot both win.
    if (getRev() !== 0) {
      sendJSON(res, 409, { rev: getRev(), seeded: false });
      return true;
    }
    try {
      sendJSON(res, 200, { rev: applyOps(body.ops, true), seeded: true });
    } catch (err) {
      sendJSON(res, 500, { error: err.message });
    }
    return true;
  }

  if (req.method === 'POST' && urlPath === '/api/ops') {
    if (!claims) return deny();

    const body = await readJsonBody();
    if (!body) return true;

    const verdict = authorizeOps(claims, body.ops);
    if (!verdict.ok) {
      sendJSON(res, verdict.status, { error: verdict.error });
      return true;
    }

    try {
      sendJSON(res, 200, { rev: applyOps(body.ops) });
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
