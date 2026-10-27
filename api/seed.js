const { applyOps, getRev } = require('../lib/supabase');
const { setCorsHeaders } = require('../lib/cors');

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

  try {
    const currentRev = await getRev();
    if (currentRev !== 0) {
      res.status(409).json({ rev: currentRev, seeded: false });
      return;
    }

    const result = await applyOps(req.body.ops, true);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
