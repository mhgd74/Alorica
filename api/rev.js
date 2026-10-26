const { getRev } = require('../lib/supabase');

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const rev = await getRev();
        res.setHeader('Cache-Control', 'no-store');
        res.status(200).json({ rev });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
    }
};
