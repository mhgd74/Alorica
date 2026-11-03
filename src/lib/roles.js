/*
 * Which role an account acts as, and how the roles are labelled.
 *
 * The two elevations cover different ground.
 *
 *  - `teamlead` runs the operation: reviewing bookings and leave, the bus
 *    fleet, printing and locking the sheet, and the operational policies.
 *  - `admin` is the technical role: it owns the accounts (creating and
 *    deleting them, handing out temporary passwords) and the data tools,
 *    and takes no part in the day-to-day operation.
 */

export const ROLE_LABELS = { admin: 'IT Admin', teamlead: 'Team Leader', user: 'User' };


// Accounts saved before roles existed fall back to admin/user by username.
export const roleOf = (user) => {
    if (!user) return 'user';
    if (user.role) return user.role;
    return user.username === 'admin' ? 'admin' : 'user';
};
