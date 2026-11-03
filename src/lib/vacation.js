/*
 * Leave balances: the record a new employee gets, and the repair of ones saved before they carried an id.
 */

import { LIVE_SETTINGS } from './settings.js';



// Fresh vacation balances for a new employee.
//
// The `id` is what the sync layer keys a collection item on. A balance
// record used to carry none, which meant the server could not derive a
// key for it (apply_sync_ops skips an item whose id is null) and every
// employee's balance collapsed onto one another in the diff, so an
// approved leave never reached the shared state.
export const freshVacationBalance = (employeeId) => ({
    id: String(employeeId),
    employeeId,
    annual: LIVE_SETTINGS.vacationDefaults.annual,
    sick: LIVE_SETTINGS.vacationDefaults.sick,
    personal: LIVE_SETTINGS.vacationDefaults.personal,
    usedAnnual: 0,
    usedSick: 0,
    usedPersonal: 0
});


// Balances saved before they carried an id are given one as they are
// read, so an older local dataset keeps syncing instead of piling up
// under a single shared key.
export const normalizeVacationBalances = (list) => (Array.isArray(list) ? list : [])
    .filter(Boolean)
    .map((b) => (b.id == null ? { ...b, id: String(b.employeeId) } : b));
