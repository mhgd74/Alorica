const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Environment variables SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing');
  // We don't throw here to avoid crashing the process immediately,
  // but the client calls will fail gracefully.
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Shared state for the Alorica transport booking app.
 * Clients replicate a handful of named collections.
 * Everything lives in a single document table 'items' keyed by (collection, id).
 */

const COLLECTIONS = [
  'bookings',
  'users',
  'removedUsers',
  'passwordRequests',
  'changeRequests',
  'notifications',
  'buses',
  'audit',
  'sheet',
  'vacations',
  'vacationBalances',
];

async function getRev() {
  const { data, error } = await supabase.from('sync_meta').select('rev').eq('id', true).single();

  if (error) throw error;
  return data.rev;
}

async function readState() {
  const { data: items, error: itemsError } = await supabase
    .from('items')
    .select('collection, data');

  if (itemsError) throw itemsError;

  const { data: meta, error: metaError } = await supabase
    .from('sync_meta')
    .select('rev')
    .eq('id', true)
    .single();

  if (metaError) throw metaError;

  const collections = {};
  COLLECTIONS.forEach((name) => (collections[name] = []));

  items.forEach((item) => {
    if (collections[item.collection]) {
      collections[item.collection].push(item.data);
    }
  });

  return { rev: meta.rev, collections };
}

async function applyOps(ops, seed = false) {
  const { data, error } = await supabase.rpc('apply_sync_ops', {
    p_ops: ops,
    p_seed: seed,
  });

  if (error) throw error;
  return data; // { seeded: boolean, rev: number }
}

module.exports = {
  getRev,
  readState,
  applyOps,
  COLLECTIONS,
};
