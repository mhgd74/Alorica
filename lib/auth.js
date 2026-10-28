/**
 * Server-side authentication and authorisation.
 *
 * The browser used to be the only place a role was checked, which meant the
 * API would happily accept work from anyone who knew the URL. Every API call
 * now has to carry a signed token, and the write policy below decides what a
 * role is allowed to push.
 *
 * Tokens are stateless (HMAC over a small JSON payload) so nothing has to be
 * stored for a session: the same code works for the Vercel functions and for
 * the local `server.js`.
 */

const crypto = require('crypto');

/* Matches the PBKDF2 parameters used in index.html. */
const PBKDF2_ITERATIONS = 100000;
const PBKDF2_BYTES = 32;
const PBKDF2_DIGEST = 'sha256';

const SESSION_TTL_REMEMBER = 30 * 24 * 60 * 60 * 1000;
const SESSION_TTL_DEFAULT = 12 * 60 * 60 * 1000;

// A dedicated secret is preferred; the service-role key is used as a fallback
// so the deployment keeps working without extra configuration. Rotating
// whichever value is in use signs everybody out.
const SECRET =
  process.env.AUTH_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'alorica-development-secret';

const USING_DERIVED_SECRET = !process.env.AUTH_SECRET;

const toBase64Url = (input) =>
  Buffer.from(input).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

const fromBase64Url = (input) =>
  Buffer.from(String(input).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const sign = (data) => toBase64Url(crypto.createHmac('sha256', SECRET).update(data).digest());

/* ------------------------------ sessions ------------------------------ */

function issueToken(claims, remember = false) {
  const payload = {
    u: claims.username,
    r: claims.role,
    e: Date.now() + (remember ? SESSION_TTL_REMEMBER : SESSION_TTL_DEFAULT),
  };
  const body = toBase64Url(JSON.stringify(payload));
  return `${body}.${sign(body)}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;

  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const signature = token.slice(dot + 1);

  const expected = sign(body);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return null;
  if (!crypto.timingSafeEqual(given, want)) return null;

  let payload;
  try {
    payload = JSON.parse(fromBase64Url(body).toString('utf8'));
  } catch (err) {
    return null;
  }

  if (!payload || typeof payload.u !== 'string' || typeof payload.e !== 'number') return null;
  if (payload.e < Date.now()) return null;

  return { username: payload.u, role: payload.r };
}

/** Reads `Authorization: Bearer <token>` and returns the claims, or null. */
function claimsFromRequest(req) {
  const header = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!header || typeof header !== 'string') return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? verifyToken(match[1].trim()) : null;
}

/* ----------------------------- passwords ----------------------------- */

function verifyPassword(password, record) {
  if (!record || typeof password !== 'string') return false;

  // Accounts created before hashing was introduced still hold a plain string.
  if (!record.passwordHash || !record.passwordSalt) {
    return typeof record.password === 'string' && record.password === password;
  }

  let derived;
  try {
    derived = crypto
      .pbkdf2Sync(
        password,
        Buffer.from(record.passwordSalt, 'hex'),
        PBKDF2_ITERATIONS,
        PBKDF2_BYTES,
        PBKDF2_DIGEST
      )
      .toString('hex');
  } catch (err) {
    return false;
  }

  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(record.passwordHash, 'hex');
  if (a.length !== b.length || a.length === 0) return false;
  return crypto.timingSafeEqual(a, b);
}

/** Everything the browser is allowed to see about an account. */
function sanitizeUser(record) {
  if (!record || typeof record !== 'object') return record;
  const { passwordHash, passwordSalt, password, ...safe } = record;
  return safe;
}

const sanitizeUsers = (list) => (Array.isArray(list) ? list.map(sanitizeUser) : []);

/* -------------------------- built-in accounts --------------------------
 * index.html ships a handful of accounts so the app works before anybody has
 * created one. The server has to know them too, otherwise those accounts could
 * never sign in on a database that has not been seeded yet. The hashes below
 * are the same ones the browser uses.
 */
const BUILTIN_USERS = [
  { username: 'admin', name: 'System Admin', role: 'admin', passwordSalt: '8b036795d80f3e91a28d9a4e6df054c3', passwordHash: '7ba9a15205e600a95954ffd082fa77274aa2a6a979e5a0e63e6ca5c8a24c938b' },
  { username: 'teamlead', name: 'Team Leader', role: 'teamlead', passwordSalt: 'c58051277c5d9074dfeff9746c355e60', passwordHash: '11ed52253410cf6bc2745869aee4d29c7b80454f9ec6a9fcb3d7b67f98a9f5d8' },
  { username: '7406173', name: 'Gomaa Abdelrahman', role: 'user', passwordSalt: 'ace138aead5305352f5eaf89f13950c3', passwordHash: '92d22c3baba14718acbef23e5f10da00a659ea3fcc554131492f9a68881f8c3a', mustChangePassword: true },
  { username: 'user2', name: 'Second User', role: 'user', passwordSalt: '41871c8d1e71b76f725da87a84f60e68', passwordHash: '55e1cb505c126417fc177d3a1b1298621f66f2aa994db335e7f3574983ae7861' },
];

/** Built-in accounts plus the stored ones, with stored records winning. */
function allAccounts(storedUsers) {
  const list = Array.isArray(storedUsers) ? storedUsers.filter(Boolean) : [];
  const overridden = new Set(list.map((u) => u.username));
  return BUILTIN_USERS.filter((u) => !overridden.has(u.username)).concat(list);
}

/**
 * The account a username resolves to right now, or null when it does not exist
 * (or was deleted). Mirrors how `allUsers` is built in the browser.
 */
function resolveAccount(username, storedUsers, removedUsers) {
  if (!username) return null;
  const removed = new Set((Array.isArray(removedUsers) ? removedUsers : []).map(String));
  if (removed.has(username)) return null;
  return allAccounts(storedUsers).find((u) => u && u.username === username) || null;
}

/* ---------------------------- write policy ---------------------------- */

// Collections a non-admin may not touch at all.
const ADMIN_ONLY_COLLECTIONS = ['removedUsers'];

// Collections where a non-admin may only touch their own record. Editing
// somebody else's account is how a role would be escalated.
const SELF_ONLY_COLLECTIONS = ['users'];

const itemIdentity = (item) =>
  item && typeof item === 'object'
    ? String(item.id != null ? item.id : item.username != null ? item.username : '')
    : String(item);

/**
 * Returns `{ ok: true }` or `{ ok: false, status, error }`. Only the
 * collections where a wrong write would be damaging are policed; the rest
 * stay as permissive as the in-app rules already were.
 */
function authorizeOps(claims, ops) {
  if (!claims) return { ok: false, status: 401, error: 'Authentication required' };
  if (claims.role === 'admin') return { ok: true };

  for (const op of Array.isArray(ops) ? ops : []) {
    const name = op && op.collection;
    if (!name) continue;

    if (ADMIN_ONLY_COLLECTIONS.includes(name)) {
      return { ok: false, status: 403, error: `Only an admin may change ${name}` };
    }

    if (SELF_ONLY_COLLECTIONS.includes(name)) {
      const touched = [...(op.upsert || []), ...(op.remove || [])].map(itemIdentity);
      const foreign = touched.filter((id) => id !== claims.username);
      if (foreign.length) {
        return { ok: false, status: 403, error: 'You may only change your own account' };
      }
    }
  }

  return { ok: true };
}

module.exports = {
  issueToken,
  verifyToken,
  claimsFromRequest,
  verifyPassword,
  sanitizeUser,
  sanitizeUsers,
  authorizeOps,
  BUILTIN_USERS,
  allAccounts,
  resolveAccount,
  USING_DERIVED_SECRET,
  SESSION_TTL_REMEMBER,
  SESSION_TTL_DEFAULT,
};
