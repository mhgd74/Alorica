/*
 * The booking rules: how a bus is chosen, how the daily distribution is
 * re-run, and how close to the departure an employee may still change things
 * on their own.
 */

import { EDIT_CUTOFF_MS, WAITLIST } from './config.js';



// The sheet is a one-record collection so it travels over the same sync
// channel as everything else.
export const freshSheet = () => [{ id: 'sheet', status: 'draft', updatedAt: null, updatedBy: '' }];

const bookingStart = (b) => new Date(`${b.date}T${b.time || '00:00'}`);

export const canEditBooking = (b) => bookingStart(b).getTime() - Date.now() >= EDIT_CUTOFF_MS;


// A change is only applied outright when both the booking as it stands and
// the values being written are outside the cutoff.
export const needsLeaderApproval = (booking, next) => !canEditBooking(booking)
    || Boolean(next && next.time && !canEditBooking(next));


// Group bookings by day, sorted chronologically
export const groupByDay = (bookings) => {
    const byDay = {};
    bookings.forEach((b) => {
        const day = b.date || 'Unknown date';
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(b);
    });
    return Object.keys(byDay).sort().map((day) => ({ day, items: byDay[day] }));
};


export const uniqueEmployeeCount = (list) => new Set(list.map((b) => b.employeeId)).size;




// Pick the first bus on that day that still has room, otherwise the waitlist.
export const assignBus = (booking, existing, buses) => {
    const used = {};
    buses.forEach((bus) => { used[bus.name] = 0; });
    existing
        .filter((b) => b.date === booking.date && b.bus && b.bus !== WAITLIST)
        .forEach((b) => { if (used[b.bus] != null) used[b.bus] += 1; });
    const bus = buses.find((b) => used[b.name] < b.capacity);
    return bus ? bus.name : WAITLIST;
};


// Re-run the automatic distribution for every day. Manual assignments are kept.
export const redistribute = (bookings, buses) => {
    const byDay = {};
    bookings.forEach((b) => { (byDay[b.date] = byDay[b.date] || []).push(b); });

    const next = {};
    Object.keys(byDay).forEach((day) => {
        const items = byDay[day].slice().sort((a, b) => String(a.time).localeCompare(String(b.time)));
        const used = {};
        buses.forEach((bus) => { used[bus.name] = 0; });

        items
            .filter((b) => b.busManual && b.bus && b.bus !== WAITLIST && used[b.bus] != null)
            .forEach((b) => { used[b.bus] += 1; });

        items.forEach((b) => {
            if (b.busManual) return;
            const bus = buses.find((x) => used[x.name] < x.capacity);
            if (bus) {
                next[b.id] = bus.name;
                used[bus.name] += 1;
            } else {
                next[b.id] = WAITLIST;
            }
        });
    });

    return bookings.map((b) => (next[b.id] ? { ...b, bus: next[b.id] } : b));
};
