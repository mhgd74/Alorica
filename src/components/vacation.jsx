/*
 * Asking for leave, seeing your own, reviewing, and the reports.
 */

import { Icon } from './common.js';
import { VACATION_STATUS, VACATION_TYPES } from '../lib/config.js';
import { todayISO } from '../lib/format.js';
import { freshVacationBalance } from '../lib/vacation.js';

const { useState, useEffect, useMemo } = React;



// Vacation request form for employees
export const VacationRequestForm = ({ currentUser, vacationBalances, onSubmit, onCancel, pushToast }) => {
    const [form, setForm] = useState({
        type: 'annual',
        startDate: '',
        endDate: '',
        reason: ''
    });
    const [error, setError] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setError('');

        if (!form.startDate || !form.endDate) {
            setError('Please select both start and end dates.');
            return;
        }

        const start = new Date(form.startDate);
        const end = new Date(form.endDate);
        const today = new Date(todayISO());

        if (start < today) {
            setError('Cannot request leave in the past.');
            return;
        }

        if (end < start) {
            setError('End date must be after start date.');
            return;
        }

        const days = Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1;
        const balance = vacationBalances.find(b => b.employeeId === currentUser.username) 
            || freshVacationBalance(currentUser.username);

        const availableDays = form.type === 'annual' ? balance.annual - balance.usedAnnual
            : form.type === 'sick' ? balance.sick - balance.usedSick
            : form.type === 'personal' ? balance.personal - balance.usedPersonal
            : Infinity;

        if (form.type !== 'unpaid' && form.type !== 'emergency' && days > availableDays) {
            setError(`Insufficient balance. Available: ${availableDays} days.`);
            return;
        }

        onSubmit({
            ...form,
            days,
            employeeId: currentUser.username,
            employeeName: currentUser.name
        });
    };

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-xl mb-6">
                <Icon name="calendar-plus" size={24} className="text-alorica-orange" /> Request Leave
            </h3>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
                    <select
                        value={form.type}
                        onChange={(e) => setForm({ ...form, type: e.target.value })}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-alorica-orange text-gray-800"
                    >
                        {Object.entries(VACATION_TYPES).map(([key, v]) => (
                            <option key={key} value={key}>{v.label}</option>
                        ))}
                    </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                        <input
                            type="date"
                            value={form.startDate}
                            onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                            min={todayISO()}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-alorica-orange text-gray-800"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                        <input
                            type="date"
                            value={form.endDate}
                            onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                            min={form.startDate || todayISO()}
                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-alorica-orange text-gray-800"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <textarea
                        value={form.reason}
                        onChange={(e) => setForm({ ...form, reason: e.target.value })}
                        rows={3}
                        placeholder="Please provide a reason for your leave request..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-alorica-orange text-gray-800 resize-none"
                    />
                </div>

                {error && (
                    <p className="text-red-500 text-sm font-medium bg-red-50 py-2 px-3 rounded-lg">{error}</p>
                )}

                <div className="flex gap-3 pt-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className="flex-1 px-4 py-2.5 rounded-lg bg-alorica-blue text-white font-semibold text-sm hover:bg-opacity-90 transition-colors"
                    >
                        Submit Request
                    </button>
                </div>
            </form>
        </div>
    );
};


// Vacation display for employees
export const MyVacations = ({ vacations, currentUser, vacationBalances, onCancel, onRequestVacation }) => {
    const myVacations = vacations.filter(v => v.employeeId === currentUser.username);
    const balance = vacationBalances.find(b => b.employeeId === currentUser.username) 
        || freshVacationBalance(currentUser.username);

    const remaining = {
        annual: balance.annual - balance.usedAnnual,
        sick: balance.sick - balance.usedSick,
        personal: balance.personal - balance.usedPersonal
    };

    return (
        <div className="p-4 sm:p-8 border-t border-gray-100 bg-gray-50/50">
            <div className="flex items-center justify-between mb-6">
                <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-xl">
                    <Icon name="calendar" size={24} className="text-alorica-orange" /> My Leave
                </h3>
                <button
                    type="button"
                    onClick={onRequestVacation}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-alorica-orange text-white font-semibold text-sm hover:bg-opacity-90 transition-colors"
                >
                    <Icon name="calendar-plus" size={16} /> Request Leave
                </button>
            </div>

            {/* Balance Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
                {Object.entries(VACATION_TYPES).filter(([k]) => k !== 'unpaid' && k !== 'emergency').map(([key, v]) => (
                    <div key={key} className={`bg-white rounded-xl p-4 border-2 ${remaining[key] > 0 ? 'border-green-200' : 'border-red-200'}`}>
                        <div className="flex items-center justify-between mb-2">
                            <span className={`text-xs font-bold uppercase ${v.color === 'green' ? 'text-green-600' : v.color === 'red' ? 'text-red-600' : 'text-blue-600'}`}>
                                {v.label}
                            </span>
                            <Icon name={v.color === 'green' ? 'check-circle' : v.color === 'red' ? 'heart' : 'user'} size={16} className={v.color === 'green' ? 'text-green-500' : v.color === 'red' ? 'text-red-500' : 'text-blue-500'} />
                        </div>
                        <div className="flex items-end gap-1">
                            <span className={`text-2xl font-black ${remaining[key] > 0 ? 'text-green-700' : 'text-red-600'}`}>
                                {remaining[key]}
                            </span>
                            <span className="text-xs text-gray-500 mb-1">/ {v.defaultDays} days</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* Vacation History */}
            {myVacations.length === 0 ? (
                <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                    <Icon name="calendar-off" size={48} className="mx-auto text-gray-300 mb-3" />
                    <p className="text-gray-500 font-medium">No leave requests yet.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {myVacations.map((v) => (
                        <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                            <div className="flex flex-wrap items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                        VACATION_TYPES[v.type]?.color === 'green' ? 'bg-green-100 text-green-600' :
                                        VACATION_TYPES[v.type]?.color === 'red' ? 'bg-red-100 text-red-600' :
                                        VACATION_TYPES[v.type]?.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                                        VACATION_TYPES[v.type]?.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                                        'bg-gray-100 text-gray-600'
                                    }`}>
                                        <Icon name="calendar" size={24} />
                                    </div>
                                    <div>
                                        <p className="font-bold text-alorica-blue">{VACATION_TYPES[v.type]?.label || v.type}</p>
                                        <p className="text-xs text-gray-500">
                                            {v.startDate} - {v.endDate} ({v.days} day{v.days > 1 ? 's' : ''})
                                        </p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${VACATION_STATUS[v.status]?.cls || 'bg-gray-100 text-gray-600'}`}>
                                        {VACATION_STATUS[v.status]?.label || v.status}
                                    </span>
                                    {v.status === 'pending' && (
                                        <button
                                            onClick={() => onCancel(v.id)}
                                            className="p-2 hover:bg-red-50 rounded-lg text-red-500 transition-colors"
                                            title="Cancel request"
                                        >
                                            <Icon name="x" size={18} />
                                        </button>
                                    )}
                                </div>
                            </div>

                            {v.reason && (
                                <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                                    Reason: {v.reason}
                                </p>
                            )}

                            {v.comments && (
                                <p className="text-sm text-gray-500 mt-2 italic">
                                    Manager note: {v.comments}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};


// Vacation review for team leaders
export const VacationReview = ({ vacations, allUsers, onApprove, onReject, currentUser }) => {
    const pendingVacations = vacations.filter(v => v.status === 'pending' && v.employeeId !== currentUser.username);

    if (pendingVacations.length === 0) {
        return (
            <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <Icon name="check-circle" size={48} className="mx-auto text-green-300 mb-3" />
                <p className="text-gray-500 font-medium">No pending leave requests to review.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {pendingVacations.map((v) => (
                <div key={v.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                                VACATION_TYPES[v.type]?.color === 'green' ? 'bg-green-100 text-green-600' :
                                VACATION_TYPES[v.type]?.color === 'red' ? 'bg-red-100 text-red-600' :
                                VACATION_TYPES[v.type]?.color === 'blue' ? 'bg-blue-100 text-blue-600' :
                                VACATION_TYPES[v.type]?.color === 'orange' ? 'bg-orange-100 text-orange-600' :
                                'bg-gray-100 text-gray-600'
                            }`}>
                                <Icon name="calendar" size={24} />
                            </div>
                            <div>
                                <p className="font-bold text-alorica-blue">{v.employeeName}</p>
                                <p className="text-xs text-gray-500">{VACATION_TYPES[v.type]?.label || v.type}</p>
                                <p className="text-xs text-gray-500">
                                    {v.startDate} - {v.endDate} ({v.days} day{v.days > 1 ? 's' : ''})
                                </p>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button
                                onClick={() => onApprove(v.id)}
                                className="px-4 py-2 rounded-lg bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors"
                            >
                                Approve
                            </button>
                            <button
                                onClick={() => onReject(v.id)}
                                className="px-4 py-2 rounded-lg border border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-colors"
                            >
                                Reject
                            </button>
                        </div>
                    </div>

                    {v.reason && (
                        <p className="text-sm text-gray-600 mt-3 pt-3 border-t border-gray-100">
                            Reason: {v.reason}
                        </p>
                    )}

                    <p className="text-xs text-gray-400 mt-2">
                        Requested: {new Date(v.requestedAt).toLocaleString()}
                    </p>
                </div>
            ))}
        </div>
    );
};


// Vacation reports for admin
export const VacationReports = ({ vacations, allUsers, vacationBalances, onExportExcel }) => {
    const stats = {
        total: vacations.length,
        pending: vacations.filter(v => v.status === 'pending').length,
        approved: vacations.filter(v => v.status === 'approved').length,
        rejected: vacations.filter(v => v.status === 'rejected').length,
        totalDays: vacations.filter(v => v.status === 'approved').reduce((sum, v) => sum + v.days, 0)
    };

    const typeDistribution = Object.keys(VACATION_TYPES).map(type => ({
        type,
        count: vacations.filter(v => v.type === type && v.status === 'approved').length,
        days: vacations.filter(v => v.type === type && v.status === 'approved').reduce((sum, v) => sum + v.days, 0)
    }));

    return (
        <div className="space-y-6">
            {/* Quick Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-4 text-center border border-blue-200">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Icon name="calendar" size={20} className="text-alorica-blue" />
                        <p className="text-3xl font-black text-alorica-blue">{stats.total}</p>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold">Total Requests</p>
                </div>
                <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-4 text-center border border-yellow-200">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Icon name="clock" size={20} className="text-yellow-600" />
                        <p className="text-3xl font-black text-yellow-600">{stats.pending}</p>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold">Pending</p>
                </div>
                <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-4 text-center border border-green-200">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Icon name="check-circle" size={20} className="text-green-700" />
                        <p className="text-3xl font-black text-green-700">{stats.approved}</p>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold">Approved</p>
                </div>
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-4 text-center border border-red-200">
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <Icon name="x-circle" size={20} className="text-red-600" />
                        <p className="text-3xl font-black text-red-600">{stats.rejected}</p>
                    </div>
                    <p className="text-xs text-gray-600 font-semibold">Rejected</p>
                </div>
            </div>

            {/* Type Distribution */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                <h4 className="font-bold text-alorica-blue mb-4">Leave Type Distribution</h4>
                <div className="space-y-3">
                    {typeDistribution.map(({ type, count, days }) => (
                        <div key={type} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className={`w-3 h-3 rounded-full ${
                                    VACATION_TYPES[type]?.color === 'green' ? 'bg-green-500' :
                                    VACATION_TYPES[type]?.color === 'red' ? 'bg-red-500' :
                                    VACATION_TYPES[type]?.color === 'blue' ? 'bg-blue-500' :
                                    VACATION_TYPES[type]?.color === 'orange' ? 'bg-orange-500' :
                                    'bg-gray-500'
                                }`} />
                                <span className="text-sm font-medium text-gray-700">{VACATION_TYPES[type]?.label || type}</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-gray-500">{count} requests</span>
                                <span className="text-sm font-bold text-alorica-blue">{days} days</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Export Button */}
            <button
                onClick={onExportExcel}
                className="w-full px-4 py-3 rounded-xl bg-alorica-blue text-white font-semibold hover:bg-opacity-90 transition-colors flex items-center justify-center gap-2"
            >
                <Icon name="download" size={20} /> Export to Excel
            </button>
        </div>
    );
};
