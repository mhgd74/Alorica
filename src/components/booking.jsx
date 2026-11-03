/*
 * The employee side of a booking: making one, changing one, listing your own.
 */

import { Icon } from './common.js';
import { canEditBooking, needsLeaderApproval } from '../lib/booking.js';
import { ALL_POINTS, FIXED_LOCATIONS, SHIFT_SLOTS, WAITLIST } from '../lib/config.js';
import { formatTime12h, todayISO } from '../lib/format.js';
import { LIVE_SETTINGS } from '../lib/settings.js';

const { useState, useEffect, useMemo } = React;



export const BookingForm = ({
    activeTab, setActiveTab,
    formData, setFormData,
    selectedRoad, setSelectedRoad,
    onSubmit,
    dropOffLabel, dropOffIcon, timeLabel
}) => {
    const shiftSlots = LIVE_SETTINGS.shiftSlots[activeTab] || SHIFT_SLOTS[activeTab];

    return (
    <>
        <div className="bg-alorica-blue p-6 sm:p-8 text-white text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-2">Transportation</h2>
            <p className="opacity-80">Select Arrival or Departure to complete your booking</p>
        </div>

        <div className="flex justify-center gap-3 sm:gap-4 pt-6 px-4">
            <button
                type="button"
                onClick={() => { setActiveTab('arrival'); setFormData({ ...formData, time: '' }); }}
                className={`flex items-center gap-2 px-8 sm:px-12 py-3 rounded-xl font-bold text-sm sm:text-base transition-all ${
                    activeTab === 'arrival'
                        ? 'bg-green-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-alorica-blue hover:bg-alorica-light'
                }`}
            >
                <Icon name="bus" size={18} /> Arrival
            </button>
            <button
                type="button"
                onClick={() => { setActiveTab('departure'); setFormData({ ...formData, time: '' }); }}
                className={`flex items-center gap-2 px-8 sm:px-12 py-3 rounded-xl font-bold text-sm sm:text-base transition-all ${
                    activeTab === 'departure'
                        ? 'bg-red-600 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-alorica-blue hover:bg-alorica-light'
                }`}
            >
                <Icon name="bus" size={18} /> Departure
            </button>
        </div>

        <form key={activeTab} onSubmit={onSubmit} className="p-4 sm:p-8 fade-in">
            <div className="max-w-2xl mx-auto space-y-6">
                <div>
                    <label className="flex flex-wrap items-center justify-between text-alorica-blue font-bold mb-2 gap-2">
                        <span className="flex items-center gap-2"><Icon name={dropOffIcon} size={18} className="text-alorica-orange" /> {dropOffLabel}</span>
                    </label>

                    {/* Road Selection Buttons */}
                    <div className="grid grid-cols-3 sm:grid-cols-9 gap-2 mb-3">
                        {Object.keys(FIXED_LOCATIONS).map((road) => (
                            <button
                                key={road}
                                type="button"
                                onClick={() => setSelectedRoad(road)}
                                className={`py-2 text-xs font-bold rounded-lg border-2 transition-all ${
                                    selectedRoad === road
                                        ? 'bg-alorica-orange text-white border-alorica-orange'
                                        : 'bg-white text-alorica-blue border-gray-100 hover:border-alorica-light'
                                }`}
                            >
                                {road}
                            </button>
                        ))}
                    </div>

                    {/* Sub-location Selection (Visible only when a road is selected) */}
                    {selectedRoad && (
                        <div className="flex flex-wrap gap-2 mb-3 p-3 bg-gray-50 rounded-xl border-2 border-gray-100 max-h-48 overflow-y-auto">
                            {FIXED_LOCATIONS[selectedRoad].map((point) => (
                                <button
                                    key={point}
                                    type="button"
                                    onClick={() => setFormData({ ...formData, dropOffLocation: point })}
                                    className={`px-3 py-1.5 text-[11px] font-semibold rounded-full border transition-all ${
                                        formData.dropOffLocation === point
                                            ? 'bg-alorica-blue text-white border-alorica-blue'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-alorica-blue hover:text-alorica-blue'
                                    }`}
                                >
                                    {point}
                                </button>
                            ))}
                        </div>
                    )}

                    <input
                        list="fixed-locations"
                        required
                        placeholder={`Select or enter ${dropOffLabel.toLowerCase()}`}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-gray-50 text-sm sm:text-base"
                        value={formData.dropOffLocation}
                        onChange={(e) => setFormData({ ...formData, dropOffLocation: e.target.value })}
                    />
                </div>

                <div>
                    <label className="flex items-center gap-2 text-alorica-blue font-bold mb-2">
                        <Icon name="clock" size={18} className="text-alorica-orange" /> {timeLabel}
                    </label>
                    <div className="rounded-2xl border border-gray-100 bg-white shadow-lg p-4 sm:p-5 space-y-4">
                        {shiftSlots.map((group) => (
                            <div key={group.shift}>
                                <p className="flex items-center gap-1.5 text-[11px] font-black text-gray-400 uppercase tracking-wider mb-2">
                                    <Icon name="bus" size={13} className="text-alorica-orange" /> {group.shift}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {group.times.map((t) => (
                                        <button
                                            key={t}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, time: t })}
                                            className={`px-4 py-2.5 rounded-xl border-2 text-sm font-bold tabular-nums transition-all ${
                                                formData.time === t
                                                    ? 'bg-alorica-orange text-white border-alorica-orange shadow-lg scale-105'
                                                    : 'bg-white text-alorica-blue border-gray-100 hover:border-alorica-orange'
                                            }`}
                                        >
                                            {formatTime12h(t)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                        <p className="text-[11px] text-gray-400">Choose the loading time that matches your shift.</p>
                    </div>
                </div>

                <div>
                    <label className="flex items-center gap-2 text-alorica-blue font-bold mb-2">
                        <Icon name="calendar" size={18} className="text-alorica-orange" /> Calendar
                    </label>
                    <input
                        type="date"
                        required
                        min={todayISO()}
                        className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-gray-50"
                        value={formData.date}
                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    />
                </div>

                <datalist id="fixed-locations">
                    {ALL_POINTS.map((loc, index) => (
                        <option key={index} value={loc} />
                    ))}
                </datalist>

                <div className="pt-2">
                    <button
                        type="submit"
                        className="w-full bg-alorica-orange hover:shadow-2xl text-white font-black text-xl py-5 rounded-2xl shadow-xl transform active:scale-[0.98] transition-all flex items-center justify-center gap-3 group"
                    >
                        Book now
                        <Icon name="chevron-right" size={24} className="group-hover:translate-x-2 transition-transform" />
                    </button>
                </div>
            </div>
        </form>
    </>
    );
};


// The employee fixes their own booking here. When the pickup is less
// than an hour away the same form turns into a request for the team leader.
export const EditBookingDialog = ({ booking, canSelfApprove, onCancel, onSubmit }) => {
    const [form, setForm] = useState({
        type: booking.type,
        date: booking.date,
        time: booking.time,
        location: booking.location || ''
    });
    const [error, setError] = useState('');
    const shiftSlots = LIVE_SETTINGS.shiftSlots[form.type === 'Arrival' ? 'arrival' : 'departure'];

    // Sending the booking to a slot inside the next hour needs approval too,
    // otherwise the cutoff could simply be stepped around.
    const tooSoon = Boolean(form.time) && !canEditBooking({ date: form.date, time: form.time });
    const locked = !canSelfApprove && needsLeaderApproval(booking, form);

    const submit = (e) => {
        e.preventDefault();
        if (!form.time) { setError('Please select a time.'); return; }
        if (form.date < todayISO()) { setError('The booking date cannot be in the past.'); return; }
        if (!form.location.trim()) { setError('Please enter the location.'); return; }
        onSubmit({ ...form, location: form.location.trim() });
    };

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-40 p-4">
            <form onSubmit={submit} className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto fade-in">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
                    <Icon name="pencil" size={18} className="text-alorica-orange" />
                    <h3 className="font-bold text-alorica-blue">Edit booking</h3>
                </div>

                <div className="p-6 space-y-5">
                    {locked && (
                        <div className="flex items-start gap-2 text-xs bg-orange-50 border border-orange-100 text-alorica-orange rounded-xl p-3">
                            <Icon name="alert-triangle" size={16} className="shrink-0 mt-0.5" />
                            <span>
                                {tooSoon
                                    ? 'The time you picked is less than an hour away, so this change needs your team leader\'s approval.'
                                    : 'Less than an hour is left before this pickup, so it can no longer be changed directly. Send the change to your team leader — it is applied once they approve it.'}
                            </span>
                        </div>
                    )}

                    <div>
                        <label className="flex items-center gap-2 text-alorica-blue font-bold mb-2 text-sm">
                            <Icon name="bus" size={16} className="text-alorica-orange" /> Direction
                        </label>
                        <div className="flex gap-3">
                            {['Arrival', 'Departure'].map((direction) => (
                                <button
                                    key={direction}
                                    type="button"
                                    onClick={() => setForm({ ...form, type: direction, time: '' })}
                                    className={`flex-1 py-2.5 rounded-xl font-bold text-sm border-2 transition-all ${
                                        form.type === direction
                                            ? (direction === 'Arrival' ? 'bg-green-600 text-white border-green-600' : 'bg-red-600 text-white border-red-600')
                                            : 'bg-white text-alorica-blue border-gray-100 hover:border-alorica-light'
                                    }`}
                                >
                                    {direction}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-alorica-blue font-bold mb-2 text-sm">
                            <Icon name="clock" size={16} className="text-alorica-orange" />
                            {form.type === 'Arrival' ? 'Pickup time' : 'Drop-off time'}
                        </label>
                        <div className="rounded-2xl border border-gray-100 bg-white p-4 space-y-3 max-h-56 overflow-y-auto">
                            {shiftSlots.map((group) => (
                                <div key={group.shift}>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider mb-1.5">{group.shift}</p>
                                    <div className="flex flex-wrap gap-2">
                                        {group.times.map((t) => (
                                            <button
                                                key={t}
                                                type="button"
                                                onClick={() => setForm({ ...form, time: t })}
                                                className={`px-3 py-2 rounded-xl border-2 text-xs font-bold tabular-nums transition-all ${
                                                    form.time === t
                                                        ? 'bg-alorica-orange text-white border-alorica-orange'
                                                        : 'bg-white text-alorica-blue border-gray-100 hover:border-alorica-orange'
                                                }`}
                                            >
                                                {formatTime12h(t)}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-alorica-blue font-bold mb-2 text-sm">
                            <Icon name="calendar" size={16} className="text-alorica-orange" /> Date
                        </label>
                        <input
                            type="date"
                            required
                            min={todayISO()}
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-gray-50 text-sm"
                            value={form.date}
                            onChange={(e) => setForm({ ...form, date: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="flex items-center gap-2 text-alorica-blue font-bold mb-2 text-sm">
                            <Icon name="map-pin" size={16} className="text-alorica-orange" />
                            {form.type === 'Arrival' ? 'Pickup location' : 'Drop off location'}
                        </label>
                        <input
                            list="edit-locations"
                            required
                            placeholder="Select or enter the location"
                            className="w-full px-4 py-3 border-2 border-gray-100 rounded-xl outline-none bg-gray-50 text-sm"
                            value={form.location}
                            onChange={(e) => setForm({ ...form, location: e.target.value })}
                        />
                        <datalist id="edit-locations">
                            {ALL_POINTS.map((loc, index) => (
                                <option key={index} value={loc} />
                            ))}
                        </datalist>
                    </div>

                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                        <Icon name="bus" size={14} className="text-alorica-orange" />
                        Bus stays on {booking.bus}.
                    </p>

                    {error && <p className="text-xs text-red-600">{error}</p>}
                </div>

                <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        className={`flex-1 px-4 py-2.5 rounded-lg text-white font-semibold text-sm transition-colors ${
                            locked ? 'bg-alorica-blue hover:bg-opacity-90' : 'bg-alorica-orange hover:opacity-90'
                        }`}
                    >
                        {locked ? 'Send to team leader' : 'Save changes'}
                    </button>
                </div>
            </form>
        </div>
    );
};


export const MyBookings = ({ bookings, onDelete, onEdit, pendingChanges, canSelfApprove }) => {
    const pendingFor = (id) => pendingChanges.find((r) => r.bookingId === id && r.status === 'pending');
    return (
    <div className="p-4 sm:p-8 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between mb-6">
            <h3 className="flex items-center gap-2 text-alorica-blue font-bold text-xl">
                <Icon name="calendar-check" size={24} className="text-alorica-orange" /> My Bookings
            </h3>
        </div>

        {bookings.length === 0 ? (
            <div className="text-center py-10 bg-white rounded-2xl border-2 border-dashed border-gray-200">
                <Icon name="calendar" size={48} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 font-medium">You have no bookings yet.</p>
            </div>
        ) : (
            <div className="space-y-4">
                {bookings.map((b) => (
                    <div key={b.id} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 flex flex-wrap items-center justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${b.type === 'Arrival' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                <Icon name="bus" size={24} />
                            </div>
                            <div>
                                <p className="font-bold text-alorica-blue">{b.date} at {formatTime12h(b.time)}</p>
                                <p className="text-xs text-gray-500 flex items-center gap-1">
                                    <Icon name="map-pin" size={12} /> {b.location}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-6">
                            <div className="text-right">
                                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bus</p>
                                <p className={`font-bold ${b.bus === WAITLIST ? 'text-red-600' : 'text-alorica-orange'}`}>{b.bus}</p>
                            </div>
                            {!canSelfApprove && !canEditBooking(b) && !pendingFor(b.id) && (
                                <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-semibold text-alorica-orange bg-orange-50 border border-orange-100 rounded-full px-2.5 py-1">
                                    <Icon name="clock" size={10} /> Needs leader approval
                                </span>
                            )}
                            <button
                                onClick={() => onEdit(b)}
                                disabled={Boolean(pendingFor(b.id))}
                                className={`p-3 rounded-xl border border-transparent transition-colors ${
                                    pendingFor(b.id)
                                        ? 'text-gray-300 cursor-not-allowed'
                                        : 'text-alorica-blue hover:bg-blue-50 hover:border-blue-100'
                                }`}
                                title={pendingFor(b.id)
                                    ? 'A request for this booking is already waiting'
                                    : canEditBooking(b) || canSelfApprove
                                        ? 'Edit booking'
                                        : 'Less than an hour left — the team leader must approve the change'}
                            >
                                <Icon name="pencil" size={20} />
                            </button>
                            <button
                                onClick={() => onDelete(b.id)}
                                className="p-3 hover:bg-red-50 rounded-xl text-red-500 transition-colors border border-transparent hover:border-red-100"
                                title="Delete booking"
                            >
                                <Icon name="trash-2" size={20} />
                            </button>
                        </div>

                        {pendingFor(b.id) && (
                            <div className="w-full mt-1 pt-3 border-t border-orange-100 flex flex-wrap items-center gap-2 text-xs">
                                <span className="inline-flex items-center gap-1 font-semibold text-alorica-orange bg-orange-50 border border-orange-100 rounded-full px-3 py-1.5">
                                    <Icon name="clock" size={12} />
                                    {pendingFor(b.id).direction === 'employee'
                                        ? 'Your change is waiting for the team leader'
                                        : pendingFor(b.id).kind === 'delete'
                                            ? 'The team leader asked to delete this booking'
                                            : `The team leader asked to change the bus to ${pendingFor(b.id).changes[0].to}`}
                                </span>
                                <span className="text-gray-500">
                                    {pendingFor(b.id).direction === 'employee'
                                        ? 'You will be notified once they answer.'
                                        : 'Respond from the bell menu at the top.'}
                                </span>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        )}
    </div>
    );
};
