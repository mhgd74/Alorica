/*
 * Entry point: mounts the application once the DOM is ready.
 *
 * This file is compiled to src/main.js by scripts/build.js. The page loads the
 * compiled file as a module, so nothing here runs before React and ReactDOM have
 * been read from the vendor scripts in index.html — module scripts are deferred
 * until after the document has been parsed.
 */
import { App } from './App.js';
import { ErrorBoundary } from './components/common.js';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <ErrorBoundary>
        <App />
    </ErrorBoundary>
);
