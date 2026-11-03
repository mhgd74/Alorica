/*
 * The dashboard, split by role: the team leader gets the operation (fleet,
 * sheet, bookings and leave), the IT admin gets the accounts and the audit log.
 */

import { Icon } from './common.js';
import { VacationReports, VacationReview } from './vacation.js';
import { uniqueEmployeeCount } from '../lib/booking.js';
import { CHANGE_REQUEST_TTL, DEFAULT_USERS, SHEET_STATUS, WAITLIST } from '../lib/config.js';
import { changeValue, formatTime12h } from '../lib/format.js';
import { ROLE_LABELS, roleOf } from '../lib/roles.js';

const { useState, useEffect, useMemo } = React;



export const AdminDashboard = ({
    adminView, setAdminView, adminTabs,
    bookings, filteredBookings, dayGroups, waitlistCount,
    filters, setFilters, filtersActive, resetFilters,
    onRedistribute, onSaveExcel, onShare, onPrint, sharing, summaryText, pushToast,
    busNames, onSetBus, onDeleteBooking,
    buses, newBus, setNewBus, busFeedback, setBusFeedback,
    onAddBus, onDeleteBus, onUpdateCapacity, busUsage,
    newUser, setNewUser, userFeedback, setUserFeedback, onCreateUser, onDeleteUser, allUsers, currentUser,
    passwordRequests, onResetPassword, onDismissRequest,
    pendingChanges, auditLog,
    importing, setImporting, onExportBackup, onImportBackup,
    role, onSubmitToAdmin, pendingReviewCount,
    sheetStatus, sheet, onSendBack, onOverrideRequest,
    pendingChangeCount,
    vacations, vacationBalances, customUsers,
    onApproveVacation, onRejectVacation, onExportVacationExcel
}) => {
    const isTeamLead = role === 'teamlead';
    const isAdmin = role === 'admin';
    // A booking can only have one approval request open at a time.
    const pendingFor = (bookingId) => pendingChanges.find((r) => r.bookingId === bookingId && r.status === 'pending');

    // How a change request ended up, shown in the requests tab.
    const requestStatus = (r) => {
        if (r.status === 'approved') return { label: 'Approved', cls: 'bg-green-50 text-green-700' };
        if (r.status === 'rejected') return { label: 'Declined', cls: 'bg-gray-100 text-gray-500' };
        if (r.status === 'expired') return { label: 'Expired', cls: 'bg-red-50 text-red-600' };
        if (r.status === 'overridden') return { label: 'Overridden', cls: 'bg-red-100 text-red-700' };
        return r.direction === 'employee'
            ? { label: 'Waiting: team leader', cls: 'bg-blue-50 text-alorica-blue' }
            : { label: 'Waiting: employee', cls: 'bg-orange-100 text-alorica-orange' };
    };

    const hoursLeft = (r) => Math.max(
        0,
        Math.ceil((CHANGE_REQUEST_TTL - (Date.now() - new Date(r.requestedAt).getTime())) / 3600000)
    );
    return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-white">
        <div className="bg-alorica-blue p-6 sm:p-8 text-white text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">{isTeamLead ? 'Team Leader Dashboard' : 'IT Admin Console'}</h2>
            <p className="opacity-80">
                {isTeamLead
                    ? 'Run the operation: review bookings and leave, adjust the bus distribution, then print and lock the sheet'
                    : 'Manage the accounts, the password requests and the audit trail'}
            </p>
        </div>

        <div className="flex flex-wrap justify-center gap-3 pt-6 px-4">
            {adminTabs.map((tab) => (
                <button
                    key={tab.key}
                    type="button"
                    onClick={() => setAdminView(tab.key)}
                    className={`flex items-center gap-2 px-5 sm:px-8 py-3 rounded-xl font-bold text-sm sm:text-base transition-all ${
                        adminView === tab.key
                            ? 'bg-alorica-orange text-white shadow-lg scale-105'
                            : 'bg-gray-100 text-alorica-blue hover:bg-alorica-light'
                    }`}
                >
                    <Icon name={tab.icon} size={18} /> {tab.label}
                    {tab.badge > 0 && (
                        <span className="ml-1 bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5 min-w-[1.25rem]">
                            {tab.badge}
                        </span>
                    )}
                </button>
            ))}
        </div>

        <div className="p-4 sm:p-8">

        {/* ================= BOOKINGS ================= */}
        {adminView === 'bookings' && isTeamLead && (
            <>
            {/* Team Leader Quick Stats */}
            {isTeamLead && (
                <div className="max-w-4xl mx-auto mb-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center border border-blue-200">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Icon name="calendar-check" size={20} className="text-alorica-blue" />
                            <p className="text-3xl font-black text-alorica-blue">{filteredBookings.length}</p>
                        </div>
                        <p className="text-xs text-gray-600 font-semibold">Total Bookings</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 text-center border border-green-200">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Icon name="users" size={20} className="text-green-700" />
                            <p className="text-3xl font-black text-green-700">{uniqueEmployeeCount(filteredBookings)}</p>
                        </div>
                        <p className="text-xs text-gray-600 font-semibold">Employees</p>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-4 text-center border border-orange-200">
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Icon name="bus" size={20} className="text-alorica-orange" />
                            <p className="text-3xl font-black text-alorica-orange">{buses.length}</p>
                        </div>
                        <p className="text-xs text-gray-600 font-semibold">Available Buses</p>
                    </div>
                    <div className={`rounded-2xl p-4 text-center border ${waitlistCount > 0 ? 'bg-gradient-to-br from-red-50 to-red-100 border-red-200' : 'bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200'}`}>
                        <div className="flex items-center justify-center gap-2 mb-1">
                            <Icon name="clock" size={20} className={waitlistCount > 0 ? 'text-red-600' : 'text-gray-600'} />
                            <p className={`text-3xl font-black ${waitlistCount > 0 ? 'text-red-600' : 'text-gray-600'}`}>{waitlistCount}</p>
                        </div>
                        <p className="text-xs text-gray-600 font-semibold">On Waitlist</p>
                    </div>
                </div>
            )}

            {/* Admin Quick Stats */}
            {!isTeamLead && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 max-w-4xl mx-auto">
                    <div className="bg-alorica-light rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-alorica-blue">{filteredBookings.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Bookings</p>
                    </div>
                    <div className="bg-alorica-light rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-alorica-blue">{dayGroups.length}</p>
                        <p className="text-xs text-gray-500 mt-1">Days</p>
                    </div>
                    <div className="bg-alorica-light rounded-2xl p-4 text-center">
                        <p className="text-3xl font-black text-alorica-blue">{uniqueEmployeeCount(filteredBookings)}</p>
                        <p className="text-xs text-gray-500 mt-1">Employees</p>
                    </div>
                    <div className="bg-alorica-light rounded-2xl p-4 text-center">
                        <p className={`text-3xl font-black ${waitlistCount ? 'text-red-600' : 'text-alorica-blue'}`}>{waitlistCount}</p>
                        <p className="text-xs text-gray-500 mt-1">On waitlist</p>
                    </div>
                </div>
            )}

            {/* Sheet Status */}
            <div className="max-w-4xl mx-auto mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3">
                <div className="flex items-center gap-3">
                    <Icon name="file-spreadsheet" size={18} className="text-alorica-blue shrink-0" />
                    <div>
                        <p className="text-sm font-semibold text-alorica-blue flex items-center gap-2">
                            Booking sheet
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${SHEET_STATUS[sheetStatus].cls}`}>
                                {SHEET_STATUS[sheetStatus].label}
                            </span>
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                            {sheet.updatedAt
                                ? `Last updated ${new Date(sheet.updatedAt).toLocaleString()}${sheet.updatedBy ? ` by ${sheet.updatedBy}` : ''}`
                                : 'Not marked ready to print yet.'}
                            {sheetStatus === 'locked' && ' — it has been printed, so the buses are already ordered.'}
                        </p>
                    </div>
                </div>
                {isTeamLead && (sheetStatus === 'sent' || sheetStatus === 'locked') && (
                    <button
                        type="button"
                        onClick={onSendBack}
                        className="shrink-0 text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-alorica-blue text-alorica-blue hover:bg-alorica-light transition-colors flex items-center gap-1"
                    >
                        <Icon name="undo-2" size={14} /> Reopen sheet
                    </button>
                )}
            </div>

            {/* Team Leader Quick Actions */}
            {isTeamLead && (
                <div className="max-w-4xl mx-auto mb-6 grid grid-cols-2 lg:grid-cols-3 gap-3">
                    <button
                        type="button"
                        onClick={onRedistribute}
                        className="bg-white border-2 border-alorica-blue text-alorica-blue font-bold py-3 px-4 rounded-xl shadow hover:bg-alorica-light flex items-center justify-center gap-2 transition-all"
                    >
                        <Icon name="shuffle" size={18} /> Auto-assign Buses
                    </button>
                    <button
                        type="button"
                        onClick={() => setAdminView('changes')}
                        className={`font-bold py-3 px-4 rounded-xl shadow flex items-center justify-center gap-2 transition-all ${pendingChangeCount > 0 ? 'bg-alorica-orange text-white hover:shadow-lg' : 'bg-white border-2 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                    >
                        <Icon name="git-pull-request" size={18} />
                        Change Requests
                        {pendingChangeCount > 0 && (
                            <span className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-0.5">{pendingChangeCount}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        onClick={() => setAdminView('buses')}
                        className="bg-white border-2 border-alorica-blue text-alorica-blue font-bold py-3 px-4 rounded-xl shadow hover:bg-alorica-light flex items-center justify-center gap-2 transition-all"
                    >
                        <Icon name="settings" size={18} /> Manage Buses
                    </button>
                </div>
            )}

            {/* Filters */}
            <div className="max-w-4xl mx-auto mb-6 bg-gray-50 border border-gray-100 rounded-2xl p-4">
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold text-gray-600 mb-1">Search</label>
                        <div className="relative">
                            <input
                                className="w-full px-4 py-3 pl-10 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                                placeholder="Name, ID, point, bus..."
                                value={filters.q}
                                onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Icon name="search" size={16} />
                            </div>
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">From date</label>
                        <input
                            type="date"
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                            value={filters.from}
                            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1">To date</label>
                        <input
                            type="date"
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                            value={filters.to}
                            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                        />
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 mt-3">
                    <p className="text-xs text-gray-500">
                        Showing <span className="font-bold text-alorica-blue">{filteredBookings.length}</span> of {bookings.length} bookings{filtersActive ? ' (filters applied)' : ''}. Exports use this selection.
                    </p>
                    <div className="flex gap-2">
                        {filtersActive && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>
                </div>

                {!isTeamLead && pendingReviewCount > 0 && (
                    <p className="flex items-center gap-2 mt-3 text-xs font-semibold text-alorica-orange bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                        <Icon name="clock" size={14} />
                        {pendingReviewCount} booking{pendingReviewCount === 1 ? '' : 's'} waiting with the team leader — they will appear here once sent.
                    </p>
                )}
            </div>

            {sheetStatus === 'draft' ? (
                <div className="max-w-4xl mx-auto mb-8">
                    <button
                        type="button"
                        onClick={onSubmitToAdmin}
                        className="w-full font-bold py-4 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all bg-alorica-orange hover:shadow-2xl text-white"
                    >
                        <Icon name="send" size={20} /> Mark ready to print
                    </button>
                    <p className="text-center text-xs text-gray-400 mt-2">
                        Marks the bookings above as reviewed and moves the sheet to "Ready to print".
                    </p>
                </div>
            ) : (
                <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4 max-w-4xl mx-auto">
                    <button
                        type="button"
                        onClick={onSaveExcel}
                        className="bg-alorica-blue hover:bg-opacity-90 text-white font-bold py-4 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        <Icon name="save" size={20} /> Save Excel
                    </button>
                    <button
                        type="button"
                        onClick={onShare}
                        disabled={sharing}
                        className={`bg-alorica-orange hover:shadow-2xl text-white font-bold py-4 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all ${sharing ? 'opacity-70 cursor-wait' : ''}`}
                    >
                        <Icon name="share-2" size={20} /> {sharing ? 'Sharing...' : 'Share'}
                    </button>
                    <button
                        type="button"
                        onClick={onPrint}
                        className="bg-white border-2 border-alorica-blue text-alorica-blue font-bold py-4 px-4 rounded-xl shadow hover:bg-alorica-light flex items-center justify-center gap-2 transition-all"
                    >
                        <Icon name="printer" size={20} /> Print
                    </button>
                </div>

                <div className="flex flex-wrap justify-center gap-2 mb-4">
                    <a
                        href={`https://wa.me/?text=${encodeURIComponent(summaryText())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 transition-colors flex items-center gap-1"
                    >
                        <Icon name="message-circle" size={14} /> WhatsApp summary
                    </a>
                    <a
                        href={`https://t.me/share/url?url=${encodeURIComponent('https://github.com/mhgd74/Alorica')}&text=${encodeURIComponent(summaryText())}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors flex items-center gap-1"
                    >
                        <Icon name="send" size={14} /> Telegram summary
                    </a>
                    <button
                        type="button"
                        onClick={() => {
                            navigator.clipboard.writeText(summaryText())
                                .then(() => pushToast('Summary copied to clipboard.', 'success'))
                                .catch(() => pushToast('Could not access the clipboard.', 'error'));
                        }}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors flex items-center gap-1"
                    >
                        <Icon name="clipboard-copy" size={14} /> Copy summary
                    </button>
                </div>

                <p className="text-center text-xs text-gray-400 mb-8">
                    Printing locks the sheet — the buses are ordered off it. The Excel file contains a Summary sheet plus one sheet per day with employee name, ID, booking time, pickup point, type and assigned bus.
                </p>
                </>
            )}

            {filteredBookings.length === 0 ? (
                <p className="text-center text-gray-400 py-12">
                    {bookings.length === 0
                        ? (isTeamLead
                            ? 'No bookings yet. Employee bookings will appear here.'
                            : 'No bookings have been sent by the team leader yet.')
                        : 'No bookings match the current filters.'}
                </p>
            ) : (
                <div className="space-y-8">
                    {dayGroups.map(({ day, items }) => (
                        <div key={day} className="border border-gray-100 rounded-2xl overflow-hidden">
                            <div className="bg-alorica-blue text-white px-4 py-3 flex justify-between items-center">
                                <span className="font-bold">{day}</span>
                                <span className="text-xs opacity-80">{items.length} booking{items.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm min-w-[920px]">
                                    <thead className="bg-alorica-light text-alorica-blue">
                                        <tr>
                                            <th className="text-left px-3 py-2 font-semibold">Employee Name</th>
                                            <th className="text-left px-3 py-2 font-semibold">ID</th>
                                            <th className="text-left px-3 py-2 font-semibold">Time</th>
                                            <th className="text-left px-3 py-2 font-semibold">Pickup Point</th>
                                            <th className="text-left px-3 py-2 font-semibold">Type</th>
                                            <th className="text-left px-3 py-2 font-semibold">Bus</th>
                                            <th className="text-center px-3 py-2 font-semibold">Status</th>
                                            {isTeamLead && <th className="text-center px-3 py-2 font-semibold">Actions</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((b) => (
                                            <tr key={b.id} className="border-t border-gray-100">
                                                <td className="px-3 py-2 text-gray-800">{b.employeeName}</td>
                                                <td className="px-3 py-2 text-gray-600">{b.employeeId}</td>
                                                <td className="px-3 py-2 text-gray-600">{formatTime12h(b.time)}</td>
                                                <td className="px-3 py-2 text-gray-600">{b.location}</td>
                                                <td className="px-3 py-2">
                                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${b.type === 'Arrival' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-alorica-orange'}`}>
                                                        {b.type}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2">
                                                    {isTeamLead ? (
                                                        pendingFor(b.id) && pendingFor(b.id).kind === 'update' && pendingFor(b.id).direction !== 'employee' ? (
                                                            <div className="flex items-center gap-1 whitespace-nowrap">
                                                                <span className="text-xs font-semibold rounded-lg px-2 py-1 border border-gray-200 text-gray-500">{b.bus}</span>
                                                                <span className="text-gray-400">&rarr;</span>
                                                                <span className="text-xs font-semibold rounded-lg px-2 py-1 bg-orange-50 text-alorica-orange border border-orange-200">{pendingFor(b.id).changes[0].to}</span>
                                                            </div>
                                                        ) : (
                                                            <select
                                                                value={b.bus || WAITLIST}
                                                                disabled={Boolean(pendingFor(b.id))}
                                                                onChange={(e) => onSetBus(b.id, e.target.value)}
                                                                className={`text-xs font-semibold rounded-lg px-2 py-1 border outline-none disabled:opacity-60 disabled:cursor-not-allowed ${b.bus === WAITLIST ? 'border-red-200 text-red-600 bg-red-50' : 'border-gray-200 text-alorica-blue bg-white'}`}
                                                            >
                                                                {busNames.map((n) => <option key={n} value={n}>{n}</option>)}
                                                                <option value={WAITLIST}>{WAITLIST}</option>
                                                            </select>
                                                        )
                                                    ) : (
                                                        <span className={`text-xs font-semibold rounded-lg px-2 py-1 border whitespace-nowrap ${b.bus === WAITLIST ? 'border-red-200 text-red-600 bg-red-50' : 'border-gray-200 text-alorica-blue bg-white'}`}>
                                                            {b.bus}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                    <span
                                                        title={b.submittedAt
                                                            ? `Sent by ${b.submittedBy || 'Team Leader'} — ${new Date(b.submittedAt).toLocaleString()}`
                                                            : 'Not marked ready to print yet'}
                                                        className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${b.submittedAt ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                                                    >
                                                        {b.submittedAt ? 'Sent' : 'Pending'}
                                                    </span>
                                                </td>
                                                {isTeamLead && (
                                                <td className="px-3 py-2 text-center">
                                                    {pendingFor(b.id) ? (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-alorica-orange bg-orange-50 border border-orange-100 rounded-full px-2 py-1 whitespace-nowrap">
                                                            <Icon name="clock" size={12} />
                                                            {pendingFor(b.id).kind === 'delete' ? 'Waiting: deletion' : 'Waiting: approval'}
                                                        </span>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            onClick={() => onDeleteBooking(b.id)}
                                                            className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                                            title="Request deletion from the employee"
                                                        >
                                                            <Icon name="trash-2" size={16} />
                                                        </button>
                                                    )}
                                                </td>
                                                )}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            </>
        )}

        {/* ================= BUSES ================= */}
        {adminView === 'buses' && isTeamLead && (
            <div className="max-w-4xl mx-auto">
                <div className="bg-alorica-light rounded-2xl p-6 mb-8">
                    <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-4">
                        <Icon name="bus" size={20} className="text-alorica-orange" /> Add a Bus
                    </h3>
                    <form onSubmit={onAddBus} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="sm:col-span-2">
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Bus name</label>
                                <input
                                    required
                                    placeholder="e.g. Bus 4"
                                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                                    value={newBus.name}
                                    onChange={(e) => { setBusFeedback({ type: '', text: '' }); setNewBus({ ...newBus, name: e.target.value }); }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Seats (per day)</label>
                                <input
                                    required
                                    type="number"
                                    min="1"
                                    placeholder="e.g. 14"
                                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                                    value={newBus.capacity}
                                    onChange={(e) => { setBusFeedback({ type: '', text: '' }); setNewBus({ ...newBus, capacity: e.target.value }); }}
                                />
                            </div>
                        </div>

                        {busFeedback.text && (
                            <p className={`text-sm font-medium rounded-xl px-4 py-3 border fade-in ${
                                busFeedback.type === 'error'
                                    ? 'bg-red-50 text-red-600 border-red-100'
                                    : 'bg-green-50 text-green-700 border-green-100'
                            }`}>
                                {busFeedback.text}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-alorica-blue hover:bg-opacity-90 text-white font-bold py-4 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                        >
                            <Icon name="plus" size={20} /> Add Bus
                        </button>
                    </form>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                    <h3 className="text-alorica-blue font-bold text-lg">Fleet ({buses.length} buses)</h3>
                    <button
                        type="button"
                        onClick={onRedistribute}
                        className="text-xs font-semibold px-3 py-2 rounded-lg bg-white border border-alorica-blue text-alorica-blue hover:bg-alorica-light transition-colors flex items-center gap-1"
                    >
                        <Icon name="shuffle" size={14} /> Auto-assign buses
                    </button>
                </div>

                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-alorica-light text-alorica-blue">
                                <tr>
                                    <th className="text-left px-4 py-2 font-semibold">Bus</th>
                                    <th className="text-left px-4 py-2 font-semibold">Seats / day</th>
                                    <th className="text-left px-4 py-2 font-semibold">Assigned (all bookings)</th>
                                    <th className="text-center px-4 py-2 font-semibold">Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {buses.length === 0 && (
                                    <tr><td colSpan="4" className="px-4 py-6 text-center text-gray-400">No buses yet. Add one above.</td></tr>
                                )}
                                {buses.map((bus) => (
                                    <tr key={bus.id} className="border-t border-gray-100">
                                        <td className="px-4 py-2 text-gray-800 font-semibold">{bus.name}</td>
                                        <td className="px-4 py-2">
                                            <input
                                                type="number"
                                                min="1"
                                                defaultValue={bus.capacity}
                                                onBlur={(e) => onUpdateCapacity(bus.id, e.target.value)}
                                                className="w-24 px-3 py-2 border-2 border-gray-100 rounded-lg outline-none bg-white text-sm"
                                            />
                                        </td>
                                        <td className="px-4 py-2 text-gray-600">{busUsage[bus.name] || 0}</td>
                                        <td className="px-4 py-2 text-center">
                                            <button
                                                type="button"
                                                onClick={() => onDeleteBus(bus.id)}
                                                className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                                title="Remove bus"
                                            >
                                                <Icon name="trash-2" size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="bg-alorica-light rounded-2xl p-4 text-center">
                        <p className="text-2xl font-black text-alorica-blue">{buses.reduce((sum, b) => sum + b.capacity, 0)}</p>
                        <p className="text-xs text-gray-500 mt-1">Total seats per day</p>
                    </div>
                    <div className="bg-alorica-light rounded-2xl p-4 text-center">
                        <p className={`text-2xl font-black ${waitlistCount ? 'text-red-600' : 'text-alorica-blue'}`}>{waitlistCount}</p>
                        <p className="text-xs text-gray-500 mt-1">Bookings on waitlist</p>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-4 text-center">
                    Capacity is applied per day. Bookings that do not fit any bus are placed on the waitlist and flagged in red.
                </p>
            </div>
        )}

        {/* ================= USERS ================= */}
        {adminView === 'users' && isAdmin && (
            <div className="max-w-3xl mx-auto">
                <div className="bg-alorica-light rounded-2xl p-6 mb-8">
                    <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-4">
                        <Icon name="user-plus" size={20} className="text-alorica-orange" /> Create New User
                    </h3>
                    <form onSubmit={onCreateUser} className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Full Name</label>
                                <input
                                    required
                                    placeholder="e.g. Sara Mahmoud"
                                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                                    value={newUser.name}
                                    onChange={(e) => { setUserFeedback({ type: '', text: '' }); setNewUser({ ...newUser, name: e.target.value }); }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Username</label>
                                <input
                                    required
                                    placeholder="e.g. sara"
                                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                                    value={newUser.username}
                                    onChange={(e) => { setUserFeedback({ type: '', text: '' }); setNewUser({ ...newUser, username: e.target.value }); }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Password</label>
                                <input
                                    required
                                    placeholder="e.g. sara123"
                                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                                    value={newUser.password}
                                    onChange={(e) => { setUserFeedback({ type: '', text: '' }); setNewUser({ ...newUser, password: e.target.value }); }}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-600 mb-1">Role</label>
                                <select
                                    className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-white text-sm"
                                    value={newUser.role}
                                    onChange={(e) => { setUserFeedback({ type: '', text: '' }); setNewUser({ ...newUser, role: e.target.value }); }}
                                >
                                    <option value="user">Regular User</option>
                                    <option value="teamlead">Team Leader</option>
                                </select>
                            </div>
                        </div>

                        {userFeedback.text && (
                            <p className={`text-sm font-medium rounded-xl px-4 py-3 border fade-in ${
                                userFeedback.type === 'error'
                                    ? 'bg-red-50 text-red-600 border-red-100'
                                    : 'bg-green-50 text-green-700 border-green-100'
                            }`}>
                                {userFeedback.text}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-alorica-blue hover:bg-opacity-90 text-white font-bold py-4 px-4 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all"
                        >
                            <Icon name="user-plus" size={20} /> Create User
                        </button>
                    </form>
                </div>

                <h3 className="text-alorica-blue font-bold text-lg mb-3">Existing Users ({allUsers.length})</h3>
                <div className="border border-gray-100 rounded-2xl overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-alorica-light text-alorica-blue">
                                <tr>
                                    <th className="text-left px-4 py-2 font-semibold">Full Name</th>
                                    <th className="text-left px-4 py-2 font-semibold">Username</th>
                                    <th className="text-left px-4 py-2 font-semibold">Role</th>
                                    <th className="text-center px-4 py-2 font-semibold">Remove</th>
                                </tr>
                            </thead>
                            <tbody>
                                {allUsers.map((u) => (
                                    <tr key={u.username} className="border-t border-gray-100">
                                        <td className="px-4 py-2 text-gray-800">{u.name}</td>
                                        <td className="px-4 py-2 text-gray-600">{u.username}</td>
                                        <td className="px-4 py-2">
                                            <span className={`text-xs font-semibold px-2 py-1 rounded-full ${
                                                roleOf(u) === 'admin' ? 'bg-alorica-light text-alorica-blue'
                                                    : roleOf(u) === 'teamlead' ? 'bg-orange-50 text-alorica-orange'
                                                    : 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {ROLE_LABELS[roleOf(u)]}
                                            </span>
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            {u.username === currentUser.username ? (
                                                <span className="text-xs text-gray-400">Signed in</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => onDeleteUser(u.username)}
                                                    className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                                    title={`Delete ${u.username}`}
                                                >
                                                    <Icon name="trash-2" size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
                <p className="text-xs text-gray-400 mt-4 text-center">
                    Pick "Regular User" for employees or "Team Leader" for reviewers. Team Leaders run the operation — they review bookings and leave, manage the fleet and print the sheet.
                </p>

                <div className="mt-10 bg-gray-50 border border-gray-100 rounded-2xl p-6">
                    <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-2">
                        <Icon name="database" size={20} className="text-alorica-orange" /> Data Backup &amp; Restore
                    </h3>
                    <p className="text-xs text-gray-500 mb-4">
                        Download a JSON file with all bookings, buses and user accounts — or restore a previous backup.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            type="button"
                            onClick={onExportBackup}
                            className="bg-white border-2 border-alorica-blue text-alorica-blue font-bold py-3 px-4 rounded-xl hover:bg-alorica-light flex items-center justify-center gap-2 transition-all"
                        >
                            <Icon name="download" size={18} /> Export backup
                        </button>
                        <label className={`bg-white border-2 border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-xl cursor-pointer hover:bg-gray-100 flex items-center justify-center gap-2 transition-all ${importing ? 'opacity-70 cursor-wait' : ''}`}>
                            <Icon name="upload" size={18} /> {importing ? 'Restoring...' : 'Restore backup'}
                            <input
                                type="file"
                                accept="application/json,.json"
                                className="hidden"
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
                </div>
            </div>
        )}

        {/* ================= PASSWORD REQUESTS ================= */}
        {adminView === 'requests' && isAdmin && (
            <div className="max-w-3xl mx-auto">
                <div className="bg-alorica-light rounded-2xl p-6 mb-8">
                    <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-2">
                        <Icon name="key-round" size={20} className="text-alorica-orange" /> Password Reset Requests
                    </h3>
                    <p className="text-xs text-gray-600">
                        Employees who forgot their password appear here. Resetting an account issues a random
                        temporary password that is shown to you once and expires after 24 hours — the employee
                        must choose a new password when they sign in with it.
                    </p>
                </div>

                {passwordRequests.length === 0 ? (
                    <div className="text-center py-16 text-gray-400">
                        <Icon name="shield-check" size={40} className="mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No password requests yet</p>
                    </div>
                ) : (
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-alorica-light text-alorica-blue">
                                    <tr>
                                        <th className="text-left px-4 py-2 font-semibold">Employee</th>
                                        <th className="text-left px-4 py-2 font-semibold">Requested</th>
                                        <th className="text-left px-4 py-2 font-semibold">Status</th>
                                        <th className="text-center px-4 py-2 font-semibold">Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...passwordRequests].reverse().map((r) => (
                                        <tr key={r.id} className={`border-t border-gray-100 ${r.status === 'open' ? 'bg-orange-50 bg-opacity-40' : ''}`}>
                                            <td className="px-4 py-2">
                                                <p className="text-gray-800 font-medium">{r.name}</p>
                                                <p className="text-xs text-gray-400">{r.username}</p>
                                            </td>
                                            <td className="px-4 py-2 text-gray-600">{new Date(r.requestedAt).toLocaleString()}</td>
                                            <td className="px-4 py-2">
                                                {r.status === 'open' ? (
                                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-orange-100 text-alorica-orange">Waiting</span>
                                                ) : r.status === 'resolved' ? (
                                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-50 text-green-700" title={`Handled by ${r.resolvedBy || 'admin'}`}>
                                                        Reset done
                                                    </span>
                                                ) : (
                                                    <span className="text-xs font-semibold px-2 py-1 rounded-full bg-gray-100 text-gray-500">Discarded</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-2">
                                                {r.status === 'open' ? (
                                                    <div className="flex items-center justify-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => onResetPassword(r.id)}
                                                            className="text-xs font-semibold px-3 py-2 rounded-lg bg-alorica-blue text-white hover:bg-opacity-90 transition-colors"
                                                        >
                                                            Reset password
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onDismissRequest(r.id)}
                                                            className="text-xs font-semibold px-3 py-2 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-100 transition-colors"
                                                        >
                                                            Discard
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <p className="text-xs text-gray-400 text-center">
                                                        {r.resolvedAt ? `by ${r.resolvedBy || 'admin'} · ${new Date(r.resolvedAt).toLocaleString()}` : '—'}
                                                    </p>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                <p className="text-xs text-gray-400 mt-4 text-center">
                    The request is stored on the server, so the IT admin sees it from any device.
                    The employee is not emailed — pass the temporary password to them yourself.
                </p>
            </div>
        )}

        {/* ================= CHANGE REQUESTS ================= */}
        {adminView === 'changes' && isTeamLead && (
            <div className="max-w-4xl mx-auto space-y-10">
                <div className="bg-alorica-light rounded-2xl p-6">
                    <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-2">
                        <Icon name="git-pull-request" size={20} className="text-alorica-orange" /> Booking Change Requests
                    </h3>
                    <p className="text-xs text-gray-600">
                        Every adjustment the team leader makes is sent to the employee first. Nothing is applied
                        until they approve it, and a request nobody answers lapses automatically after 48 hours.
                        The reverse also lands here: an employee changing a booking less than an hour before the
                        pickup needs a team leader to approve it.
                    </p>
                </div>

                {pendingChanges.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <Icon name="inbox" size={40} className="mx-auto mb-3 opacity-50" />
                        <p className="font-medium">No change requests yet</p>
                    </div>
                ) : (
                    <div className="border border-gray-100 rounded-2xl overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm min-w-[820px]">
                                <thead className="bg-alorica-light text-alorica-blue">
                                    <tr>
                                        <th className="text-left px-4 py-2 font-semibold">Employee</th>
                                        <th className="text-left px-4 py-2 font-semibold">Booking</th>
                                        <th className="text-left px-4 py-2 font-semibold">Requested change</th>
                                        <th className="text-left px-4 py-2 font-semibold">By</th>
                                        <th className="text-center px-4 py-2 font-semibold">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...pendingChanges].reverse().map((r) => {
                                        const state = requestStatus(r);
                                        return (
                                            <tr key={r.id} className={`border-t border-gray-100 ${r.status === 'pending' ? 'bg-orange-50 bg-opacity-40' : ''}`}>
                                                <td className="px-4 py-3">
                                                    <p className="text-gray-800 font-medium">{r.snapshot.employeeName || r.bookingId}</p>
                                                    <p className="text-xs text-gray-400">{r.snapshot.type} · {new Date(r.requestedAt).toLocaleString()}</p>
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    {r.snapshot.date} at {formatTime12h(r.snapshot.time)}
                                                </td>
                                                <td className="px-4 py-3">
                                                    {r.changes.map((c) => (
                                                        <span key={c.field} className="inline-flex items-center gap-1 text-xs text-gray-600 mr-2 whitespace-nowrap">
                                                            <span className="font-semibold">{c.label}:</span>
                                                            <span className="text-gray-400 line-through">{changeValue(c, c.from)}</span>
                                                            <Icon name="arrow-right" size={12} className="text-alorica-orange" />
                                                            <span className="font-semibold text-alorica-blue">{changeValue(c, c.to)}</span>
                                                        </span>
                                                    ))}
                                                </td>
                                                <td className="px-4 py-3 text-gray-600">
                                                    <p>{r.requestedByName}</p>
                                                    <p className="text-[10px] text-gray-400">
                                                        {r.direction === 'employee' ? 'Employee request' : 'Team leader request'}
                                                    </p>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span className={`text-xs font-semibold px-2 py-1 rounded-full whitespace-nowrap ${state.cls}`}>
                                                        {state.label}
                                                    </span>
                                                    {r.status === 'pending' && (
                                                        <p className="text-[10px] text-gray-400 mt-1">expires in {hoursLeft(r)}h</p>
                                                    )}
                                                    {r.status !== 'pending' && r.decidedAt && (
                                                        <p className="text-[10px] text-gray-400 mt-1">
                                                            {r.decidedBy === 'system' ? 'auto' : r.decidedBy} · {new Date(r.decidedAt).toLocaleString()}
                                                        </p>
                                                    )}
                                                    {r.status === 'pending' && isTeamLead && r.direction !== 'employee' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onOverrideRequest(r)}
                                                            className="mt-2 text-[11px] font-semibold px-2 py-1 rounded-lg bg-red-50 text-red-700 border border-red-100 hover:bg-red-100 transition-colors inline-flex items-center gap-1"
                                                        >
                                                            <Icon name="zap" size={12} /> Emergency override
                                                        </button>
                                                    )}
                                                    {r.status === 'overridden' && r.overrideReason && (
                                                        <p className="text-[10px] text-red-600 mt-1 max-w-[14rem] mx-auto">{r.overrideReason}</p>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>
        )}

        {/* ================= VACATIONS ================= */}
        {adminView === 'vacations' && isTeamLead && (
            <div className="max-w-4xl mx-auto space-y-10">
                <div>
                    <div className="bg-alorica-light rounded-2xl p-6 mb-8">
                        <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-2">
                            <Icon name="calendar-check" size={20} className="text-alorica-orange" /> Pending Leave Requests
                        </h3>
                        <p className="text-xs text-gray-600">
                            Review and approve or reject employee leave requests.
                        </p>
                    </div>
                    <VacationReview
                        vacations={vacations}
                        allUsers={[...DEFAULT_USERS, ...customUsers]}
                        onApprove={onApproveVacation}
                        onReject={onRejectVacation}
                        currentUser={currentUser}
                    />
                </div>

                <div>
                    <div className="bg-alorica-light rounded-2xl p-6 mb-8">
                        <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-2">
                            <Icon name="bar-chart-2" size={20} className="text-alorica-orange" /> Leave Reports
                        </h3>
                        <p className="text-xs text-gray-600">
                            View leave statistics and export reports.
                        </p>
                    </div>
                    <VacationReports
                        vacations={vacations}
                        allUsers={[...DEFAULT_USERS, ...customUsers]}
                        vacationBalances={vacationBalances}
                        onExportExcel={onExportVacationExcel}
                    />
                </div>
            </div>
        )}

        {/* ================= AUDIT LOG ================= */}
        {adminView === 'audit' && isAdmin && (
            <div className="max-w-4xl mx-auto">
                <div className="bg-alorica-light rounded-2xl p-6 mb-8">
                    <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-lg mb-2">
                        <Icon name="history" size={20} className="text-alorica-orange" /> Activity log
                    </h3>
                    <p className="text-xs text-gray-600">
                        Every action recorded by the system, newest first. It is trimmed to the last 400 entries.
                    </p>
                </div>
                {auditLog.length === 0 ? (
                    <p className="text-center text-gray-400 py-8 text-sm">Nothing recorded yet.</p>
                ) : (
                    <div className="border border-gray-100 rounded-2xl divide-y divide-gray-50 max-h-[36rem] overflow-y-auto">
                        {[...auditLog].reverse().map((entry) => (
                            <div key={entry.id} className="px-4 py-3 flex items-start gap-3">
                                <span className="mt-0.5 shrink-0 text-alorica-orange">
                                    <Icon name="dot" size={18} />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-alorica-blue font-semibold">
                                        {entry.action} <span className="text-gray-400 font-normal">·</span>{' '}
                                        <span className="font-medium text-gray-700">{entry.target}</span>
                                    </p>
                                    {entry.details && <p className="text-xs text-gray-500 mt-0.5">{entry.details}</p>}
                                    <p className="text-[10px] text-gray-400 mt-1">
                                        {entry.actorName} ({ROLE_LABELS[entry.actorRole] || entry.actorRole}) · {new Date(entry.at).toLocaleString()}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        )}

        </div>
    </div>
    );
};
