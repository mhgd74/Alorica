/*
 * The application shell: session handling, routing between tabs and the shared state.
 */

import { AdminDashboard } from './components/admin.js';
import { Login, PasswordChange } from './components/auth.js';
import { BookingForm, EditBookingDialog, MyBookings } from './components/booking.js';
import { Icon, Toasts } from './components/common.js';
import { ConfirmDialog, OverrideDialog, TempPasswordDialog } from './components/dialogs.js';
import { NotificationBell } from './components/notifications.js';
import { SettingsDialog } from './components/settings.js';
import { MyVacations, VacationRequestForm } from './components/vacation.js';
import { assignBus, freshSheet, groupByDay, needsLeaderApproval, redistribute, uniqueEmployeeCount } from './lib/booking.js';
import { CHANGE_REQUEST_TTL, DEFAULT_BUSES, DEFAULT_PREFERENCES, DEFAULT_USERS, PREF_KEY, SHEET_STATUS, STORAGE, TEMP_PASSWORD_TTL, VACATION_STATUS, VACATION_TYPES, WAITLIST, XLSX_MIME } from './lib/config.js';
import { generateTempPassword, isHashed, withHashedPassword } from './lib/crypto.js';
import { formatTime12h, todayISO } from './lib/format.js';
import { LIVE_PREFERENCES, setLivePreferences } from './lib/preferences.js';
import { buildPrintHtml, buildWorkbook, ensureXlsx } from './lib/report.js';
import { ROLE_LABELS, roleOf } from './lib/roles.js';
import { AUTH, apiFetch, authClear, authForget, authRead, authRemember } from './lib/session.js';
import { LIVE_SETTINGS, freshSettings, normalizeSettingsList, normalizeSettingsRecord, setLiveSettings } from './lib/settings.js';
import { SYNC, loadJSON, saveJSON, syncApplyRemote, syncClearPending, syncFlush, syncSetOnline } from './lib/store.js';
import { freshVacationBalance, normalizeVacationBalances } from './lib/vacation.js';

const { useState, useEffect, useMemo } = React;



export const App = () => {
    /* ------------------ state ------------------ */
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [loginData, setLoginData] = useState({ username: '', password: '' });
    const [rememberMe, setRememberMe] = useState(() => {
        const saved = localStorage.getItem('rememberMe');
        return saved === 'true';
    });
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState('arrival');
    const [bookings, setBookings] = useState(() => loadJSON(STORAGE.bookings, []));
    const [customUsers, setCustomUsers] = useState(() => loadJSON(STORAGE.users, []));
    const [removedUsers, setRemovedUsers] = useState(() => loadJSON(STORAGE.removedUsers, []));
    const [passwordRequests, setPasswordRequests] = useState(() => loadJSON(STORAGE.passwordRequests, []));
    const [changeRequests, setChangeRequests] = useState(() => loadJSON(STORAGE.changeRequests, []));
    const [notifications, setNotifications] = useState(() => loadJSON(STORAGE.notifications, []));
    const [bellOpen, setBellOpen] = useState(false);
    const [tempPasswordReveal, setTempPasswordReveal] = useState(null);
    const [loginNotice, setLoginNotice] = useState('');
    const [buses, setBuses] = useState(() => loadJSON(STORAGE.buses, DEFAULT_BUSES));
    const [auditLog, setAuditLog] = useState(() => loadJSON(STORAGE.audit, []));
    const [sheetState, setSheetState] = useState(() => loadJSON(STORAGE.sheet, freshSheet()));
    const [syncOnline, setSyncOnline] = useState(SYNC.online);
    const [adminView, setAdminView] = useState('bookings');
    const [vacations, setVacations] = useState(() => loadJSON(STORAGE.vacations, []));
    const [vacationBalances, setVacationBalances] = useState(
        () => normalizeVacationBalances(loadJSON(STORAGE.vacationBalances, []))
    );
    const [showVacationForm, setShowVacationForm] = useState(false);
    // Admin-tunable settings, shared through the sync channel.
    const [settings, setSettings] = useState(
        () => normalizeSettingsList(loadJSON(STORAGE.settings, freshSettings()))
    );
    // Personal display choices — this device only.
    const [preferences, setPreferences] = useState(
        () => ({ ...DEFAULT_PREFERENCES, ...loadJSON(PREF_KEY, {}) })
    );
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [settingsSection, setSettingsSection] = useState(null);
    // A team leader is an employee too, so they can flip between running the
    // dashboard and managing their own bookings.
    const [leaderMode, setLeaderMode] = useState('dashboard');
    // The employee side is two screens, not one long page: booking transport and
    // managing your own leave.
    const [meView, setMeView] = useState('transport');
    const [newUser, setNewUser] = useState({ name: '', username: '', password: '', role: 'user' });
    const [newBus, setNewBus] = useState({ name: '', capacity: '' });
    const [userFeedback, setUserFeedback] = useState({ type: '', text: '' });
    const [busFeedback, setBusFeedback] = useState({ type: '', text: '' });
    const [sharing, setSharing] = useState(false);
    const [toasts, setToasts] = useState([]);
    const [filters, setFilters] = useState({ q: '', from: '', to: '' });
    const [importing, setImporting] = useState(false);
    const [selectedRoad, setSelectedRoad] = useState(null);
    const [pwdForm, setPwdForm] = useState({ next: '', confirm: '' });
    const [pwdFeedback, setPwdFeedback] = useState({ type: '', text: '' });
    const [confirmRequest, setConfirmRequest] = useState(null);
    const [editingBooking, setEditingBooking] = useState(null);
    const [overrideRequest, setOverrideRequest] = useState(null);

    const [formData, setFormData] = useState({
        dropOffLocation: '',
        time: '',
        date: todayISO()
    });

    /* ------------------ effects ------------------ */
    useEffect(() => { saveJSON(STORAGE.bookings, bookings); }, [bookings]);
    useEffect(() => { saveJSON(STORAGE.users, customUsers); }, [customUsers]);
    useEffect(() => { saveJSON(STORAGE.removedUsers, removedUsers); }, [removedUsers]);
    useEffect(() => { saveJSON(STORAGE.passwordRequests, passwordRequests); }, [passwordRequests]);
    useEffect(() => { saveJSON(STORAGE.changeRequests, changeRequests); }, [changeRequests]);
    useEffect(() => { saveJSON(STORAGE.notifications, notifications); }, [notifications]);
    useEffect(() => { saveJSON(STORAGE.buses, buses); }, [buses]);
    useEffect(() => { saveJSON(STORAGE.audit, auditLog); }, [auditLog]);
    useEffect(() => { saveJSON(STORAGE.sheet, sheetState); }, [sheetState]);
    useEffect(() => { saveJSON(STORAGE.vacations, vacations); }, [vacations]);
    useEffect(() => { saveJSON(STORAGE.vacationBalances, vacationBalances); }, [vacationBalances]);
    useEffect(() => { saveJSON(STORAGE.settings, settings); }, [settings]);
    useEffect(() => { saveJSON(PREF_KEY, preferences); }, [preferences]);

    /* ------------------ server sync ------------------
     * Every device polls the revision counter; when it moves the
     * collections are re-read, so a change made anywhere shows up
     * here within a few seconds. Syncing only starts once there is a
     * session, because the server refuses to talk to anybody else.
     */
    useEffect(() => {
        if (!isLoggedIn) return undefined;
        let cancelled = false;

        const listener = (online) => setSyncOnline(online);
        SYNC.listeners.add(listener);

        const applyServerState = (collections) => {
            const touched = syncApplyRemote(collections);
            if (cancelled) return;
            if (touched.bookings) setBookings(touched.bookings);
            if (touched.users) setCustomUsers(touched.users);
            if (touched.removedUsers) setRemovedUsers(touched.removedUsers);
            if (touched.passwordRequests) setPasswordRequests(touched.passwordRequests);
            if (touched.changeRequests) setChangeRequests(touched.changeRequests);
            if (touched.notifications) setNotifications(touched.notifications);
            if (touched.audit) setAuditLog(touched.audit);
            if (touched.sheet) setSheetState(touched.sheet.length ? touched.sheet : freshSheet());
            if (touched.vacations) setVacations(touched.vacations);
            if (touched.vacationBalances) setVacationBalances(touched.vacationBalances);
            if (touched.settings) setSettings(touched.settings.length ? touched.settings : freshSettings());
            // An empty fleet means "never configured", so defaults stay.
            setBuses(touched.buses && touched.buses.length ? touched.buses : DEFAULT_BUSES);
        };

        // First run against an empty database: hand over whatever this
        // browser already had, so nothing built up before the server
        // existed is lost.
        const bootstrap = async () => {
            try {
                const state = await (await apiFetch('/api/state', { cache: 'no-store' })).json();
                if (state.rev !== 0) {
                    SYNC.rev = state.rev;
                    return state.collections;
                }

                const ops = Object.keys(STORAGE).map((name) => ({
                    collection: name,
                    replace: true,
                    upsert: loadJSON(STORAGE[name], [])
                }));
                const res = await apiFetch('/api/seed', {
                    method: 'POST',
                    body: JSON.stringify({ ops })
                });
                if (res.status === 409) {
                    // Another device seeded first — take its data instead.
                    const fresh = await (await apiFetch('/api/state', { cache: 'no-store' })).json();
                    SYNC.rev = fresh.rev;
                    return fresh.collections;
                }
                if (!res.ok) throw new Error(`seed failed (${res.status})`);
                SYNC.rev = (await res.json()).rev;
                return null;
            } catch (err) {
                console.error('Bootstrap error:', err);
                // Return null to indicate we couldn't bootstrap, but continue anyway
                return null;
            }
        };

        // A poll takes a moment, and the 3s timer can fire again before
        // the previous one settled, so only one is allowed in flight.
        let pulling = false;
        let failedPolls = 0;

        const pull = async () => {
            if (pulling) return;
            pulling = true;
            try {
                const { rev } = await (await apiFetch('/api/rev', { cache: 'no-store' })).json();
                // A batch can fail without the revision moving, so push any
                // leftover work before deciding whether anything new arrived.
                if (SYNC.pending.size > 0) await syncFlush();
                // A refusal, or a revision that moved, both mean the local
                // copy is out of date — one re-read puts it back in step.
                const refused = SYNC.needsResync;
                if (rev !== SYNC.rev || refused) {
                    const state = await (await apiFetch('/api/state', { cache: 'no-store' })).json();
                    if (state && typeof state.rev === 'number' && state.collections) {
                        SYNC.rev = state.rev;
                        applyServerState(state.collections);
                        SYNC.needsResync = false;
                    } else {
                        console.warn('Ignoring an unexpected state response from the server.');
                    }
                }
                failedPolls = 0;
                // Stay "offline" while work is still waiting to be accepted.
                if (SYNC.pending.size === 0) syncSetOnline(true);
                SYNC.lastSyncAt = Date.now();
            } catch (err) {
                if (cancelled) return;
                // The browser cancels a request whenever the page is
                // reloaded or the tab is torn down, which looks exactly
                // like an unreachable server. One failed poll is
                // therefore treated as a hiccup the next attempt will
                // fix; only a second one in a row raises the banner.
                failedPolls += 1;
                if (failedPolls > 1) {
                    console.warn('Sync is not reachable:', err.message);
                    syncSetOnline(false);
                }
            } finally {
                pulling = false;
            }
        };

        bootstrap()
            .then((collections) => {
                if (collections) applyServerState(collections);
                syncSetOnline(true);
            })
            .catch((err) => {
                console.error('Bootstrap catch error:', err);
                syncSetOnline(false);
            });

        const timer = setInterval(pull, 3000);
        SYNC.pull = pull;
        const onWake = () => { if (document.visibilityState === 'visible') pull(); };
        document.addEventListener('visibilitychange', onWake);
        window.addEventListener('focus', onWake);

        return () => {
            cancelled = true;
            clearInterval(timer);
            SYNC.pull = null;
            document.removeEventListener('visibilitychange', onWake);
            window.removeEventListener('focus', onWake);
            SYNC.listeners.delete(listener);
        };
    }, [isLoggedIn]);

    /* ------------------ session expiry ------------------
     * Any 401 signs the device out, so a token that lapsed or an
     * account that was deleted lands back on the login screen.
     */
    useEffect(() => {
        AUTH.onExpired = () => {
            setIsLoggedIn(false);
            setCurrentUser(null);
            // Work queued under the lapsed session must not be pushed
            // by whoever signs in next.
            syncClearPending();
        };
        return () => { AUTH.onExpired = null; };
    }, []);

    /* ------------------ auto-login from the saved token ------------------ */
    useEffect(() => {
        const saved = authRead();
        if (!saved) {
            // Drop the session format used before tokens existed.
            localStorage.removeItem('session');
            return;
        }

        // Show the cached account straight away, then confirm with the
        // server so a lapsed token or a removed account signs out.
        AUTH.token = saved.token;
        if (saved.user) {
            setCurrentUser(saved.user);
            setIsLoggedIn(true);
        }

        apiFetch('/api/session')
            .then((res) => (res.ok ? res.json() : null))
            .then((payload) => {
                if (!payload) return;
                setCurrentUser(payload.user);
                setIsLoggedIn(true);
                authRemember(saved.token, payload.user);
            })
            .catch(() => {
                // Offline: keep the cached session and let the sync
                // loop retry. A rejected token signs out above.
            });
    }, []);

    /* ------------------ online/offline detection ------------------ */
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    /* ------------------ expiring change requests ------------------
     * A request the employee never answers must not block the
     * booking forever, so it lapses after two days.
     */
    useEffect(() => {
        const expireStale = () => {
            const now = Date.now();
            const stale = changeRequests.filter((r) => r.status === 'pending'
                && now - new Date(r.requestedAt).getTime() > CHANGE_REQUEST_TTL);
            if (!stale.length) return;

            const ids = new Set(stale.map((r) => r.id));
            setChangeRequests((prev) => prev.map((r) => (ids.has(r.id)
                ? { ...r, status: 'expired', decidedAt: new Date().toISOString(), decidedBy: 'system' }
                : r)));
            stale.forEach((r) => notify(
                r.requestedBy,
                'Request expired',
                r.direction === 'employee'
                    ? `Nobody answered your change request for the ${r.snapshot.type} booking on ${r.snapshot.date} at ${formatTime12h(r.snapshot.time)} within 48 hours, so the booking stays as it is.`
                    : `${r.snapshot.employeeName || 'The employee'} did not answer your ${r.kind} request for the ${r.snapshot.type} booking on ${r.snapshot.date} at ${formatTime12h(r.snapshot.time)} within 48 hours.`,
                { kind: 'decision', requestId: r.id, bookingId: r.bookingId }
            ));
            logAudit('request.expired', `${stale.length} request(s)`, 'No employee answer within 48 hours');
        };

        expireStale();
        const timer = setInterval(expireStale, 60000);
        return () => clearInterval(timer);
    }, [changeRequests]);

    /* ------------------ toasts ------------------ */
    const pushToast = (text, type = 'info') => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        setToasts((prev) => [...prev, { id, text, type }]);
        setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4500);
    };

    // Styled replacement for window.confirm(); the action runs only on Confirm.
    const requestConfirm = (message, onConfirm) => setConfirmRequest({ message, onConfirm });

    /* ------------------ audit trail ------------------
     * A short, append-only record of who changed what, so a booking
     * that moved can always be explained afterwards.
     */
    const logAudit = (action, target, details = '') => {
        setAuditLog((prev) => [...prev, {
            id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            actor: currentUser ? currentUser.username : 'system',
            actorName: currentUser ? (currentUser.name || currentUser.username) : 'System',
            actorRole: currentUser ? roleOf(currentUser) : 'system',
            action,
            target,
            details,
            at: new Date().toISOString()
        }].slice(-400));
    };

    /* ------------------ notifications ------------------ */
    const notify = (to, title, body, extra = {}) => {
        const entry = {
            id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
            to,
            title,
            body,
            createdAt: new Date().toISOString(),
            read: false,
            handled: false,
            ...extra
        };
        // Keeps the list from growing without bound in localStorage.
        setNotifications((prev) => [...prev, entry].slice(-120));
        return entry;
    };

    // Anything an employee does to their own booking is worth telling the
    // team leaders about, so a freed seat is noticed straight away.
    const notifyLeaders = (title, message, extra = {}) => {
        // A team leader who books for themselves is the actor here, so they
        // should not be told about their own action.
        teamLeaders
            .filter((lead) => !currentUser || lead.username !== currentUser.username)
            .forEach((lead) => notify(lead.username, title, message, extra));
    };

    const myNotifications = useMemo(
        () => notifications.filter((n) => {
            if (!currentUser || n.to !== currentUser.username) return false;
            // The bell respects the notification switches in Settings;
            // the records themselves are still kept in the collection.
            if (n.kind === 'approval') return preferences.notifyApprovals;
            if (n.kind === 'decision') return preferences.notifyDecisions;
            return preferences.notifyGeneral;
        }),
        [notifications, currentUser, preferences]
    );

    // Bulk re-distribution applies immediately (no approval) but the affected
    // employees are still told that their bus changed.
    const notifyBusChanges = (before, after) => {
        const previous = new Map(before.map((b) => [b.id, b.bus]));
        after.forEach((b) => {
            const was = previous.get(b.id);
            if (was === b.bus) return;
            notify(
                b.employeeId,
                'Bus changed',
                `Your bus for the ${b.type} booking on ${b.date} at ${formatTime12h(b.time)} changed from ${was || '—'} to ${b.bus}.`,
                { kind: 'info', bookingId: b.id }
            );
        });
    };

    const openBell = () => {
        setBellOpen(true);
        setNotifications((prev) => prev.map((n) => {
            if (!currentUser || n.to !== currentUser.username) return n;
            // A pending approval stays unread so its badge is still visible until decided.
            const awaitingDecision = n.kind === 'approval'
                && changeRequests.some((r) => r.id === n.requestId && r.status === 'pending');
            return awaitingDecision ? n : { ...n, read: true };
        }));
    };

    /* ------------------ auth ------------------ */
    // Custom users override the built-in ones, so a built-in account whose
    // password was changed is resolved from its stored override.
    // Accounts the admin removed are hidden until they are created again.
    const allUsers = useMemo(() => {
        const removed = new Set(removedUsers);
        const overridden = new Set(customUsers.map((u) => u.username));
        return DEFAULT_USERS
            .filter((u) => !overridden.has(u.username) && !removed.has(u.username))
            .concat(customUsers.filter((u) => !removed.has(u.username)));
    }, [customUsers, removedUsers]);

    // Last-minute edits are routed to the team leaders, so they are resolved by name.
    const teamLeaders = useMemo(
        () => allUsers.filter((u) => roleOf(u) === 'teamlead'),
        [allUsers]
    );

    const handleLogin = async (e) => {
        e.preventDefault();

        const username = loginData.username.trim();
        const password = loginData.password;

        if (!username || !password) {
            setError('Please enter your username and password.');
            return;
        }

        let payload;
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password, remember: rememberMe })
            });
            payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                setLoginNotice('');
                setError(payload.error || 'Invalid username or password');
                return;
            }
        } catch (err) {
            setLoginNotice('');
            setError('Cannot reach the server. Check your connection and try again.');
            return;
        }

        let user = payload.user;
        AUTH.token = payload.token;

        // "Remember me" is what makes the session outlive the tab.
        localStorage.setItem('rememberMe', rememberMe.toString());
        if (rememberMe) authRemember(payload.token, user);
        else authForget();

        // An account still stored with a plain-text password is turned
        // into a salted hash the first time its owner signs in.
        if (payload.legacy) {
            const upgraded = await withHashedPassword({ ...user, password });
            if (isHashed(upgraded)) {
                user = upgraded;
                setCustomUsers((prev) => [...prev.filter((u) => u.username !== user.username), user]);
                setRemovedUsers((prev) => prev.filter((u) => u !== user.username));
            }
        }

        setIsLoggedIn(true);
        setCurrentUser(user);
        setError('');
        setLoginNotice('');
        setLoginData({ username: '', password: '' });
    };

    /* ------------------ forgot password ------------------ */
    const handleForgotPassword = () => {
        const username = loginData.username.trim();
        if (!username) {
            setLoginNotice('Type your username above, then press "Forgot password".');
            return;
        }

        const account = allUsers.find((u) => u.username === username);
        const alreadyOpen = passwordRequests.some((r) => r.status === 'open' && r.username === username);

        // The message never reveals whether the username exists.
        if (account && !alreadyOpen) {
            setPasswordRequests((prev) => [
                ...prev,
                {
                    id: `req-${Date.now()}`,
                    username: account.username,
                    name: account.name,
                    requestedAt: new Date().toISOString(),
                    status: 'open',
                    resolvedAt: null,
                    resolvedBy: null
                }
            ]);
        }

        setError('');
        // The same neutral answer is shown either way, so the screen never
        // reveals whether a username exists or was already requested.
        setLoginNotice('If the account exists, a reset request was sent to the administrator.');
    };

    /* ------------------ forced password change ------------------ */
    // The account is already authenticated, so only the new password is asked for —
    // the temporary password does not have to be typed again.
    const handleChangePassword = async (e) => {
        e.preventDefault();
        const { next, confirm } = pwdForm;

        if (!next || !confirm) {
            setPwdFeedback({ type: 'error', text: 'Please fill in both fields.' });
            return;
        }
        if (next.length < 6) {
            setPwdFeedback({ type: 'error', text: 'The new password must be at least 6 characters long.' });
            return;
        }
        if (next !== confirm) {
            setPwdFeedback({ type: 'error', text: 'The two new passwords do not match.' });
            return;
        }

        const updated = await withHashedPassword({ ...currentUser, password: next });
        if (!isHashed(updated)) {
            setPwdFeedback({ type: 'error', text: 'A secure connection (https or localhost) is required to change the password.' });
            return;
        }
        delete updated.mustChangePassword;
        delete updated.tempPasswordExpiresAt;

        // Upsert: this also overrides a built-in account with the stored copy.
        setCustomUsers((prev) => [...prev.filter((u) => u.username !== updated.username), updated]);
        setCurrentUser(updated);
        setPwdForm({ next: '', confirm: '' });
        setPwdFeedback({ type: '', text: '' });
        pushToast('Your password has been updated.', 'success');
    };

    /* ------------------ admin: password reset ------------------ */
    const openRequests = useMemo(
        () => passwordRequests.filter((r) => r.status === 'open'),
        [passwordRequests]
    );

    // Change requests still waiting for an employee answer.
    const pendingChangeCount = useMemo(
        () => changeRequests.filter((r) => r.status === 'pending').length,
        [changeRequests]
    );

    const handleResetPassword = async (requestId) => {
        const request = openRequests.find((r) => r.id === requestId);
        if (!request) return;

        const account = allUsers.find((u) => u.username === request.username);
        if (!account) {
            pushToast(`The account "${request.username}" no longer exists.`, 'error');
            setPasswordRequests((prev) => prev.map((r) => (
                r.id === requestId ? { ...r, status: 'resolved', resolvedAt: new Date().toISOString(), resolvedBy: currentUser.username } : r
            )));
            return;
        }

        const temporaryPassword = generateTempPassword();
        const updated = await withHashedPassword({ ...account, password: temporaryPassword });
        if (!isHashed(updated)) {
            pushToast('A secure connection (https or localhost) is required for this action.', 'error');
            return;
        }
        updated.mustChangePassword = true;
        updated.tempPasswordExpiresAt = Date.now() + TEMP_PASSWORD_TTL;

        setCustomUsers((prev) => [...prev.filter((u) => u.username !== updated.username), updated]);
        setRemovedUsers((prev) => prev.filter((u) => u !== updated.username));
        setPasswordRequests((prev) => prev.map((r) => (
            r.id === requestId ? { ...r, status: 'resolved', resolvedAt: new Date().toISOString(), resolvedBy: currentUser.username } : r
        )));
        // Shown to the admin once; only the hash is kept afterwards.
        setTempPasswordReveal({
            name: account.name,
            username: account.username,
            password: temporaryPassword,
            expiresAt: updated.tempPasswordExpiresAt
        });
        logAudit('user.password_reset', account.username, 'Temporary password issued, valid for 24 hours');
    };

    const handleDismissRequest = (requestId) => {
        const request = openRequests.find((r) => r.id === requestId);
        if (!request) return;
        requestConfirm(`Discard the password reset request from "${request.name}"?`, () => {
            setPasswordRequests((prev) => prev.map((r) => (
                r.id === requestId ? { ...r, status: 'dismissed', resolvedAt: new Date().toISOString(), resolvedBy: currentUser.username } : r
            )));
            pushToast('Request discarded.', 'success');
        });
    };

    const handleCopyTempPassword = async () => {
        try {
            await navigator.clipboard.writeText(tempPasswordReveal.password);
            pushToast('Temporary password copied.', 'success');
        } catch (err) {
            pushToast('Copy failed — please select the password manually.', 'error');
        }
    };

    const handleSignOut = () => {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setAdminView('bookings');
        setLeaderMode('dashboard');
        setActiveTab('arrival');
        setPwdForm({ next: '', confirm: '' });
        setPwdFeedback({ type: '', text: '' });
        setLoginNotice('');
        // Drop the token so the next visit has to sign in again, and
        // throw away work this session never managed to send — it
        // belongs to the account that is leaving.
        authClear();
        syncClearPending();
        localStorage.removeItem('rememberMe');
        setRememberMe(false);
    };

    /* ------------------ booking ------------------ */
    const handleBooking = (e) => {
        e.preventDefault();

        // Taken automatically from the signed-in account (DEFAULT_USERS or a custom user).
        const employeeName = (currentUser.name || '').trim();
        const employeeId = currentUser.username;
        const type = activeTab === 'arrival' ? 'Arrival' : 'Departure';
        const time = formData.time;
        const date = formData.date;

        if (!time) {
            pushToast('Please select a time.', 'error');
            return;
        }

        if (date < todayISO()) {
            pushToast('The booking date cannot be in the past.', 'error');
            return;
        }

        // Admin rule: how far ahead a booking may be placed.
        const maxAdvanceDays = LIVE_SETTINGS.bookingRules.maxAdvanceDays;
        if (maxAdvanceDays > 0) {
            const limit = new Date(`${todayISO()}T00:00:00`);
            limit.setDate(limit.getDate() + maxAdvanceDays);
            if (new Date(`${date}T00:00:00`) > limit) {
                pushToast(`Bookings can only be made up to ${maxAdvanceDays} day(s) ahead.`, 'error');
                return;
            }
        }

        if (LIVE_SETTINGS.bookingRules.oneBookingPerDay) {
            const dayExists = bookings.some(
                (b) => b.employeeId === employeeId && b.date === date
            );
            if (dayExists) {
                pushToast('You already have a booking for this day. Please delete it first if you want to change it.', 'error');
                return;
            }
        }

        const base = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            employeeName,
            employeeId,
            type,
            location: formData.dropOffLocation.trim(),
            time,
            date,
            createdBy: currentUser.username,
            bookedAt: new Date().toISOString()
        };
        const booking = { ...base, bus: assignBus(base, bookings, buses) };

        setBookings((prev) => [...prev, booking]);
        logAudit('booking.create', `${employeeName} — ${date} ${formatTime12h(time)}`, `${type} booking, bus ${booking.bus}`);
        pushToast(`Booking confirmed for ${employeeName} — ${date} at ${time} (${booking.bus}).`, 'success');
        setFormData((prev) => ({ ...prev, dropOffLocation: '', time: '' }));
        setSelectedRoad(null);
    };

    const userBookings = useMemo(() => {
        if (!currentUser) return [];
        return bookings.filter((b) => b.employeeId === currentUser.username)
            .sort((a, b) => new Date(b.date + ' ' + b.time) - new Date(a.date + ' ' + a.time));
    }, [bookings, currentUser]);

    const currentRole = roleOf(currentUser);
    const isAdmin = currentRole === 'admin';
    const isTeamLead = currentRole === 'teamlead';

    // Mirrored on every render into the module-level copies the plain
    // helpers read (time format, shift presets, leave defaults), so the
    // first paint already reflects the current choices. Memoised so the
    // settings panel does not see a fresh object on every render.
    const appSettings = useMemo(() => normalizeSettingsRecord(settings[0]), [settings]);
    setLiveSettings(appSettings);
    setLivePreferences(preferences);

    // The default tab preference only decides where the booking form
    // opens — the user can still switch at any time afterwards.
    useEffect(() => {
        if (isLoggedIn) setActiveTab(LIVE_PREFERENCES.defaultTab);
    }, [isLoggedIn]);

    // An IT admin always runs their console; a team leader chooses between
    // the dashboard and their own booking screen.
    const showDashboard = isAdmin || (isTeamLead && leaderMode === 'dashboard');

    // A team leader holds the approval authority, so nothing of their own
    // needs signing off — it is applied directly and the others are told.
    const approvalRequired = (booking, next) => needsLeaderApproval(booking, next) && !isTeamLead;

    // Where the sheet stands: draft, marked ready to print, or locked once
    // the team leader has printed it and the buses have been ordered.
    const sheet = sheetState[0] || { status: 'draft' };
    const sheetStatus = SHEET_STATUS[sheet.status] ? sheet.status : 'draft';
    const sheetLocked = sheetStatus === 'locked';
    const setSheetStatus = (status) => {
        const who = currentUser.name || currentUser.username;
        setSheetState([{ id: 'sheet', status, updatedAt: new Date().toISOString(), updatedBy: who }]);
    };

    // The team leader reviews every booking; the IT admin never opens the
    // sheet, so the "waiting to be sent" tally is only meaningful for them.
    const reviewBookings = bookings;
    const pendingReviewCount = 0;

    /* ------------------ team leader: bookings ------------------ */
    const filteredBookings = useMemo(() => {
        const q = filters.q.trim().toLowerCase();
        return reviewBookings.filter((b) => {
            const date = b.date || '';
            if (filters.from && date < filters.from) return false;
            if (filters.to && date > filters.to) return false;
            if (!q) return true;
            return [b.employeeName, b.employeeId, b.location, b.bus, b.type]
                .some((v) => String(v == null ? '' : v).toLowerCase().includes(q));
        });
    }, [reviewBookings, filters]);

    const dayGroups = useMemo(() => groupByDay(filteredBookings), [filteredBookings]);
    const busNames = buses.map((b) => b.name);

    // Seats are physical, so the fleet panel counts every booking — the same
    // list "Auto-assign buses" operates on, not only the forwarded ones.
    const busUsage = useMemo(() => {
        const map = {};
        buses.forEach((b) => { map[b.name] = 0; });
        bookings.forEach((b) => { if (b.bus && map[b.bus] != null) map[b.bus] += 1; });
        return map;
    }, [bookings, buses]);

    const waitlistCount = bookings.filter((b) => !b.bus || b.bus === WAITLIST).length;

    const exportFileName = () => {
        const stamp = (filters.from || filters.to)
            ? `${filters.from || 'start'}_to_${filters.to || 'end'}`
            : todayISO();
        return `Alorica_Bookings_${stamp}.xlsx`;
    };

    const buildFilteredWorkbook = () => buildWorkbook(filteredBookings, buses);

    const handleSaveExcel = async () => {
        if (!filteredBookings.length) {
            pushToast('There are no bookings to export for the current filters.', 'error');
            return;
        }
        try {
            await ensureXlsx();
        } catch (err) {
            pushToast(err.message, 'error');
            return;
        }
        XLSX.writeFile(buildFilteredWorkbook(), exportFileName());
        pushToast(`Exported ${filteredBookings.length} bookings to ${exportFileName()}.`, 'success');
    };

    const handleShare = async () => {
        if (!filteredBookings.length) {
            pushToast('There are no bookings to share for the current filters.', 'error');
            return;
        }
        try {
            await ensureXlsx();
        } catch (err) {
            pushToast(err.message, 'error');
            return;
        }
        const wb = buildFilteredWorkbook();
        const fileName = exportFileName();
        const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const file = new File([buffer], fileName, { type: XLSX_MIME });

        setSharing(true);
        try {
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: 'Alorica Bookings',
                    text: 'Alorica employee transportation bookings'
                });
            } else {
                XLSX.writeFile(wb, fileName);
                pushToast('Direct file sharing is not supported on this device. The file was downloaded instead — share it from Downloads via WhatsApp, Telegram, Messenger or Bluetooth.', 'info');
            }
        } catch (err) {
            if (!err || err.name !== 'AbortError') {
                pushToast('Sharing failed: ' + (err ? err.message : 'unknown error'), 'error');
            }
        } finally {
            setSharing(false);
        }
    };

    const shareSummaryText = () => {
        const groups = groupByDay(filteredBookings);
        const lines = [`Alorica — Employee Transportation`, `Bookings: ${filteredBookings.length} | Days: ${groups.length} | Employees: ${uniqueEmployeeCount(filteredBookings)}`];
        groups.forEach(({ day, items }) => lines.push(`${day}: ${items.length} booking(s)`));
        if (waitlistCount) lines.push(`Waitlisted: ${waitlistCount}`);
        return lines.join('\n');
    };

    const handlePrint = () => {
        if (!filteredBookings.length) {
            pushToast('There are no bookings to print for the current filters.', 'error');
            return;
        }
        const frame = document.createElement('iframe');
        frame.setAttribute('aria-hidden', 'true');
        frame.style.position = 'fixed';
        frame.style.right = '0';
        frame.style.bottom = '0';
        frame.style.width = '0';
        frame.style.height = '0';
        frame.style.border = '0';
        document.body.appendChild(frame);

        const win = frame.contentWindow;
        win.document.open();
        win.document.write(buildPrintHtml(filteredBookings));
        win.document.close();

        // Guarded cleanup: the frame can already be gone when the timers fire.
        const dropFrame = () => {
            if (frame.parentNode) frame.parentNode.removeChild(frame);
        };

        setTimeout(() => {
            win.focus();
            win.print();
            setTimeout(dropFrame, 1500);
        }, 300);

        // Printing is the team leader's final confirmation: the vendors are
        // ordering buses off this sheet, so it is locked afterwards.
        if (sheetStatus !== 'locked') {
            setSheetStatus('locked');
            logAudit('sheet.printed', `${filteredBookings.length} booking(s)`, `Printed and locked by ${currentUser.name || currentUser.username}`);
            notifyLeaders(
                'Sheet printed and locked',
                `${currentUser.name || currentUser.username} printed the booking sheet. It is now locked — reopen it before making further changes.`,
                { kind: 'info' }
            );
        }
    };

    /* ------------------ vacation management ------------------ */
    const handleVacationRequest = (data) => {
        const newVacation = {
            id: `vac-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            ...data,
            status: 'pending',
            requestedAt: new Date().toISOString(),
            decidedAt: null,
            decidedBy: null,
            comments: ''
        };

        setVacations([...vacations, newVacation]);
        setShowVacationForm(false);
        pushToast('Leave request submitted successfully.', 'success');

        // Notify team leaders
        notifyLeaders(
            'New leave request',
            `${data.employeeName} requested ${VACATION_TYPES[data.type]?.label || data.type} from ${data.startDate} to ${data.endDate} (${data.days} day${data.days > 1 ? 's' : ''})`,
            { kind: 'approval', requestId: newVacation.id }
        );
    };

    const handleCancelVacation = (id) => {
        const vacation = vacations.find(v => v.id === id);
        if (!vacation || vacation.status !== 'pending') return;

        requestConfirm(
            'Cancel this leave request?',
            () => {
                setVacations(vacations.filter(v => v.id !== id));
                pushToast('Leave request cancelled.', 'success');
            }
        );
    };

    const handleApproveVacation = (id) => {
        const vacation = vacations.find(v => v.id === id);
        if (!vacation) return;

        // Other requests may have been approved since this one arrived, so the
        // balance has to be re-checked right before the leave is actually granted.
        const currentBalance = vacationBalances.find(b => b.employeeId === vacation.employeeId)
            || freshVacationBalance(vacation.employeeId);
        const availableDays = vacation.type === 'annual' ? currentBalance.annual - currentBalance.usedAnnual
            : vacation.type === 'sick' ? currentBalance.sick - currentBalance.usedSick
            : vacation.type === 'personal' ? currentBalance.personal - currentBalance.usedPersonal
            : Infinity;

        if (vacation.days > availableDays) {
            pushToast(
                `Cannot approve — only ${availableDays} day(s) of ${VACATION_TYPES[vacation.type]?.label || vacation.type} left for ${vacation.employeeName || vacation.employeeId}.`,
                'error'
            );
            return;
        }

        // Update vacation status
        const updatedVacations = vacations.map(v => 
            v.id === id 
                ? { 
                    ...v, 
                    status: 'approved', 
                    decidedAt: new Date().toISOString(), 
                    decidedBy: currentUser.username 
                }
                : v
        );
        setVacations(updatedVacations);

        // Update balance. The record is replaced rather than mutated in
        // place: the sync layer diffs the new collection against the copy
        // it holds, and an object changed in place looks identical to it,
        // so the deduction would never be queued for the server.
        const existingBalance = vacationBalances.find(b => b.employeeId === vacation.employeeId);
        const balance = existingBalance
            ? { ...existingBalance }
            : freshVacationBalance(vacation.employeeId);

        if (vacation.type === 'annual') balance.usedAnnual += vacation.days;
        else if (vacation.type === 'sick') balance.usedSick += vacation.days;
        else if (vacation.type === 'personal') balance.usedPersonal += vacation.days;

        setVacationBalances(existingBalance
            ? vacationBalances.map(b => (b.employeeId === vacation.employeeId ? balance : b))
            : [...vacationBalances, balance]);

        // The employee is away on those dates, so their own bookings inside the
        // range cannot stand any more — the seats go back to the pool.
        let promoted = 0;
        const clashing = bookings.filter(
            (b) => b.employeeId === vacation.employeeId
                && b.date >= vacation.startDate
                && b.date <= vacation.endDate
        );

        if (clashing.length) {
            const remaining = bookings.filter((b) => !clashing.includes(b));
            const next = redistribute(remaining, buses);
            promoted = countPromotions(remaining, next);
            setBookings(next);
            notifyBusChanges(remaining, next);

            notify(
                vacation.employeeId,
                'Bookings cancelled for your leave',
                `${clashing.length} booking(s) inside your approved leave (${vacation.startDate} to ${vacation.endDate}) were cancelled: ${clashing.map((b) => `${b.date} ${formatTime12h(b.time)}`).join(', ')}.`,
                { kind: 'info' }
            );
        }

        logAudit(
            'vacation.approve',
            `${vacation.employeeName || vacation.employeeId} — ${vacation.startDate} → ${vacation.endDate}`,
            clashing.length
                ? `${clashing.length} conflicting booking(s) cancelled, ${promoted} waitlisted employee(s) promoted`
                : 'No conflicting bookings'
        );

        pushToast(
            clashing.length
                ? `Leave approved. ${clashing.length} conflicting booking(s) cancelled.`
                : 'Leave request approved.',
            'success'
        );

        // Notify employee
        notify(
            vacation.employeeId,
            'Leave request approved',
            `Your ${VACATION_TYPES[vacation.type]?.label || vacation.type} from ${vacation.startDate} to ${vacation.endDate} has been approved.`,
            { kind: 'decision' }
        );
    };

    const handleRejectVacation = (id) => {
        const vacation = vacations.find(v => v.id === id);
        if (!vacation) return;

        const updatedVacations = vacations.map(v => 
            v.id === id 
                ? { 
                    ...v, 
                    status: 'rejected', 
                    decidedAt: new Date().toISOString(), 
                    decidedBy: currentUser.username 
                }
                : v
        );
        setVacations(updatedVacations);
        pushToast('Leave request rejected.', 'success');

        // Notify employee
        notify(
            vacation.employeeId,
            'Leave request declined',
            `Your ${VACATION_TYPES[vacation.type]?.label || vacation.type} from ${vacation.startDate} to ${vacation.endDate} has been declined.`,
            { kind: 'decision' }
        );
    };

    const handleExportVacationExcel = async () => {
        try {
            await ensureXlsx();
        } catch (err) {
            pushToast(err.message, 'error');
            return;
        }
        const wb = XLSX.utils.book_new();
        const wsData = [
            ['Employee Name', 'Employee ID', 'Type', 'Start Date', 'End Date', 'Days', 'Status', 'Requested At', 'Decided At', 'Decided By', 'Reason', 'Comments']
        ];

        vacations.forEach(v => {
            wsData.push([
                v.employeeName,
                v.employeeId,
                VACATION_TYPES[v.type]?.label || v.type,
                v.startDate,
                v.endDate,
                v.days,
                VACATION_STATUS[v.status]?.label || v.status,
                new Date(v.requestedAt).toLocaleString(),
                v.decidedAt ? new Date(v.decidedAt).toLocaleString() : '',
                v.decidedBy || '',
                v.reason || '',
                v.comments || ''
            ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(wsData);
        XLSX.utils.book_append_sheet(wb, ws, 'Leave Requests');

        // Add balance sheet
        const balanceData = [
            ['Employee ID', 'Annual Balance', 'Annual Used', 'Sick Balance', 'Sick Used', 'Personal Balance', 'Personal Used']
        ];
        vacationBalances.forEach(b => {
            balanceData.push([
                b.employeeId,
                b.annual,
                b.usedAnnual,
                b.sick,
                b.usedSick,
                b.personal,
                b.usedPersonal
            ]);
        });
        const balanceWs = XLSX.utils.aoa_to_sheet(balanceData);
        XLSX.utils.book_append_sheet(wb, balanceWs, 'Balances');

        XLSX.writeFile(wb, `alorica-leave-report-${todayISO()}.xlsx`);
        pushToast('Leave report exported successfully.', 'success');
    };

    /* ------------------ bookings: employee actions ------------------ */
    const handleDeleteBooking = (id) => {
        const target = bookings.find((b) => b.id === id);
        if (!target) return;

        // Employees manage their own bookings only; the team leader goes through a request.
        if (target.employeeId !== currentUser.username) {
            pushToast('You can only delete your own bookings.', 'error');
            return;
        }
        if (findPendingChange(target.id)) {
            pushToast('A change for this booking is already waiting for approval.', 'error');
            return;
        }

        if (approvalRequired(target)) {
            createEmployeeRequest(target, 'delete', [
                { field: 'deleted', label: 'Booking', from: 'Active', to: 'Cancelled' }
            ]);
            return;
        }

        requestConfirm(
            `Delete the booking for ${target.employeeName || 'this employee'} on ${target.date}?`,
            () => {
                const remaining = bookings.filter((b) => b.id !== id);
                const next = redistribute(remaining, buses);
                const promoted = countPromotions(remaining, next);
                setBookings(next);
                notifyBusChanges(remaining, next);
                logAudit('booking.delete', `${target.employeeName || target.employeeId} — ${target.date} ${formatTime12h(target.time)}`, 'Deleted by the employee');
                notifyLeaders(
                    'Booking cancelled',
                    `${target.employeeName || target.employeeId} cancelled their ${target.type} booking on ${target.date} at ${formatTime12h(target.time)} — the seat is free.`,
                    { kind: 'info', bookingId: target.id }
                );
                pushToast(
                    promoted
                        ? `Booking deleted. ${promoted} waitlisted employee(s) moved to a bus.`
                        : 'Booking deleted.',
                    'success'
                );
            }
        );
    };

    /* ------------------ bookings: employee edits ------------------
     * A booking can be corrected instead of deleted and recreated.
     * More than an hour before the pickup the employee fixes it
     * outright; any later and the team leader has to approve it.
     * The same one-hour rule guards cancellation, so the two paths
     * can never disagree about what counts as "too late".
     */
    const openEditBooking = (booking) => {
        if (booking.employeeId !== currentUser.username) {
            pushToast('You can only edit your own bookings.', 'error');
            return;
        }
        if (findPendingChange(booking.id)) {
            pushToast('A change for this booking is already waiting for approval.', 'error');
            return;
        }
        setEditingBooking(booking);
    };

    // Only the fields the employee actually touched, so the team leader
    // sees exactly what is being asked for.
    const bookingDiff = (booking, next) => {
        const diffs = [];
        if (next.type !== booking.type) diffs.push({ field: 'type', label: 'Direction', from: booking.type, to: next.type });
        if (next.date !== booking.date) diffs.push({ field: 'date', label: 'Date', from: booking.date, to: next.date });
        if (next.time !== booking.time) diffs.push({ field: 'time', label: 'Time', from: booking.time, to: next.time });
        if (next.location !== (booking.location || '')) diffs.push({ field: 'location', label: 'Location', from: booking.location, to: next.location });
        return diffs;
    };

    // The employee asking for something they are no longer allowed to do
    // themselves. Mirrors the team leader's request, one direction over.
    const createEmployeeRequest = (booking, kind, changes) => {
        const request = {
            id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            bookingId: booking.id,
            direction: 'employee',
            kind,
            changes,
            snapshot: {
                employeeName: booking.employeeName,
                date: booking.date,
                time: booking.time,
                type: booking.type,
                location: booking.location,
                bus: booking.bus
            },
            requestedBy: currentUser.username,
            requestedByName: currentUser.name || currentUser.username,
            requestedAt: new Date().toISOString(),
            status: 'pending',
            decidedAt: null,
            decidedBy: null
        };
        setChangeRequests((prev) => [...prev, request]);
        logAudit(
            kind === 'delete' ? 'request.employee_delete' : 'request.employee_edit',
            `${booking.employeeName || booking.employeeId} — ${booking.date} ${formatTime12h(booking.time)}`,
            `${request.requestedByName} asked for a last-minute ${kind === 'delete' ? 'cancellation' : 'change'} of their own booking`
        );
        notifyLeaders(
            kind === 'delete' ? 'Cancellation request' : 'Booking change request',
            `${request.requestedByName} needs to ${kind === 'delete' ? `cancel their ${booking.type} booking` : `change their ${booking.type} booking`} on ${booking.date} at ${formatTime12h(booking.time)} — less than an hour is left. Open your notifications to approve or decline.`,
            { kind: 'approval', requestId: request.id, bookingId: booking.id }
        );
        pushToast('Request sent to your team leader for approval.', 'success');
    };

    const handleEditBooking = (next) => {
        const booking = editingBooking;
        setEditingBooking(null);
        if (!booking) return;

        const diffs = bookingDiff(booking, next);
        if (!diffs.length) {
            pushToast('Nothing was changed.', 'error');
            return;
        }

        // One booking per day stays the rule, even when the day moves.
        const sameDay = bookings.some((b) => (
            b.id !== booking.id && b.employeeId === booking.employeeId && b.date === next.date
        ));
        if (sameDay) {
            pushToast('You already have a booking on that day.', 'error');
            return;
        }

        if (approvalRequired(booking, next)) {
            createEmployeeRequest(booking, 'update', diffs);
            return;
        }

        // The bus is kept: it is the rented vehicle the employee already has.
        setBookings((prev) => prev.map((b) => (b.id === booking.id ? { ...b, ...next } : b)));
        logAudit(
            'booking.edit',
            `${booking.employeeName || booking.employeeId} — ${next.date} ${formatTime12h(next.time)}`,
            `Edited by the employee, bus ${booking.bus} kept`
        );
        notifyLeaders(
            'Booking changed',
            `${booking.employeeName || booking.employeeId} changed their ${next.type} booking from ${booking.date} ${formatTime12h(booking.time)} to ${next.date} ${formatTime12h(next.time)}.`,
            { kind: 'info', bookingId: booking.id }
        );
        pushToast('Booking updated.', 'success');
    };

    /* ------------------ team leader: change requests ------------------ */
    // Nothing the team leader changes takes effect until the employee approves it.
    const findPendingChange = (bookingId) => changeRequests.find(
        (r) => r.bookingId === bookingId && r.status === 'pending'
    );

    const createChangeRequest = (booking, kind, changes, summary) => {
        // Managing bookings is the team leader's job; the admin does not touch them.
        if (!isTeamLead) {
            pushToast('Only a team leader can request booking changes.', 'error');
            return;
        }
        if (findPendingChange(booking.id)) {
            pushToast('A change for this booking is already waiting for the employee.', 'error');
            return;
        }

        const request = {
            id: `chg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            bookingId: booking.id,
            kind,
            changes,
            snapshot: {
                employeeName: booking.employeeName,
                date: booking.date,
                time: booking.time,
                type: booking.type,
                location: booking.location,
                bus: booking.bus
            },
            requestedBy: currentUser.username,
            requestedByName: currentUser.name || currentUser.username,
            requestedAt: new Date().toISOString(),
            status: 'pending',
            decidedAt: null,
            decidedBy: null
        };

        setChangeRequests((prev) => [...prev, request]);
        logAudit(
            kind === 'delete' ? 'request.delete' : 'request.update',
            `${booking.employeeName || booking.employeeId} — ${booking.date} ${formatTime12h(booking.time)}`,
            `${request.requestedByName} asked the employee to ${summary}`
        );
        notify(
            booking.employeeId,
            kind === 'delete' ? 'Deletion request' : 'Change request',
            `${request.requestedByName} (Team Leader) wants to ${summary} for your ${booking.type} booking on ${booking.date} at ${formatTime12h(booking.time)}. Open your notifications to approve or decline.`,
            { kind: 'approval', requestId: request.id, bookingId: booking.id }
        );
        pushToast('Request sent to the employee for approval.', 'success');
    };

    const handleRequestBusChange = (id, busName) => {
        const booking = bookings.find((b) => b.id === id);
        if (!booking || booking.bus === busName) return;
        createChangeRequest(
            booking,
            'update',
            [{ field: 'bus', label: 'Bus', from: booking.bus, to: busName }],
            `change the bus from ${booking.bus} to ${busName}`
        );
    };

    const handleRequestBookingDelete = (id) => {
        const booking = bookings.find((b) => b.id === id);
        if (!booking) return;

        requestConfirm(
            `Ask ${booking.employeeName || 'this employee'} to approve deleting their booking on ${booking.date}? The booking is only removed once they approve.`,
            () => createChangeRequest(
                booking,
                'delete',
                [{ field: 'deleted', label: 'Booking', from: 'Active', to: 'Deleted' }],
                'delete it'
            )
        );
    };

    // Runs as the employee: the change is applied here and the team leader is told the outcome.
    const decideChangeRequest = (requestId, approved) => {
        const request = changeRequests.find((r) => r.id === requestId);
        if (!request || request.status !== 'pending') {
            pushToast('This request has already been handled.', 'error');
            return;
        }
        // Only the employee whose booking is affected may approve it.
        if (request.requestedBy === currentUser.username) {
            pushToast('You cannot approve your own request.', 'error');
            return;
        }
        // A last-minute edit asked for by an employee is the team leader's call.
        if (request.direction === 'employee' && !isTeamLead) {
            pushToast('Only a team leader can answer this request.', 'error');
            return;
        }

        const booking = bookings.find((b) => b.id === request.bookingId);

        if (approved && booking) {
            if (request.kind === 'delete') {
                const remaining = bookings.filter((b) => b.id !== booking.id);
                const next = redistribute(remaining, buses);
                const promoted = countPromotions(remaining, next);
                setBookings(next);
                notifyBusChanges(remaining, next);
                if (promoted) pushToast(`${promoted} waitlisted employee(s) moved to a bus.`, 'success');
            } else {
                const patch = {};
                request.changes.forEach((c) => { patch[c.field] = c.to; });
                setBookings((prev) => prev.map((b) => {
                    if (b.id !== booking.id) return b;
                    // The employee keeps their rented bus; only a leader's
                    // bus change is pinned as a manual assignment.
                    return request.direction === 'employee'
                        ? { ...b, ...patch }
                        : { ...b, ...patch, busManual: true };
                }));
            }
        }

        setChangeRequests((prev) => prev.map((r) => (
            r.id === requestId
                ? { ...r, status: approved ? 'approved' : 'rejected', decidedAt: new Date().toISOString(), decidedBy: currentUser.name || currentUser.username }
                : r
        )));

        // The employee's own approval notification is done with.
        setNotifications((prev) => prev.map((n) => (
            n.requestId === requestId ? { ...n, handled: true, read: true } : n
        )));

        notify(
            request.requestedBy,
            approved ? 'Change approved' : 'Change declined',
            request.direction === 'employee'
                ? `${currentUser.name || currentUser.username} (Team Leader) ${approved ? 'approved' : 'declined'} the change to your ${request.snapshot.type} booking on ${request.snapshot.date} at ${formatTime12h(request.snapshot.time)}.`
                : `${currentUser.name || currentUser.username} ${approved ? 'approved' : 'declined'} your request for their ${request.snapshot.type} booking on ${request.snapshot.date} at ${formatTime12h(request.snapshot.time)}.`,
            { kind: 'decision', requestId, bookingId: request.bookingId }
        );

        logAudit(
            approved ? 'request.approved' : 'request.rejected',
            `${request.snapshot.employeeName || request.bookingId} — ${request.snapshot.date} ${formatTime12h(request.snapshot.time)}`,
            request.direction === 'employee'
                ? `${currentUser.name || currentUser.username} answered ${request.requestedByName}'s own edit request`
                : `${currentUser.name || currentUser.username} answered ${request.requestedByName}'s ${request.kind} request`
        );

        pushToast(approved ? 'Change approved and applied.' : 'Change declined.', approved ? 'success' : 'error');
    };

    // The team leader's emergency path: apply their own pending request right
    // away instead of waiting for the employee, with a reason left on record
    // and the employee told exactly what happened and why.
    const handleOverrideRequest = (requestId, reason) => {
        if (!isTeamLead) {
            pushToast('Only a team leader can override a request.', 'error');
            return;
        }
        const request = changeRequests.find((r) => r.id === requestId);
        if (!request || request.status !== 'pending') {
            pushToast('This request has already been handled.', 'error');
            return;
        }
        if (request.direction === 'employee') {
            pushToast("An employee's own request cannot be overridden — answer it instead.", 'error');
            return;
        }
        const booking = bookings.find((b) => b.id === request.bookingId);
        if (!booking) {
            pushToast('The booking no longer exists.', 'error');
            return;
        }

        if (request.kind === 'delete') {
            const remaining = bookings.filter((b) => b.id !== booking.id);
            const next = redistribute(remaining, buses);
            const promoted = countPromotions(remaining, next);
            setBookings(next);
            notifyBusChanges(remaining, next);
            if (promoted) pushToast(`${promoted} waitlisted employee(s) moved to a bus.`, 'success');
        } else {
            const patch = {};
            request.changes.forEach((c) => { patch[c.field] = c.to; });
            setBookings((prev) => prev.map((b) => (
                b.id === booking.id ? { ...b, ...patch, busManual: true } : b
            )));
        }

        const decidedBy = currentUser.name || currentUser.username;
        setChangeRequests((prev) => prev.map((r) => (
            r.id === requestId
                ? { ...r, status: 'overridden', overrideReason: reason, decidedAt: new Date().toISOString(), decidedBy }
                : r
        )));

        // The employee's approval notification is now moot.
        setNotifications((prev) => prev.map((n) => (
            n.requestId === requestId ? { ...n, handled: true, read: true } : n
        )));

        notify(
            booking.employeeId,
            'Booking changed by override',
            `${decidedBy} (Team Leader) applied the change to your ${request.snapshot.type} booking on ${request.snapshot.date} at ${formatTime12h(request.snapshot.time)} without waiting for approval. Reason: ${reason}`,
            { kind: 'decision', requestId, bookingId: booking.id }
        );

        logAudit(
            'request.override',
            `${request.snapshot.employeeName || booking.employeeId} — ${request.snapshot.date} ${formatTime12h(request.snapshot.time)}`,
            `Emergency override by ${decidedBy} — ${reason}`
        );

        pushToast('Override applied and the employee was notified.', 'success');
    };

    // A freed seat should be taken by whoever is on the waitlist for that day.
    const countPromotions = (before, after) => {
        const previous = new Map(before.map((b) => [b.id, b.bus]));
        return after.filter((b) => {
            const was = previous.get(b.id);
            return (!was || was === WAITLIST) && b.bus && b.bus !== WAITLIST;
        }).length;
    };

    // Re-assigns buses after seat availability changes, then reports who left the waitlist.
    const applyDistribution = (nextBookings, nextBuses, emptyMessage) => {
        const redistributed = redistribute(nextBookings, nextBuses);
        const promoted = countPromotions(nextBookings, redistributed);
        setBuses(nextBuses);
        setBookings(redistributed);
        notifyBusChanges(nextBookings, redistributed);
        if (promoted) pushToast(`${promoted} waitlisted employee(s) moved to a bus.`, 'success');
        else if (emptyMessage) pushToast(emptyMessage, 'success');
    };

    const handleRedistribute = () => {
        if (!bookings.length) {
            pushToast('There are no bookings to distribute.', 'error');
            return;
        }
        applyDistribution(bookings, buses, 'Buses re-distributed automatically (manual assignments kept).');
        logAudit('buses.redistribute', `${bookings.length} booking(s)`, 'Automatic bus assignment run');
    };

    const resetFilters = () => setFilters({ q: '', from: '', to: '' });

    /* ------------------ team leader: mark the sheet ready to print ------------------ */
    const handleSubmitToAdmin = () => {
        // Once the sheet has been printed the buses are already ordered, so
        // it cannot be replaced until it is reopened.
        if (sheetLocked) {
            pushToast('This sheet was printed and locked. Reopen it before marking it ready again.', 'error');
            return;
        }
        if (!filteredBookings.length) {
            pushToast('There are no bookings to send.', 'error');
            return;
        }
        const ids = new Set(filteredBookings.map((b) => b.id));
        const submittedAt = new Date().toISOString();
        const submittedBy = currentUser.name || currentUser.username;

        setBookings((prev) => prev.map((b) => (
            ids.has(b.id) ? { ...b, submittedBy, submittedAt } : b
        )));
        setSheetStatus('sent');
        logAudit('bookings.sheet_ready', `${ids.size} booking(s)`, `Marked ready to print by ${submittedBy}`);
        pushToast(`${ids.size} booking(s) marked as ready to print.`, 'success');
    };

    // Reopening lets the team leader work on a sheet that was already sent
    // or printed.
    const handleSendBackToLeader = () => {
        setSheetStatus('draft');
        logAudit('sheet.reopen', 'Booking sheet', `Reopened for changes by ${currentUser.name || currentUser.username}`);
        notifyLeaders(
            'Sheet reopened',
            `${currentUser.name || currentUser.username} reopened the booking sheet for changes. It can be edited and marked ready again.`,
            { kind: 'info' }
        );
        pushToast('The sheet was reopened for changes.', 'success');
    };

    /* ------------------ team leader: buses ------------------ */
    const handleAddBus = (e) => {
        e.preventDefault();
        const name = newBus.name.trim();
        const capacity = parseInt(newBus.capacity, 10);

        if (!name || !capacity || capacity < 1) {
            setBusFeedback({ type: 'error', text: 'Please enter a bus name and a capacity of at least 1.' });
            return;
        }
        if (buses.some((b) => b.name.toLowerCase() === name.toLowerCase())) {
            setBusFeedback({ type: 'error', text: `A bus named "${name}" already exists.` });
            return;
        }

        const nextBuses = [...buses, { id: `bus-${Date.now()}`, name, capacity }];
        applyDistribution(bookings, nextBuses, null);
        logAudit('bus.create', name, `Capacity ${capacity}`);
        setNewBus({ name: '', capacity: '' });
        setBusFeedback({ type: 'success', text: `Bus "${name}" was added.` });
    };

    const handleDeleteBus = (id) => {
        const bus = buses.find((b) => b.id === id);
        if (!bus) return;
        requestConfirm(
            `Remove "${bus.name}"? Its bookings will be re-assigned to the remaining buses or moved to the waitlist.`,
            () => {
                const nextBuses = buses.filter((b) => b.id !== id);
                const moved = bookings.map((b) => (
                    b.bus === bus.name ? { ...b, bus: WAITLIST, busManual: false } : b
                ));
                applyDistribution(moved, nextBuses, `Bus "${bus.name}" removed.`);
                logAudit('bus.delete', bus.name, 'Its bookings were re-assigned or waitlisted');
            }
        );
    };

    const handleUpdateCapacity = (id, capacity) => {
        const value = parseInt(capacity, 10);
        if (!value || value < 1) return;
        const current = buses.find((b) => b.id === id);
        if (!current || current.capacity === value) return; // nothing to re-distribute
        const nextBuses = buses.map((b) => (b.id === id ? { ...b, capacity: value } : b));
        applyDistribution(bookings, nextBuses, null);
        logAudit('bus.capacity', current.name, `${current.capacity} → ${value} seats per day`);
    };

    /* ------------------ admin: users ------------------ */
    const handleCreateUser = async (e) => {
        e.preventDefault();
        const name = newUser.name.trim();
        const username = newUser.username.trim();
        const password = newUser.password.trim();

        if (!name || !username || !password) {
            setUserFeedback({ type: 'error', text: 'Please fill in all fields.' });
            return;
        }
        if (allUsers.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
            setUserFeedback({ type: 'error', text: `The username "${username}" is already used.` });
            return;
        }

        const role = newUser.role === 'teamlead' ? 'teamlead' : 'user';
        // Stored as a salted hash; the owner is asked to replace the temporary
        // password the first time they sign in.
        const created = await withHashedPassword({ name, username, password, role, mustChangePassword: true });
        setCustomUsers((prev) => [...prev, created]);
        // A name that was deleted earlier becomes available again.
        setRemovedUsers((prev) => prev.filter((u) => u !== username));
        setNewUser({ name: '', username: '', password: '', role: 'user' });
        logAudit('user.create', username, `${ROLE_LABELS[role]} account created`);
        setUserFeedback({ type: 'success', text: `${ROLE_LABELS[role]} "${username}" was created successfully.` });
    };

    const handleDeleteUser = (username) => {
        if (username === currentUser.username) {
            pushToast('You cannot delete the account you are signed in with.', 'error');
            return;
        }
        const target = allUsers.find((u) => u.username === username);
        if (!target) return;

        requestConfirm(
            `Delete the account "${target.name}" (${username})? Their bookings stay in the list.`,
            () => {
                setCustomUsers((prev) => prev.filter((u) => u.username !== username));
                // Built-in accounts live in the source, so the removal is remembered.
                if (DEFAULT_USERS.some((u) => u.username === username)) {
                    setRemovedUsers((prev) => (prev.includes(username) ? prev : [...prev, username]));
                }
                setUserFeedback({ type: 'success', text: `The account "${username}" was deleted.` });
                logAudit('user.delete', username, `Account "${target.name}" deleted; bookings kept`);
                pushToast(`Account "${username}" deleted.`, 'success');
            }
        );
    };

    /* ------------------ admin: backup ------------------ */
    const handleExportBackup = () => {
        const payload = {
            exportedAt: new Date().toISOString(),
            version: 1,
            bookings,
            customUsers,
            removedUsers,
            passwordRequests,
            changeRequests,
            notifications,
            buses,
            audit: auditLog,
            sheet: sheetState,
            settings
        };
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Alorica_backup_${todayISO()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        pushToast('Backup file downloaded.', 'success');
    };

    const handleImportBackup = (file) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const data = JSON.parse(reader.result);
                if (Array.isArray(data.bookings)) setBookings(data.bookings);
                if (Array.isArray(data.customUsers)) setCustomUsers(data.customUsers);
                if (Array.isArray(data.removedUsers)) setRemovedUsers(data.removedUsers);
                if (Array.isArray(data.passwordRequests)) setPasswordRequests(data.passwordRequests);
                if (Array.isArray(data.changeRequests)) setChangeRequests(data.changeRequests);
                if (Array.isArray(data.notifications)) setNotifications(data.notifications);
                if (Array.isArray(data.buses) && data.buses.length) setBuses(data.buses);
                if (Array.isArray(data.audit)) setAuditLog(data.audit);
                if (Array.isArray(data.sheet) && data.sheet.length) setSheetState(data.sheet);
                if (data.settings) setSettings(normalizeSettingsList(data.settings));
                logAudit('backup.restore', file.name, 'Backup file restored');
                pushToast('Backup restored successfully.', 'success');
            } catch (err) {
                pushToast('That file is not a valid Alorica backup.', 'error');
            } finally {
                setImporting(false);
            }
        };
        reader.onerror = () => {
            pushToast('Could not read the selected file.', 'error');
            setImporting(false);
        };
        reader.readAsText(file);
    };

    /* ------------------ settings ------------------ */
    // The admin sections of the settings panel write into the shared
    // `settings` collection, so the shift presets and leave defaults
    // travel to every device like any other record.
    const handleSaveSettings = (next) => {
        const record = {
            ...normalizeSettingsRecord(next),
            updatedAt: new Date().toISOString(),
            updatedBy: currentUser ? currentUser.username : ''
        };
        setSettings([record]);
        logAudit('settings.update', 'Application settings', 'Shift times, leave defaults or booking rules were updated');
        pushToast('Settings saved.', 'success');
    };

    const handleUpdatePreferences = (next) => {
        setPreferences({ ...DEFAULT_PREFERENCES, ...next });
    };

    const handleSyncNow = async () => {
        if (SYNC.pull) await SYNC.pull();
        else await syncFlush();
    };

    const handleClearLocalData = () => {
        // Closed first: the confirm dialog sits below the settings
        // panel, so leaving it open would hide the question.
        setSettingsSection(null);
        requestConfirm(
            'Clear this browser\'s local cache? Nothing is deleted from the server — everything is downloaded again on the next load.',
            async () => {
                await syncFlush();
                Object.values(STORAGE).forEach((key) => localStorage.removeItem(key));
                window.location.reload();
            }
        );
    };

    /* ------------------ derived ------------------ */
    const dropOffLabel = activeTab === 'arrival' ? 'Pickup location' : 'Drop off location';
    const dropOffIcon = activeTab === 'arrival' ? 'map-pin' : 'navigation';
    const timeLabel = activeTab === 'arrival' ? 'Pickup time' : 'Drop-off time';

    const filtersActive = Boolean(filters.q || filters.from || filters.to);
    const pendingVacationCount = vacations.filter(v => v.status === 'pending').length;
    // Team leaders run the operation — reviewing bookings, the fleet and the
    // sheet. The IT admin owns the accounts, the password requests and the
    // audit trail, and takes no part in the day-to-day running.
    const adminTabs = [
        ...(isTeamLead ? [
            { key: 'bookings', label: 'Review Bookings', icon: 'calendar-check' },
            { key: 'changes', label: 'Change Requests', icon: 'git-pull-request', badge: pendingChangeCount },
            { key: 'vacations', label: 'Review Leave', icon: 'calendar', badge: pendingVacationCount },
            { key: 'buses', label: 'Buses', icon: 'bus' }
        ] : []),
        ...(isAdmin ? [
            { key: 'users', label: 'Users', icon: 'users' },
            { key: 'requests', label: 'Password Requests', icon: 'key-round', badge: openRequests.length },
            { key: 'audit', label: 'Audit Log', icon: 'history' }
        ] : [])
    ];

    // The two dashboards have no tabs in common, so land each role on one
    // of its own instead of leaving the previous role's tab selected.
    useEffect(() => {
        if (!isLoggedIn) return;
        setAdminView(isTeamLead ? 'bookings' : 'users');
    }, [isLoggedIn, isTeamLead]);

    /* ------------------ login screen ------------------ */
    if (!isLoggedIn) {
        return (
            <Login
                toasts={toasts}
                loginData={loginData}
                setLoginData={setLoginData}
                error={error}
                notice={loginNotice}
                onSubmit={handleLogin}
                onForgotPassword={handleForgotPassword}
                rememberMe={rememberMe}
                setRememberMe={setRememberMe}
            />
        );
    }

    /* ------------------ forced password change ------------------ */
    if (currentUser.mustChangePassword) {
        return (
            <PasswordChange
                toasts={toasts}
                user={currentUser}
                form={pwdForm}
                setForm={setPwdForm}
                feedback={pwdFeedback}
                onSubmit={handleChangePassword}
                onSignOut={handleSignOut}
            />
        );
    }

    /* ------------------ main app ------------------ */
    return (
        <>
        <Toasts toasts={toasts} />

        {/* Offline Banner */}
        {!isOnline && (
            <div className="fixed top-0 left-0 right-0 bg-red-500 text-white text-center py-2 px-4 z-[200] text-sm font-medium">
                <div className="flex items-center justify-center gap-2">
                    <Icon name="wifi-off" size={16} />
                    <span>You are offline. Some features may be limited.</span>
                </div>
            </div>
        )}

        {settingsSection && (
            <SettingsDialog
                section={settingsSection}
                onSection={setSettingsSection}
                onClose={() => setSettingsSection(null)}
                currentUser={currentUser}
                role={currentRole}
                preferences={preferences}
                onPreferences={handleUpdatePreferences}
                settings={appSettings}
                onSaveSettings={handleSaveSettings}
                onExportBackup={handleExportBackup}
                onImportBackup={handleImportBackup}
                importing={importing}
                setImporting={setImporting}
                pwdForm={pwdForm}
                setPwdForm={setPwdForm}
                pwdFeedback={pwdFeedback}
                onChangePassword={handleChangePassword}
                lastSyncAt={SYNC.lastSyncAt}
                syncOnline={syncOnline}
                onSyncNow={handleSyncNow}
                onClearLocalData={handleClearLocalData}
            />
        )}
        {confirmRequest && (
            <ConfirmDialog
                message={confirmRequest.message}
                onCancel={() => setConfirmRequest(null)}
                onConfirm={() => {
                    const action = confirmRequest.onConfirm;
                    setConfirmRequest(null);
                    action();
                }}
            />
        )}
        {tempPasswordReveal && (
            <TempPasswordDialog
                reveal={tempPasswordReveal}
                onCopy={handleCopyTempPassword}
                onClose={() => setTempPasswordReveal(null)}
            />
        )}
        {editingBooking && (
            <EditBookingDialog
                booking={editingBooking}
                canSelfApprove={isTeamLead}
                onCancel={() => setEditingBooking(null)}
                onSubmit={handleEditBooking}
            />
        )}
        {overrideRequest && (
            <OverrideDialog
                request={overrideRequest}
                onCancel={() => setOverrideRequest(null)}
                onConfirm={(reason) => {
                    const id = overrideRequest.id;
                    setOverrideRequest(null);
                    handleOverrideRequest(id, reason);
                }}
            />
        )}
        <div className="min-h-screen bg-alorica-light">
            <nav className="bg-white shadow-md px-3 sm:px-6 py-3 sm:py-4 flex flex-wrap justify-between items-center gap-y-3 sticky top-0 z-50">
                <img src="logo.png" alt="Alorica" className="h-7 sm:h-8" />
                {/* Transportation and My Leave are separate screens; on a narrow
                    screen the switcher drops to its own full-width row. It is
                    pointless while the dashboard is up, so it hides there. */}
                {!showDashboard && (
                    <div className="order-last sm:order-none w-full sm:w-auto flex items-center bg-gray-100 rounded-full p-0.5">
                        <button
                            type="button"
                            onClick={() => setMeView('transport')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${meView === 'transport' ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500 hover:text-alorica-blue'}`}
                        >
                            <Icon name="bus" size={14} />
                            <span className="hidden sm:inline">Transportation</span>
                            <span className="sm:hidden">Transport</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setMeView('leave')}
                            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${meView === 'leave' ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500 hover:text-alorica-blue'}`}
                        >
                            <Icon name="calendar" size={14} />
                            My Leave
                        </button>
                    </div>
                )}
                <div className="flex items-center gap-2 sm:gap-4">
                    {isTeamLead && (
                        <div className="hidden sm:flex items-center bg-gray-100 rounded-full p-0.5">
                            <button
                                type="button"
                                onClick={() => setLeaderMode('dashboard')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${leaderMode === 'dashboard' ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500 hover:text-alorica-blue'}`}
                            >
                                Dashboard
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeaderMode('me')}
                                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${leaderMode === 'me' ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500 hover:text-alorica-blue'}`}
                            >
                                My bookings
                            </button>
                        </div>
                    )}
                    {isTeamLead && (
                        <div className="sm:hidden flex items-center bg-gray-100 rounded-full p-0.5">
                            <button
                                type="button"
                                onClick={() => setLeaderMode('dashboard')}
                                className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${leaderMode === 'dashboard' ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500 hover:text-alorica-blue'}`}
                            >
                                Dashboard
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeaderMode('me')}
                                className={`px-2 py-1 rounded-full text-[10px] font-semibold transition-colors ${leaderMode === 'me' ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500 hover:text-alorica-blue'}`}
                            >
                                Me
                            </button>
                        </div>
                    )}
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-bold text-alorica-blue">{currentUser.name}</p>
                        <p className="text-xs text-gray-500">{isAdmin ? 'IT Admin' : isTeamLead ? 'Team Leader' : 'Welcome back'}</p>
                    </div>
                    <span
                        title={syncOnline
                            ? 'Connected — changes are shared with every device'
                            : 'Offline — changes are saved here and will sync once the server is back'}
                        className={`inline-flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-[11px] font-semibold px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full border whitespace-nowrap ${syncOnline ? 'text-green-700 bg-green-50 border-green-100' : 'text-red-600 bg-red-50 border-red-100'}`}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${syncOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                        {syncOnline ? 'Synced' : 'Offline'}
                    </span>
                    <NotificationBell
                        items={myNotifications}
                        open={bellOpen}
                        onOpen={openBell}
                        onClose={() => setBellOpen(false)}
                        onDecide={decideChangeRequest}
                        pendingRequest={(requestId) => changeRequests.find((r) => r.id === requestId && r.status === 'pending')}
                    />
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setSettingsOpen((open) => !open)}
                            className="p-1.5 sm:p-2 hover:bg-blue-50 rounded-full text-alorica-blue transition-colors"
                            title="Settings"
                        >
                            <Icon name="settings" size={20} className="sm:w-6 sm:h-6" />
                        </button>
                        {settingsOpen && (
                            <>
                                <div className="fixed inset-0 z-[95]" onClick={() => setSettingsOpen(false)} />
                                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] py-2 fade-in">
                                    {[
                                        { key: 'preferences', label: 'Preferences', icon: 'sliders-horizontal' },
                                        { key: 'account', label: 'Profile & password', icon: 'user' },
                                        { key: 'notifications', label: 'Notifications', icon: 'bell' },
                                        { key: 'data', label: 'Sync & data', icon: 'database' },
                                        ...(isTeamLead ? [
                                            { key: 'shifts', label: 'Shift times', icon: 'clock' },
                                            { key: 'leave', label: 'Leave defaults', icon: 'calendar' },
                                            { key: 'rules', label: 'Booking rules', icon: 'bus' }
                                        ] : [])
                                    ].map((item) => (
                                        <button
                                            key={item.key}
                                            type="button"
                                            onClick={() => { setSettingsOpen(false); setSettingsSection(item.key); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-alorica-light hover:text-alorica-blue transition-colors"
                                        >
                                            <Icon name={item.icon} size={17} className="text-gray-400" />
                                            {item.label}
                                        </button>
                                    ))}
                                    {isTeamLead && (
                                        <button
                                            type="button"
                                            onClick={() => { setSettingsOpen(false); setSettingsSection(null); setAdminView('buses'); }}
                                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-alorica-light hover:text-alorica-blue transition-colors border-t border-gray-100 mt-1 pt-3"
                                        >
                                            <Icon name="bus" size={17} className="text-gray-400" />
                                            Buses &amp; capacity
                                        </button>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                    <button
                        onClick={handleSignOut}
                        className="p-1.5 sm:p-2 hover:bg-red-50 rounded-full text-red-500 transition-colors"
                        title="Sign out"
                    >
                        <Icon name="log-out" size={20} className="sm:w-6 sm:h-6" />
                    </button>
                </div>
            </nav>

            <main className={`${showDashboard ? 'max-w-6xl' : 'max-w-4xl'} mx-auto p-4 sm:p-6 mt-6 sm:mt-8 fade-in`}>
                {showDashboard ? (
                <AdminDashboard
                    adminView={adminView}
                    setAdminView={setAdminView}
                    adminTabs={adminTabs}
                    bookings={bookings}
                    filteredBookings={filteredBookings}
                    dayGroups={dayGroups}
                    waitlistCount={waitlistCount}
                    filters={filters}
                    setFilters={setFilters}
                    filtersActive={filtersActive}
                    resetFilters={resetFilters}
                    onRedistribute={handleRedistribute}
                    onSaveExcel={handleSaveExcel}
                    onShare={handleShare}
                    onPrint={handlePrint}
                    sharing={sharing}
                    summaryText={shareSummaryText}
                    pushToast={pushToast}
                    busNames={busNames}
                    onSetBus={handleRequestBusChange}
                    onDeleteBooking={handleRequestBookingDelete}
                    pendingChanges={changeRequests}
                    auditLog={auditLog}
                    buses={buses}
                    newBus={newBus}
                    setNewBus={setNewBus}
                    busFeedback={busFeedback}
                    setBusFeedback={setBusFeedback}
                    onAddBus={handleAddBus}
                    onDeleteBus={handleDeleteBus}
                    onUpdateCapacity={handleUpdateCapacity}
                    busUsage={busUsage}
                    newUser={newUser}
                    setNewUser={setNewUser}
                    userFeedback={userFeedback}
                    setUserFeedback={setUserFeedback}
                    onCreateUser={handleCreateUser}
                    onDeleteUser={handleDeleteUser}
                    allUsers={allUsers}
                    currentUser={currentUser}
                    passwordRequests={passwordRequests}
                    onResetPassword={handleResetPassword}
                    onDismissRequest={handleDismissRequest}
                    importing={importing}
                    setImporting={setImporting}
                    onExportBackup={handleExportBackup}
                    onImportBackup={handleImportBackup}
                    role={currentRole}
                    onSubmitToAdmin={handleSubmitToAdmin}
                    pendingReviewCount={pendingReviewCount}
                    sheetStatus={sheetStatus}
                    sheet={sheet}
                    onSendBack={handleSendBackToLeader}
                    onOverrideRequest={setOverrideRequest}
                    pendingChangeCount={pendingChangeCount}
                    vacations={vacations}
                    vacationBalances={vacationBalances}
                    customUsers={customUsers}
                    onApproveVacation={handleApproveVacation}
                    onRejectVacation={handleRejectVacation}
                    onExportVacationExcel={handleExportVacationExcel}
                />
                ) : (
                /* ================= REGULAR USER ================= */
                meView === 'transport' ? (
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white">
                    <BookingForm
                        activeTab={activeTab}
                        setActiveTab={setActiveTab}
                        formData={formData}
                        setFormData={setFormData}
                        selectedRoad={selectedRoad}
                        setSelectedRoad={setSelectedRoad}
                        onSubmit={handleBooking}
                        dropOffLabel={dropOffLabel}
                        dropOffIcon={dropOffIcon}
                        timeLabel={timeLabel}
                    />
                    <MyBookings bookings={userBookings} onDelete={handleDeleteBooking} onEdit={openEditBooking} pendingChanges={changeRequests} canSelfApprove={isTeamLead} />
                </div>
                ) : (
                <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white">
                    {showVacationForm ? (
                        <VacationRequestForm
                            currentUser={currentUser}
                            vacationBalances={vacationBalances}
                            onSubmit={handleVacationRequest}
                            onCancel={() => setShowVacationForm(false)}
                            pushToast={pushToast}
                        />
                    ) : (
                        <MyVacations
                            vacations={vacations}
                            currentUser={currentUser}
                            vacationBalances={vacationBalances}
                            onCancel={handleCancelVacation}
                            onRequestVacation={() => setShowVacationForm(true)}
                        />
                    )}
                </div>
                )
                )}
            </main>

            <footer className="mt-12 pb-8 text-center text-gray-500 text-sm">
                <p>© 2026 Alorica Inc. All Rights Reserved.</p>
            </footer>
        </div>
        </>
    );
};
