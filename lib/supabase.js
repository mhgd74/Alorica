const { createClient } = require('@supabase/supabase-js');
const { sanitizeUsers } = require('./auth');

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

const itemId = (item) =>
  item && typeof item === 'object'
    ? String(item.id != null ? item.id : item.username)
    : String(item);

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

  // Password material never leaves the server; login compares it here.
  collections.users = sanitizeUsers(collections.users);

  return { rev: meta.rev, collections };
}

/**
 * Used by the login endpoint, which is the one place that has to see the
 * stored hash in order to compare it. `removedUsers` is needed as well: an
 * account the admin deleted must not be able to sign in.
 */
async function readAccounts() {
  const { data, error } = await supabase
    .from('items')
    .select('collection, data')
    .in('collection', ['users', 'removedUsers']);

  if (error) throw error;

  const accounts = { users: [], removedUsers: [] };
  data.forEach((row) => {
    if (row.collection === 'users') accounts.users.push(row.data);
    else if (row.collection === 'removedUsers') accounts.removedUsers.push(row.data);
  });
  return accounts;
}

/**
 * The browser no longer holds password hashes, so a record it sends back can
 * legitimately be missing them. Copying the stored values over stops a name or
 * role change from silently wiping somebody's password.
 */
async function preserveUserSecrets(ops) {
  const touchesUsers = (ops || []).some(
    (op) => op && op.collection === 'users' && (op.upsert || []).length
  );
  if (!touchesUsers) return ops;

  const { data, error } = await supabase.from('items').select('id, data').eq('collection', 'users');
  if (error) throw error;

  const stored = new Map(data.map((row) => [String(row.id), row.data]));

  return ops.map((op) => {
    if (!op || op.collection !== 'users' || !(op.upsert || []).length) return op;
    return {
      ...op,
      upsert: op.upsert.map((item) => {
        const previous = stored.get(itemId(item));
        if (!previous || item.passwordHash) return item;
        return {
          ...item,
          passwordHash: previous.passwordHash,
          passwordSalt: previous.passwordSalt,
        };
      }),
    };
  });
}

async function applyOps(ops, seed = false) {
  const prepared = seed ? ops : await preserveUserSecrets(ops);

  const { data, error } = await supabase.rpc('apply_sync_ops', {
    p_ops: prepared,
    p_seed: seed,
  });

  if (error) throw error;
  return data; // { seeded: boolean, rev: number }
}

module.exports = {
  getRev,
  readState,
  readAccounts,
  applyOps,
  COLLECTIONS,
};
