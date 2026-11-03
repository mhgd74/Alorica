/*
 * Small pieces every screen builds on: icons, toasts and the error boundary.
 */

const { useState, useEffect, useMemo } = React;





// Icon names are kebab-case ("calendar-check") while the bundled icon map uses PascalCase.
const iconPascalName = (name) => String(name)
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');


// Icons are rendered as real React elements. Using lucide.createIcons() would swap the
// <i> nodes for <svg> behind React's back, so React would later fail to remove them.
export const Icon = ({ name, size = 24, className = "" }) => {
    const icon = lucide.icons[iconPascalName(name)];
    if (!icon) return null;

    const [, baseAttrs, children] = icon;
    return (
        <svg {...baseAttrs} width={size} height={size} className={className} aria-hidden="true" focusable="false">
            {children.map(([tag, attrs], index) => React.createElement(tag, { key: index, ...attrs }))}
        </svg>
    );
};


export const Toasts = ({ toasts }) => {
    const styles = {
        success: 'bg-green-50 text-green-800 border-green-200',
        error: 'bg-red-50 text-red-700 border-red-200',
        info: 'bg-alorica-light text-alorica-blue border-blue-200'
    };
    const icons = { success: 'check-circle', error: 'alert-circle', info: 'info' };
    return (
        <div className="fixed top-4 right-4 z-[100] space-y-2 w-[min(92vw,22rem)]">
            {toasts.map((t) => (
                <div key={t.id} className={`toast-in flex items-start gap-2 border rounded-xl shadow-lg px-4 py-3 text-sm font-medium ${styles[t.type] || styles.info}`}>
                    <Icon name={icons[t.type] || 'info'} size={18} className="mt-0.5 shrink-0" />
                    <span>{t.text}</span>
                </div>
            ))}
        </div>
    );
};




// Keeps a single failing component from blanking the whole page.
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Unexpected application error:', error);
        console.error('Error info:', errorInfo);
    }

    render() {
        if (!this.state.error) return this.props.children;

        return (
            <div className="min-h-screen flex items-center justify-center bg-alorica-light p-4">
                <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md text-center border border-gray-100">
                    <img src="logo.png" alt="Alorica" className="h-10 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-alorica-blue mb-2">Something went wrong</h1>
                    <p className="text-gray-500 text-sm mb-4">
                        The page hit an unexpected error. Your saved bookings are not affected.
                    </p>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-left">
                        <p className="text-xs text-red-700 font-mono break-all">
                            {this.state.error?.toString() || 'Unknown error'}
                        </p>
                    </div>
                    <p className="text-gray-400 text-xs mb-6">
                        Please reload the page or contact support if this persists.
                    </p>
                    <button
                        type="button"
                        onClick={() => window.location.reload()}
                        className="w-full bg-alorica-blue hover:bg-opacity-90 text-white font-bold py-3 px-4 rounded-lg shadow-lg transition-all"
                    >
                        Reload
                    </button>
                </div>
            </div>
        );
    }
}
