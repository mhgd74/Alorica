const {
  issueToken,
  verifyPassword,
  sanitizeUser,
  resolveAccount,
} = require('../lib/auth');
const { readAccounts } = require('../lib/supabase');
const { setCorsHeaders, requireTrustedOrigin } = require('../lib/cors');

/* --------------------------- attempt limiting ---------------------------
 * Guessing a password needs many tries, so the failures are counted per
 * device and account. The store lives in the instance, which is enough to
 * make sustained guessing impractical without adding a dependency; a cold
 * start only clears the counters.
 */
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map();

const attemptKey = (req, username) => {
  const forwarded = String((req.headers && req.headers['x-forwarded-for']) || '')
    .split(',')[0]
    .trim();
  const address = forwarded || (req.socket && req.socket.remoteAddress) || 'unknown';
  return `${address}|${username.toLowerCase()}`;
};

const isLockedOut = (key) => {
  const now = Date.now();
  const recent = (attempts.get(key) || []).filter((at) => now - at < ATTEMPT_WINDOW_MS);
  attempts.set(key, recent);
  return recent.length >= MAX_ATTEMPTS;
};

const recordFailure = (key) => {
  const recent = attempts.get(key) || [];
  recent.push(Date.now());
  attempts.set(key, recent);

  if (attempts.size > 1000) {
    const now = Date.now();
    attempts.forEach((hits, entry) => {
      if (!hits.some((at) => now - at < ATTEMPT_WINDOW_MS)) attempts.delete(entry);
    });
  }
};

const clearFailures = (key) => attempts.delete(key);

/**
 * The only place credentials are checked. Passwords never leave the server
 * anymore, so the browser cannot be tricked into accepting a wrong one.
 */
module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!requireTrustedOrigin(req, res)) return;

  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  const key = attemptKey(req, username);
  if (isLockedOut(key)) {
    res.setHeader('Retry-After', String(Math.ceil(ATTEMPT_WINDOW_MS / 1000)));
    res.status(429).json({ error: 'Too many failed attempts. Please try again later.' });
    return;
  }

  try {
    const { users, removedUsers } = await readAccounts();
    const account = resolveAccount(username, users, removedUsers);

    // Same answer for "no such account" and "wrong password".
    if (!account || !verifyPassword(password, account)) {
      recordFailure(key);
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    if (
      account.mustChangePassword &&
      account.tempPasswordExpiresAt &&
      account.tempPasswordExpiresAt < Date.now()
    ) {
      res.status(403).json({ error: 'This temporary password has expired. Please request a new one.' });
      return;
    }

    clearFailures(key);

    const role = account.role || (account.username === 'admin' ? 'admin' : 'user');
    const legacy = !account.passwordHash && typeof account.password === 'string';

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      token: issueToken({ username: account.username, role }, Boolean(body.remember)),
      user: sanitizeUser(account),
      // Tells the browser this account still stores a plain password and
      // should be re-saved as a hash now that the password is known.
      legacy,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
