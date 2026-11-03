/*
 * Which role an account acts as, and how the roles are labelled.
 */





export const ROLE_LABELS = { admin: 'Admin', teamlead: 'Team Leader', user: 'User' };


// Accounts saved before roles existed fall back to admin/user by username.
export const roleOf = (user) => {
    if (!user) return 'user';
    if (user.role) return user.role;
    return user.username === 'admin' ? 'admin' : 'user';
};
