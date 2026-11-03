/*
 * The settings screen. Personal preferences are kept on the device; the
 * shift times, leave balances and booking rules belong to the team leader
 * and are saved into the shared collection so every device sees them.
 */

import { Icon } from './common.js';
import { DEFAULT_VACATION_DAYS, VACATION_TYPES } from '../lib/config.js';
import { ROLE_LABELS } from '../lib/roles.js';

const { useState, useEffect, useMemo } = React;



/* =============================================================
 * Settings
 * =============================================================
 * Everything behind the gear in the header. Display preferences are
 * personal and stay on this device; the team-leader sections below them
 * are saved into the shared `settings` collection, so the shift presets
 * and leave defaults reach every device.
 */
export const SettingsDialog = ({
    section, onSection, onClose,
    currentUser, role,
    preferences, onPreferences,
    settings, onSaveSettings,
    onExportBackup, onImportBackup, importing, setImporting,
    pwdForm, setPwdForm, pwdFeedback, onChangePassword,
    lastSyncAt, syncOnline, onSyncNow, onClearLocalData
}) => {
    const [draft, setDraft] = useState(settings);
    const [shiftDir, setShiftDir] = useState('arrival');
    const [saved, setSaved] = useState(false);
    const isTeamLead = role === 'teamlead';

    // Switching section starts from a clean copy, so a half-typed edit
    // is never carried across. A save refreshes the copy too, but keeps
    // the "Saved" note visible.
    useEffect(() => { setDraft(settings); setSaved(false); }, [section]);
    useEffect(() => { setDraft(settings); }, [settings]);

    const sections = [
        { key: 'preferences', label: 'Preferences', icon: 'sliders-horizontal' },
        { key: 'account', label: 'Profile & password', icon: 'user' },
        { key: 'notifications', label: 'Notifications', icon: 'bell' },
        { key: 'data', label: 'Sync & data', icon: 'database' },
        ...(isTeamLead ? [
            { key: 'shifts', label: 'Shift times', icon: 'clock' },
            { key: 'leave', label: 'Leave defaults', icon: 'calendar' },
            { key: 'rules', label: 'Booking rules', icon: 'bus' }
        ] : [])
    ];
    const adminSection = ['shifts', 'leave', 'rules'].indexOf(section) !== -1;

    const save = () => {
        onSaveSettings(draft);
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
    };

    const updateGroups = (dir, fn) => setDraft((prev) => ({
        ...prev,
        shiftSlots: { ...prev.shiftSlots, [dir]: fn(prev.shiftSlots[dir]) }
    }));

    const togglePref = (key) => onPreferences({ ...preferences, [key]: !preferences[key] });

    const fieldCls = 'w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-alorica-blue text-sm text-gray-800';
    const labelCls = 'block text-xs font-semibold text-gray-600 mb-1';

    return (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black bg-opacity-40 p-3 sm:p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] flex flex-col overflow-hidden fade-in">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Icon name="settings" size={20} className="text-alorica-blue" />
                        <h3 className="font-bold text-alorica-blue">Settings</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-full text-gray-400" title="Close">
                        <Icon name="x" size={18} />
                    </button>
                </div>

                <div className="px-3 pt-3 flex gap-1 overflow-x-auto border-b border-gray-100">
                    {sections.map((s) => (
                        <button
                            key={s.key}
                            type="button"
                            onClick={() => onSection(s.key)}
                            className={`flex items-center gap-1.5 whitespace-nowrap px-3 py-2 rounded-t-lg text-xs font-semibold border-b-2 transition-colors ${section === s.key ? 'border-alorica-blue text-alorica-blue bg-alorica-light' : 'border-transparent text-gray-500 hover:text-alorica-blue'}`}
                        >
                            <Icon name={s.icon} size={15} />
                            {s.label}
                        </button>
                    ))}
                </div>

                <div className="p-5 overflow-y-auto flex-1 space-y-5">
                    {section === 'preferences' && (
                        <>
                            <div>
                                <label className={labelCls}>Time format</label>
                                <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                                    {[['12h', '12-hour (1:30 PM)'], ['24h', '24-hour (13:30)']].map(([val, text]) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => onPreferences({ ...preferences, timeFormat: val })}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${preferences.timeFormat === val ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500'}`}
                                        >
                                            {text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className={labelCls}>Open the booking form on</label>
                                <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                                    {[['arrival', 'Arrival'], ['departure', 'Departure']].map(([val, text]) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => onPreferences({ ...preferences, defaultTab: val })}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${preferences.defaultTab === val ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500'}`}
                                        >
                                            {text}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <p className="text-xs text-gray-400">These apply to this device only.</p>
                        </>
                    )}

                    {section === 'account' && (
                        <>
                            <div className="bg-alorica-light rounded-xl p-4">
                                <p className="text-sm font-bold text-alorica-blue">{currentUser.name || currentUser.username}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{currentUser.username} · {ROLE_LABELS[role] || role}</p>
                            </div>

                            <form onSubmit={onChangePassword} className="space-y-3">
                                <h4 className="text-sm font-bold text-alorica-blue">Change password</h4>
                                <div>
                                    <label className={labelCls}>New password</label>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        className={fieldCls}
                                        value={pwdForm.next}
                                        onChange={(e) => setPwdForm({ ...pwdForm, next: e.target.value })}
                                        placeholder="At least 6 characters"
                                    />
                                </div>
                                <div>
                                    <label className={labelCls}>Confirm new password</label>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        className={fieldCls}
                                        value={pwdForm.confirm}
                                        onChange={(e) => setPwdForm({ ...pwdForm, confirm: e.target.value })}
                                        placeholder="Type it again"
                                    />
                                </div>
                                {pwdFeedback.text && (
                                    <p className={`text-xs font-medium px-3 py-2 rounded-lg ${pwdFeedback.type === 'error' ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-700'}`}>
                                        {pwdFeedback.text}
                                    </p>
                                )}
                                <button
                                    type="submit"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-alorica-blue text-white text-sm font-bold hover:bg-opacity-90 transition-colors"
                                >
                                    <Icon name="key-round" size={16} /> Update password
                                </button>
                            </form>
                        </>
                    )}

                    {section === 'notifications' && (
                        <div className="space-y-2">
                            {[
                                { key: 'notifyApprovals', label: 'Approvals waiting for me', hint: 'A booking change needs my answer' },
                                { key: 'notifyDecisions', label: 'Answers to my requests', hint: 'A request of mine was approved or declined' },
                                { key: 'notifyGeneral', label: 'Everything else', hint: 'Bookings, bus changes and reminders' }
                            ].map((row) => (
                                <label key={row.key} className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="mt-0.5 w-4 h-4 accent-alorica-blue"
                                        checked={preferences[row.key]}
                                        onChange={() => togglePref(row.key)}
                                    />
                                    <span>
                                        <span className="block text-sm font-semibold text-gray-800">{row.label}</span>
                                        <span className="block text-xs text-gray-500">{row.hint}</span>
                                    </span>
                                </label>
                            ))}
                            <p className="text-xs text-gray-400">Hidden notifications are still recorded — only the bell list is filtered.</p>
                        </div>
                    )}

                    {section === 'data' && (
                        <>
                            <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100">
                                <span className={`w-2 h-2 rounded-full ${syncOnline ? 'bg-green-500' : 'bg-red-500'}`} />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-800">{syncOnline ? 'Connected' : 'Offline — changes are queued'}</p>
                                    <p className="text-xs text-gray-500">Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : 'not yet this session'}</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={onSyncNow}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs font-bold text-alorica-blue hover:bg-alorica-light transition-colors"
                                >
                                    <Icon name="refresh-cw" size={14} /> Sync now
                                </button>
                            </div>

                            <div className="flex flex-wrap gap-2">
                                <button
                                    type="button"
                                    onClick={onExportBackup}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-alorica-blue hover:bg-alorica-light transition-colors"
                                >
                                    <Icon name="download" size={16} /> Export backup
                                </button>
                                <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-alorica-blue hover:bg-alorica-light transition-colors cursor-pointer">
                                    <Icon name={importing ? 'refresh-cw' : 'upload'} size={16} />
                                    {importing ? 'Restoring…' : 'Import backup'}
                                    <input
                                        type="file"
                                        accept="application/json,.json"
                                        className="hidden"
                                        disabled={importing}
                                        onChange={(e) => {
                                            const file = e.target.files && e.target.files[0];
                                            e.target.value = '';
                                            if (!file) return;
                                            setImporting(true);
                                            onImportBackup(file);
                                        }}
                                    />
                                </label>
                            </div>

                            <div className="border-t border-gray-100 pt-4">
                                <p className="text-xs text-gray-500 mb-2">
                                    Clearing the local cache removes this browser's copy only. Everything is downloaded again from the server on the next load.
                                </p>
                                <button
                                    type="button"
                                    onClick={onClearLocalData}
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-sm font-bold text-red-600 hover:bg-red-50 transition-colors"
                                >
                                    <Icon name="trash-2" size={16} /> Clear local cache
                                </button>
                            </div>
                        </>
                    )}

                    {section === 'shifts' && isTeamLead && (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div className="inline-flex bg-gray-100 rounded-lg p-0.5">
                                    {[['arrival', 'Arrival'], ['departure', 'Departure']].map(([val, text]) => (
                                        <button
                                            key={val}
                                            type="button"
                                            onClick={() => setShiftDir(val)}
                                            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${shiftDir === val ? 'bg-white text-alorica-blue shadow-sm' : 'text-gray-500'}`}
                                        >
                                            {text}
                                        </button>
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => updateGroups(shiftDir, (list) => [...list, { shift: 'New Shift', times: ['', ''] }])}
                                    className="text-xs font-bold text-alorica-blue hover:underline"
                                >
                                    + Add shift
                                </button>
                            </div>

                            {(draft.shiftSlots[shiftDir] || []).map((group, gi) => (
                                <div key={gi} className="p-3 rounded-xl border border-gray-100 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <input
                                            className={fieldCls}
                                            value={group.shift}
                                            placeholder="Shift name"
                                            onChange={(e) => updateGroups(shiftDir, (list) => list.map((g, i) => i === gi ? { ...g, shift: e.target.value } : g))}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => updateGroups(shiftDir, (list) => list.filter((_, i) => i !== gi))}
                                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 shrink-0"
                                            title="Remove this shift"
                                        >
                                            <Icon name="trash-2" size={16} />
                                        </button>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {[0, 1].map((ti) => (
                                            <input
                                                key={ti}
                                                type="time"
                                                className={fieldCls}
                                                value={group.times[ti] || ''}
                                                onChange={(e) => updateGroups(shiftDir, (list) => list.map((g, i) => i === gi ? { ...g, times: [0, 1].map((j) => j === ti ? e.target.value : (g.times[j] || '')) } : g))}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <p className="text-xs text-gray-400">These are the pickup/drop-off slots offered in the booking form.</p>
                        </>
                    )}

                    {section === 'leave' && isTeamLead && (
                        <>
                            <p className="text-xs text-gray-500">Days granted to an employee who has no balance record yet. Balances already on file are untouched.</p>
                            {Object.keys(DEFAULT_VACATION_DAYS).map((key) => (
                                <div key={key} className="flex items-center justify-between gap-3">
                                    <span className="text-sm font-semibold text-gray-700">{VACATION_TYPES[key] ? VACATION_TYPES[key].label : key}</span>
                                    <input
                                        type="number"
                                        min="0"
                                        className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-alorica-blue text-sm text-gray-800"
                                        value={draft.vacationDefaults[key]}
                                        onChange={(e) => setDraft((prev) => ({
                                            ...prev,
                                            vacationDefaults: { ...prev.vacationDefaults, [key]: Math.max(0, Number(e.target.value) || 0) }
                                        }))}
                                    />
                                </div>
                            ))}
                        </>
                    )}

                    {section === 'rules' && isTeamLead && (
                        <>
                            <div className="flex items-center justify-between gap-3">
                                <div>
                                    <p className="text-sm font-semibold text-gray-700">Booking window</p>
                                    <p className="text-xs text-gray-500">How many days ahead a booking may be made.</p>
                                </div>
                                <input
                                    type="number"
                                    min="1"
                                    className="w-24 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:border-alorica-blue text-sm text-gray-800"
                                    value={draft.bookingRules.maxAdvanceDays}
                                    onChange={(e) => setDraft((prev) => ({
                                        ...prev,
                                        bookingRules: { ...prev.bookingRules, maxAdvanceDays: Math.max(1, Number(e.target.value) || 1) }
                                    }))}
                                />
                            </div>

                            <label className="flex items-start gap-3 p-3 rounded-xl border border-gray-100 hover:bg-gray-50 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="mt-0.5 w-4 h-4 accent-alorica-blue"
                                    checked={draft.bookingRules.oneBookingPerDay}
                                    onChange={(e) => setDraft((prev) => ({
                                        ...prev,
                                        bookingRules: { ...prev.bookingRules, oneBookingPerDay: e.target.checked }
                                    }))}
                                />
                                <span>
                                    <span className="block text-sm font-semibold text-gray-800">One booking per employee per day</span>
                                    <span className="block text-xs text-gray-500">Stops a second booking on a date that already has one.</span>
                                </span>
                            </label>

                            <p className="text-xs text-gray-500">
                                Seats per bus are set on the <span className="font-semibold">Buses</span> tab, where the fleet and each capacity are managed.
                            </p>
                        </>
                    )}
                </div>

                <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2 bg-gray-50">
                    {saved && <span className="mr-auto text-xs font-semibold text-green-600">Saved</span>}
                    {draft.updatedAt && !saved && (
                        <span className="mr-auto text-xs text-gray-400">
                            Last changed by {draft.updatedBy || 'the team leader'}
                        </span>
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-bold text-gray-600 hover:bg-white transition-colors"
                    >
                        Close
                    </button>
                    {adminSection && (
                        <button
                            type="button"
                            onClick={save}
                            className="px-4 py-2 rounded-lg bg-alorica-blue text-white text-sm font-bold hover:bg-opacity-90 transition-colors"
                        >
                            Save changes
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
