const { applyOps } = require('../lib/supabase');
const { requireWrite } = require('../lib/guard');
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

  const ops = (req.body || {}).ops;
  if (!requireWrite(req, res, ops)) return;

  try {
    const result = await applyOps(ops, false);
    res.status(200).json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
