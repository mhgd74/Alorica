/**
 * CORS configuration for API functions
 * Allows specific origins for better security
 */

const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim())
  : [
      'https://aloricav1.vercel.app',
      'http://localhost:3000',
      'http://localhost:3080',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3080',
    ];

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;

  // Only the listed origins get to read the response from a browser. A
  // request without an Origin header (curl, server-to-server) gets no CORS
  // grant at all — it does not need one, and "*" would let any site in.
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

// Methods that change data and therefore have to come from this site.
const MUTATING_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'];

/**
 * A browser always attaches `Origin` to a state-changing request, so a
 * request that carries one has to be carrying ours. Same-origin is decided
 * against the `Host` the request itself arrived on, which keeps every alias
 * and preview domain of this deployment working, while a page on another
 * site is refused. Requests with no Origin at all (curl, server-to-server)
 * are not browsers being tricked and are let through — they still have to
 * present a valid token.
 */
function requireTrustedOrigin(req, res) {
  if (!MUTATING_METHODS.includes(req.method)) return true;

  const origin = req.headers.origin;
  if (!origin) return true;

  let sameHost = false;
  try {
    sameHost = new URL(origin).host === req.headers.host;
  } catch (e) {
    sameHost = false;
  }

  if (ALLOWED_ORIGINS.includes(origin) || sameHost) return true;

  res.status(403).json({ error: 'Request origin is not allowed' });
  return false;
}

module.exports = { setCorsHeaders, requireTrustedOrigin, ALLOWED_ORIGINS };
