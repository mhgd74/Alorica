/*
 * Signing in and changing a password.
 */

import { Icon, Toasts } from './common.js';

const { useState, useEffect, useMemo } = React;





export const Login = ({ toasts, loginData, setLoginData, error, notice, onSubmit, onForgotPassword, rememberMe, setRememberMe }) => (
    <>
        <Toasts toasts={toasts} />
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 fade-in">
                <div className="flex flex-col items-center mb-8">
                    <img src="logo.png" alt="Alorica" className="h-12 mb-4" />
                    <h1 className="text-2xl font-bold text-alorica-blue">Login</h1>
                    <p className="text-gray-500 text-sm mt-2 text-center">Alorica Booking System</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                        <div className="relative">
                            <input
                                type="text"
                                required
                                autoComplete="username"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none transition-all text-gray-800 pl-10"
                                placeholder="Enter your username"
                                value={loginData.username}
                                onChange={(e) => setLoginData({ ...loginData, username: e.target.value })}
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Icon name="user" size={18} />
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                        <div className="relative">
                            <input
                                type="password"
                                required
                                autoComplete="current-password"
                                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none transition-all text-gray-800 pl-10"
                                placeholder="Enter your password"
                                value={loginData.password}
                                onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                <Icon name="lock" size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center">
                        <input
                            type="checkbox"
                            id="rememberMe"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 text-alorica-blue border-gray-300 rounded focus:ring-alorica-blue"
                        />
                        <label htmlFor="rememberMe" className="ml-2 text-sm text-gray-600">
                            Remember me for 30 days
                        </label>
                    </div>

                    {error && (
                        <p className="text-red-500 text-sm text-center font-medium bg-red-50 py-2 rounded-lg">{error}</p>
                    )}

                    {notice && (
                        <p className="text-alorica-blue text-sm text-center font-medium bg-alorica-light py-2 px-3 rounded-lg">{notice}</p>
                    )}

                    <button
                        type="submit"
                        className="w-full bg-alorica-blue hover:bg-opacity-90 text-white font-bold py-3 px-4 rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all"
                    >
                        Login
                        <Icon name="chevron-right" size={20} />
                    </button>
                </form>

                <button
                    type="button"
                    onClick={onForgotPassword}
                    className="w-full mt-4 text-sm text-gray-500 hover:text-alorica-blue font-medium transition-colors"
                >
                    Forgot password?
                </button>

                <p className="text-xs text-gray-400 text-center mt-3">
                    A reset request goes to the administrator, who issues a temporary password.
                </p>
            </div>
        </div>
    </>
);


// Replaces the app for accounts that still carry their temporary password.
export const PasswordChange = ({ user, form, setForm, feedback, onSubmit, onSignOut, toasts }) => {
    const fields = [
        { key: 'next', label: 'New password', autoComplete: 'new-password' },
        { key: 'confirm', label: 'Confirm new password', autoComplete: 'new-password' }
    ];
    return (
        <>
        <Toasts toasts={toasts} />
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-gray-100 fade-in">
                    <div className="flex flex-col items-center mb-6">
                        <img src="logo.png" alt="Alorica" className="h-12 mb-4" />
                        <h1 className="text-2xl font-bold text-alorica-blue">Set a new password</h1>
                        <p className="text-gray-500 text-sm mt-2 text-center">
                            {user.name}, you signed in with a temporary password. Choose a new one to continue.
                        </p>
                    </div>

                    <form onSubmit={onSubmit} className="space-y-4">
                        {fields.map((field) => (
                            <div key={field.key}>
                                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                                <div className="relative">
                                    <input
                                        type="password"
                                        required
                                        autoComplete={field.autoComplete}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none transition-all text-gray-800 pl-10"
                                        value={form[field.key]}
                                        onChange={(e) => setForm({ ...form, [field.key]: e.target.value })}
                                    />
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                                        <Icon name="lock" size={18} />
                                    </div>
                                </div>
                            </div>
                        ))}

                        {feedback.text && (
                            <p className={`text-sm text-center font-medium py-2 rounded-lg ${feedback.type === 'error' ? 'text-red-500 bg-red-50' : 'text-green-600 bg-green-50'}`}>
                                {feedback.text}
                            </p>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-alorica-blue hover:bg-opacity-90 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all"
                        >
                            Save password
                        </button>
                    </form>

                    <p className="text-xs text-gray-400 text-center mt-4">
                        At least 6 characters. The temporary password is no longer valid after this step.
                    </p>

                    <button
                        type="button"
                        onClick={onSignOut}
                        className="w-full mt-3 text-sm text-gray-500 hover:text-alorica-blue font-medium transition-colors"
                    >
                        Sign out
                    </button>
                </div>
            </div>
        </>
    );
};
