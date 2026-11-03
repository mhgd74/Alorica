/*
 * Password hashing (PBKDF2-SHA256). Passwords are never stored or compared in
 * plain text; accounts saved by older versions keep a plain `password` field
 * and are upgraded to a salted hash the next time the owner signs in.
 */

import { PBKDF2_BYTES, PBKDF2_ITERATIONS } from './config.js';



const toHex = (buffer) =>
    Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');


const fromHex = (hex) => {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    return bytes;
};


const randomSaltHex = () => {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return toHex(bytes);
};


// Human-friendly temporary password (no look-alike characters).
export const generateTempPassword = () => {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = new Uint8Array(10);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map((b) => alphabet[b % alphabet.length]).join('');
};


const derivePasswordHash = async (password, saltHex) => {
    // crypto.subtle needs a secure context (https or localhost).
    if (!window.crypto || !crypto.subtle) return null;
    const key = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt: fromHex(saltHex), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
        key,
        PBKDF2_BYTES * 8
    );
    return toHex(bits);
};


export const isHashed = (user) => Boolean(user && user.passwordHash && user.passwordSalt);


// Replaces a plain-text password with a salted hash (never keeps both).
export const withHashedPassword = async (user) => {
    const { password, ...rest } = user;
    const passwordSalt = randomSaltHex();
    const passwordHash = await derivePasswordHash(password, passwordSalt);
    if (!passwordHash) return { ...user }; // no WebCrypto: leave the account untouched
    return { ...rest, passwordSalt, passwordHash };
};
