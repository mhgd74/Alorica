/*
 * Shared state: a localStorage cache for an instant UI, plus the queue that
 * replicates every change to the server. Only the real differences are sent,
 * so nothing is overwritten by a device that was slow to update.
 */

import { COLLECTION_BY_KEY, STORAGE, PENDING_KEY } from './config.js';
import { apiFetch } from './session.js';



/* =============================================================
 * 2a. Shared state (local cache + Node/SQLite server)
 * =============================================================
 * localStorage keeps the UI instant, while every change is also
 * replicated to the server so several devices share the same data.
 * Only the real differences are sent, so nothing gets overwritten
 * by a device that was slow to update.
 */

export const SYNC = {
    rev: 0,
    cache: {},
    pending: new Map(),
    timer: null,
    flushing: false,
    online: true,
    // When the last successful poll finished — shown under Settings.
    lastSyncAt: null,
    // Set by the sync effect so "Sync now" can ask for a poll on demand.
    pull: null,
    // Raised when the server refuses a batch: the local copy no longer
    // matches what was accepted, so the next poll re-reads everything.
    needsResync: false,
    listeners: new Set()
};


const syncKeyOf = (item) => (item && typeof item === 'object'
    ? String(item.id != null ? item.id : item.username)
    : String(item));


const syncEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);


export const loadJSON = (key, fallback) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
        return fallback;
    }
};


export const syncSetOnline = (online) => {
    if (SYNC.online === online) return;
    SYNC.online = online;
    SYNC.listeners.forEach((fn) => fn(online));
};


/* The queue is mirrored into localStorage so a change made a moment before
 * the tab was closed is still sent on the next visit. It is rewritten
 * whenever the queue changes, and removed once the server has taken it. */
const syncSavePending = () => {
    const saved = {};
    SYNC.pending.forEach((queued, key) => {
        if (!queued.upsert.size && !queued.remove.size) return;
        saved[key] = { upsert: [...queued.upsert.values()], remove: [...queued.remove] };
    });

    try {
        if (Object.keys(saved).length) localStorage.setItem(PENDING_KEY, JSON.stringify(saved));
        else localStorage.removeItem(PENDING_KEY);
    } catch (e) {
        /* storage unavailable */
    }
};


const syncLoadPending = () => {
    const saved = loadJSON(PENDING_KEY, null);
    const restored = new Map();
    if (!saved || typeof saved !== 'object') return restored;

    Object.keys(saved).forEach((key) => {
        const queued = saved[key];
        if (!queued || typeof queued !== 'object') return;
        const upsert = new Map(
            (Array.isArray(queued.upsert) ? queued.upsert : []).map((item) => [syncKeyOf(item), item])
        );
        const remove = new Set(Array.isArray(queued.remove) ? queued.remove : []);
        if (upsert.size || remove.size) restored.set(key, { upsert, remove });
    });

    return restored;
};


SYNC.pending = syncLoadPending();


// Throws the queue away, in memory and on disk. Used when the session ends:
// the work belongs to the account that is leaving.
export const syncClearPending = () => {
    SYNC.pending.clear();
    syncSavePending();
};


// Added / changed / removed items between two versions of a collection.
// Anything that is not a list is treated as empty: a value left behind
// by an older version in localStorage must not take the page down.
const syncDiff = (before, after) => {
    const prevMap = new Map((Array.isArray(before) ? before : []).map((item) => [syncKeyOf(item), item]));
    const nextMap = new Map((Array.isArray(after) ? after : []).map((item) => [syncKeyOf(item), item]));
    const upsert = [];
    const remove = [];
    nextMap.forEach((value, id) => {
        const old = prevMap.get(id);
        if (!old || !syncEqual(old, value)) upsert.push(value);
    });
    prevMap.forEach((_, id) => { if (!nextMap.has(id)) remove.push(id); });
    return { upsert, remove };
};


const syncRequeue = (key, diff) => {
    const queued = SYNC.pending.get(key) || { upsert: new Map(), remove: new Set() };
    diff.upsert.forEach((item) => {
        const id = syncKeyOf(item);
        queued.upsert.set(id, item);
        queued.remove.delete(id);
    });
    diff.remove.forEach((id) => {
        queued.remove.add(id);
        queued.upsert.delete(id);
    });
    SYNC.pending.set(key, queued);
    syncSavePending();
};


const syncSchedule = () => {
    if (SYNC.timer) return;
    // A short delay batches the burst of state updates one action causes.
    SYNC.timer = setTimeout(() => {
        SYNC.timer = null;
        syncFlush();
    }, 300);
};


const syncTakeOps = () => {
    const ops = [];
    SYNC.pending.forEach((queued, key) => {
        const name = COLLECTION_BY_KEY[key];
        if (!name) return;
        ops.push({
            collection: name,
            upsert: [...queued.upsert.values()],
            remove: [...queued.remove]
        });
    });
    SYNC.pending.clear();
    return ops;
};


const syncPost = async (ops) => {
    const res = await apiFetch('/api/ops', {
        method: 'POST',
        body: JSON.stringify({ ops })
    });
    if (!res.ok) throw new Error(`sync failed (${res.status})`);
    return res.json();
};


export const syncFlush = async () => {
    if (SYNC.flushing || SYNC.pending.size === 0) return;
    SYNC.flushing = true;
    const ops = syncTakeOps();
    try {
        const { rev } = await syncPost(ops);
        SYNC.rev = rev;
        syncSetOnline(true);
    } catch (err) {
        // A 4xx means the server will never accept this batch — a role
        // that may not touch a collection, for instance. Retrying would
        // only wedge the queue, so the batch is dropped. The local copy
        // still holds the change the server just refused, so a re-read
        // is asked for: what is on screen goes back to what was stored
        // instead of quietly drifting away from it.
        // Anything else (offline, 5xx) is transient: the batch goes
        // back in and is retried.
        if (/\((4\d\d)\)/.test(err.message)) {
            console.warn('Sync batch rejected by the server:', err.message, ops);
            SYNC.needsResync = true;
        } else {
            ops.forEach((op) => syncRequeue(STORAGE[op.collection], { upsert: op.upsert, remove: op.remove }));
            SYNC.pending = new Map([...SYNC.pending].filter(([, q]) => q.upsert.size || q.remove.size));
        }
        syncSetOnline(false);
    } finally {
        SYNC.flushing = false;
        syncSavePending();
    }
};


// Used when the server is the one that changed: the cache is updated
// first so the save effects below see no difference and stay quiet.
// A collection with work still queued locally is skipped, otherwise
// the server copy would wipe an edit that has not been accepted yet.
export const syncApplyRemote = (collections) => {
    const touched = {};

    // A response that is not the shape this expects is ignored, so a bad
    // body can never be written over the local copy.
    if (!collections || typeof collections !== 'object') return touched;

    Object.keys(STORAGE).forEach((name) => {
        if (!(name in collections)) return;
        if (SYNC.pending.has(STORAGE[name])) return;
        // A collection that is not a list is left alone rather than
        // written over the local copy as something it is not.
        if (!Array.isArray(collections[name])) return;
        const value = collections[name];
        SYNC.cache[STORAGE[name]] = value;
        try {
            localStorage.setItem(STORAGE[name], JSON.stringify(value));
        } catch (e) {
            /* storage unavailable */
        }
        touched[name] = value;
    });
    return touched;
};


export const saveJSON = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        /* storage full or unavailable */
    }

    // Keys outside the synced collections (the device-local
    // preferences, for instance) are stored and nothing more — there
    // is nothing to send, and a plain object would not diff.
    if (!(key in COLLECTION_BY_KEY)) return;

    // The first value seen after a reload is what was just read from
    // localStorage, so it is not a change to send. Without this, every
    // page load would push the whole local dataset back at the server.
    if (!(key in SYNC.cache)) {
        SYNC.cache[key] = value;
        return;
    }

    const diff = syncDiff(SYNC.cache[key], value);
    SYNC.cache[key] = value;
    if (diff.upsert.length || diff.remove.length) {
        syncRequeue(key, diff);
        syncSchedule();
    }
};
