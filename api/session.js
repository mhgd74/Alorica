const { sanitizeUser, resolveAccount } = require('../lib/auth');
const { requireAuth } = require('../lib/guard');
const { readAccounts } = require('../lib/supabase');
const { setCorsHeaders } = require('../lib/cors');

/**
 * Tells a device whether its saved token is still good, and hands back the
 * current account record so a role change or a deletion takes effect on the
 * next reload.
 */
module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const claims = requireAuth(req, res);
  if (!claims) return;

  try {
    const { users, removedUsers } = await readAccounts();
    const account = resolveAccount(claims.username, users, removedUsers);

    if (!account) {
      res.status(401).json({ error: 'This account no longer exists' });
      return;
    }

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ user: sanitizeUser(account) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
