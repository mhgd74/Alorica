/*
 * The bell in the header and the panel it opens.
 */

import { Icon } from './common.js';

const { useState, useEffect, useMemo } = React;



// Bell + panel used by every role. Approval items carry their own action buttons.
export const NotificationBell = ({ items, open, onOpen, onClose, onDecide, pendingRequest }) => (
    <div className="relative">
        <button
            type="button"
            onClick={open ? onClose : onOpen}
            className="relative p-2 hover:bg-blue-50 rounded-full text-alorica-blue transition-colors"
            title="Notifications"
        >
            <Icon name="bell" size={22} />
            {items.filter((n) => !n.read).length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[1.15rem] h-[1.15rem] px-1 flex items-center justify-center">
                    {items.filter((n) => !n.read).length}
                </span>
            )}
        </button>

        {open && (
            <>
                <div className="fixed inset-0 z-[95]" onClick={onClose} />
                <div className="absolute right-0 mt-2 w-[20rem] sm:w-[22rem] max-h-[26rem] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 z-[100] fade-in">
                    <div className="px-4 py-3 border-b border-gray-100 sticky top-0 bg-white">
                        <h4 className="font-bold text-alorica-blue text-sm">Notifications</h4>
                    </div>

                    {items.length === 0 ? (
                        <p className="text-center text-gray-400 text-sm py-10">Nothing here yet.</p>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {[...items].reverse().map((n) => {
                                const request = n.requestId ? pendingRequest(n.requestId) : null;
                                return (
                                    <div key={n.id} className={`px-4 py-3 ${request ? 'bg-orange-50' : ''}`}>
                                        <div className="flex items-start gap-2">
                                            <span className={`mt-0.5 shrink-0 ${n.kind === 'approval' ? 'text-alorica-orange' : n.kind === 'decision' ? 'text-green-600' : 'text-alorica-blue'}`}>
                                                <Icon name={n.kind === 'approval' ? 'clock' : n.kind === 'decision' ? 'check-circle' : 'info'} size={16} />
                                            </span>
                                            <div className="min-w-0">
                                                <p className="text-sm font-bold text-alorica-blue">{n.title}</p>
                                                <p className="text-xs text-gray-600 leading-relaxed">{n.body}</p>
                                                <p className="text-[10px] text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>

                                                {request && (
                                                    <div className="flex gap-2 mt-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => onDecide(request.id, true)}
                                                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-alorica-blue text-white hover:bg-opacity-90 transition-colors"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => onDecide(request.id, false)}
                                                            className="text-xs font-bold px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
                                                        >
                                                            Decline
                                                        </button>
                                                    </div>
                                                )}

                                                {n.kind === 'approval' && !request && (
                                                    <p className="text-[10px] font-semibold text-gray-400 mt-1">Already handled</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </>
        )}
    </div>
);
