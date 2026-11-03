/*
 * Date, time and text formatting shared by the whole interface.
 */

import { LIVE_PREFERENCES } from './preferences.js';



const pad = (n) => String(n).padStart(2, '0');


// Local (not UTC) YYYY-MM-DD so the date picker never shifts by a day
export const todayISO = () => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};


const to12h = (t24) => {
    if (!t24) return { hh: '', mm: '', ampm: 'AM' };
    const [h24, mm] = t24.split(':');
    const h = parseInt(h24, 10);
    return { hh: pad(h % 12 || 12), mm, ampm: h >= 12 ? 'PM' : 'AM' };
};


export const formatTime12h = (t24) => {
    if (!t24) return '';
    // The 24-hour choice is display-only — times are stored as "HH:MM".
    if (LIVE_PREFERENCES.timeFormat === '24h') return t24;
    const { hh, mm, ampm } = to12h(t24);
    return hh ? `${hh}:${mm} ${ampm}` : '';
};


// A requested change is stored with raw values so it can be applied
// directly; times are only prettified when they are shown.
export const changeValue = (c, value) => (c.field === 'time' ? (formatTime12h(value) || '—') : (value || '—'));


export const esc = (value) => String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
