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

  // Check if origin is in allowed list
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  } else if (!origin) {
    // Allow requests without Origin header (like curl, Postman)
    res.setHeader('Access-Control-Allow-Origin', '*');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

module.exports = { setCorsHeaders, ALLOWED_ORIGINS };
