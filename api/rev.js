const { getRev } = require('../lib/supabase');
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
    console.log('Attempting to fetch revision...');
    const rev = await getRev();
    console.log('Revision fetched:', rev);
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ rev });
  } catch (err) {
    console.error('API Error in rev.js:', err);
    res.status(500).json({
      error: err.message,
      hint: 'If you see "Could not find table", try Reload PostgREST in Supabase settings.',
      details: err,
    });
  }
};
