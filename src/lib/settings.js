/*
 * Admin-tunable settings. They travel as a single-record collection, so a
 * change the admin makes reaches every device over the same sync channel as
 * bookings and leave.
 */

import { DEFAULT_BOOKING_RULES, DEFAULT_VACATION_DAYS, SHIFT_SLOTS } from './config.js';



const copyShiftGroups = (groups) => (groups || []).map((group) => ({
    shift: group.shift || '',
    times: [...(group.times || [])]
}));


export const freshSettings = () => [{
    id: 'settings',
    shiftSlots: {
        arrival: copyShiftGroups(SHIFT_SLOTS.arrival),
        departure: copyShiftGroups(SHIFT_SLOTS.departure)
    },
    vacationDefaults: { ...DEFAULT_VACATION_DAYS },
    bookingRules: { ...DEFAULT_BOOKING_RULES },
    updatedAt: null,
    updatedBy: ''
}];


// Fills in whatever a stored record is missing, so a settings object
// saved before a new option existed keeps working after it is added.
export const normalizeSettingsRecord = (raw) => {
    const record = (Array.isArray(raw) ? raw[0] : raw) || {};
    const slots = record.shiftSlots || {};
    return {
        id: 'settings',
        shiftSlots: {
            arrival: Array.isArray(slots.arrival) && slots.arrival.length
                ? copyShiftGroups(slots.arrival) : copyShiftGroups(SHIFT_SLOTS.arrival),
            departure: Array.isArray(slots.departure) && slots.departure.length
                ? copyShiftGroups(slots.departure) : copyShiftGroups(SHIFT_SLOTS.departure)
        },
        vacationDefaults: { ...DEFAULT_VACATION_DAYS, ...(record.vacationDefaults || {}) },
        bookingRules: { ...DEFAULT_BOOKING_RULES, ...(record.bookingRules || {}) },
        updatedAt: record.updatedAt || null,
        updatedBy: record.updatedBy || ''
    };
};


export const normalizeSettingsList = (raw) => [normalizeSettingsRecord(raw)];


// Mirrored from React state so the helpers below (shift presets, fresh
// leave balances) read the values the admin last saved.
export let LIVE_SETTINGS = normalizeSettingsRecord(null);

export const setLiveSettings = (value) => { LIVE_SETTINGS = normalizeSettingsRecord(value); };
