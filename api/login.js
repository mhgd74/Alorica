const {
  issueToken,
  verifyPassword,
  sanitizeUser,
  resolveAccount,
} = require('../lib/auth');
const { readAccounts } = require('../lib/supabase');
const { setCorsHeaders } = require('../lib/cors');

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

  const body = req.body || {};
  const username = typeof body.username === 'string' ? body.username.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    res.status(400).json({ error: 'Username and password are required' });
    return;
  }

  try {
    const { users, removedUsers } = await readAccounts();
    const account = resolveAccount(username, users, removedUsers);

    // Same answer for "no such account" and "wrong password".
    if (!account || !verifyPassword(password, account)) {
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
