const { readState, getRev } = require('../lib/supabase');
const { setCorsHeaders } = require('../lib/cors');

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

  try {
    const state = await readState();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(state);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
