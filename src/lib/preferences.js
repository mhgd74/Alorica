/*
 * Display preferences. They belong to this screen rather than to the shared
 * data, so they stay on the device and are never replicated.
 */

import { DEFAULT_PREFERENCES } from './config.js';



// Mirrored from React state so the plain formatters below can read the
// current choice without it being threaded through every call site.
export let LIVE_PREFERENCES = { ...DEFAULT_PREFERENCES };

export const setLivePreferences = (value) => {
    LIVE_PREFERENCES = { ...DEFAULT_PREFERENCES, ...(value || {}) };
};
