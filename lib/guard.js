/**
 * Small helpers that keep the token checks out of every endpoint.
 * They speak the Vercel response shape (`res.status(...).json(...)`).
 */

const { claimsFromRequest, authorizeOps } = require('./auth');

/** Returns the token claims, or answers 401 and returns null. */
function requireAuth(req, res) {
  const claims = claimsFromRequest(req);
  if (!claims) {
    res.status(401).json({ error: 'Authentication required' });
    return null;
  }
  return claims;
}

/** Authentication plus the per-collection write policy. */
function requireWrite(req, res, ops) {
  const claims = requireAuth(req, res);
  if (!claims) return null;

  const verdict = authorizeOps(claims, ops);
  if (!verdict.ok) {
    res.status(verdict.status).json({ error: verdict.error });
    return null;
  }
  return claims;
}

module.exports = { requireAuth, requireWrite };
