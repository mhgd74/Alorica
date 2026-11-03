/*
 * Confirmation, override and temporary-password prompts.
 */

import { Icon } from './common.js';

const { useState, useEffect, useMemo } = React;



// In-app confirmation dialog (window.confirm cannot be styled).
export const ConfirmDialog = ({ message, onConfirm, onCancel }) => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 fade-in">
            <div className="flex items-start gap-3">
                <div className="shrink-0 w-10 h-10 rounded-full bg-orange-50 flex items-center justify-center text-alorica-orange">
                    <Icon name="alert-triangle" size={20} />
                </div>
                <p className="text-sm text-gray-700 pt-2">{message}</p>
            </div>
            <div className="flex gap-3 mt-6">
                <button
                    type="button"
                    onClick={onCancel}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm hover:bg-red-700 transition-colors"
                >
                    Confirm
                </button>
            </div>
        </div>
    </div>
);


// The team leader's escape hatch: an urgent change that cannot wait for the
// employee to answer. It applies straight away, so a reason is required and
// the employee is told exactly why it happened.
export const OverrideDialog = ({ request, onCancel, onConfirm }) => {
    const [reason, setReason] = useState('');
    const ready = reason.trim().length >= 10;
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-40 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in">
                <div className="flex items-start gap-3">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-red-50 flex items-center justify-center text-red-600">
                        <Icon name="zap" size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-alorica-blue">Emergency override</h3>
                        <p className="text-xs text-gray-500 mt-1">
                            This applies the request immediately without {request.snapshot.employeeName || 'the employee'}'s
                            approval. They are notified with your reason, and the action is recorded in the activity log.
                        </p>
                    </div>
                </div>

                <label className="block text-xs font-semibold text-gray-600 mt-5 mb-1">
                    Reason (at least 10 characters)
                </label>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows={3}
                    placeholder="e.g. Bus cancelled by the vendor — rerouted before the morning shift."
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-alorica-orange resize-none"
                />

                <div className="flex gap-3 mt-5">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 px-4 py-2.5 rounded-lg border border-gray-200 text-gray-600 font-semibold text-sm hover:bg-gray-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        disabled={!ready}
                        onClick={() => onConfirm(reason.trim())}
                        className={`flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-semibold text-sm transition-colors ${ready ? 'hover:bg-red-700' : 'opacity-50 cursor-not-allowed'}`}
                    >
                        Override now
                    </button>
                </div>
            </div>
        </div>
    );
};


// Shown once to the admin right after a reset; only the hash is stored afterwards.
export const TempPasswordDialog = ({ reveal, onClose, onCopy }) => (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black bg-opacity-40 p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 fade-in">
            <div className="flex items-start gap-3 mb-4">
                <div className="shrink-0 w-10 h-10 rounded-full bg-alorica-light flex items-center justify-center text-alorica-blue">
                    <Icon name="key-round" size={20} />
                </div>
                <div>
                    <h3 className="font-bold text-alorica-blue">Temporary password</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        Give this to {reveal.name} ({reveal.username}). It is shown only once and cannot be recovered.
                    </p>
                </div>
            </div>

            <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl px-4 py-4 text-center select-all">
                <p className="text-2xl font-black tracking-wider text-alorica-blue break-all">{reveal.password}</p>
            </div>

            <p className="text-xs text-gray-500 mt-3 text-center">
                Expires {new Date(reveal.expiresAt).toLocaleString()}. The employee must set a new password when signing in.
            </p>

            <div className="flex gap-3 mt-6">
                <button
                    type="button"
                    onClick={onCopy}
                    className="flex-1 px-4 py-2.5 rounded-lg border border-alorica-blue text-alorica-blue font-semibold text-sm hover:bg-alorica-light transition-colors"
                >
                    Copy
                </button>
                <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 px-4 py-2.5 rounded-lg bg-alorica-blue text-white font-semibold text-sm hover:bg-opacity-90 transition-colors"
                >
                    Done
                </button>
            </div>
        </div>
    </div>
);
