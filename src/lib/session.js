/*
 * The session token. The password is checked by the server, which hands back
 * a signed token; every API call carries it and a 401 means the session is
 * over, so the checks can no longer be skipped from the browser.
 */

import { SESSION_KEY } from './config.js';



export const AUTH = { token: null, onExpired: null };


export const authRead = () => {
    try {
        const saved = JSON.parse(localStorage.getItem(SESSION_KEY));
        return saved && saved.token ? saved : null;
    } catch (e) {
        return null;
    }
};


// Only "remember me" keeps the token across a reload; otherwise it
// lives in memory for the tab alone.
export const authRemember = (token, user) => {
    try {
        localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user }));
    } catch (e) {
        /* storage unavailable */
    }
};


export const authForget = () => {
    try {
        localStorage.removeItem(SESSION_KEY);
    } catch (e) {
        /* storage unavailable */
    }
};


export const authClear = () => {
    AUTH.token = null;
    authForget();
};


// One place to attach the token and to react to an expired session.
export const apiFetch = async (path, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (options.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    if (AUTH.token) headers.Authorization = `Bearer ${AUTH.token}`;

    const res = await fetch(path, { ...options, headers });

    if (res.status === 401) {
        authClear();
        if (AUTH.onExpired) AUTH.onExpired();
        throw new Error('Session expired');
    }
    return res;
};
