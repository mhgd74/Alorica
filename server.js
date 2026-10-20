const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

const MIME = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
};

const server = http.createServer((req, res) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
    let urlPath = decodeURIComponent(req.url.split('?')[0]);
    if (urlPath === '/') {
        res.writeHead(302, { Location: '/index.html', 'Cache-Control': 'no-store' });
        res.end();
        return;
    }

    // The preview tool injects Vite client requests. Serve a no-op module
    // so they don't 404 and abort.
    if (urlPath.startsWith('/@vite/') || urlPath.startsWith('/@react-refresh') || urlPath.startsWith('/@id/')) {
        res.writeHead(200, {
            'Content-Type': 'text/javascript; charset=utf-8',
            'Cache-Control': 'no-store',
        });
        res.end('export function createHotContext() { return { accept() {}, dispose() {}, prune() {}, invalidate() {}, on() {}, off() {}, send() {} }; }\nexport function injectQuery(url) { return url; }\nexport function updateStyle() {}\nexport function removeStyle() {}\n');
        return;
    }

    const filePath = path.join(__dirname, urlPath);
    const ext = path.extname(filePath).toLowerCase();

    if (ext === '.ico') {
        res.writeHead(204);
        res.end();
        return;
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }
        res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
            'Content-Length': Buffer.byteLength(data),
            'Cache-Control': 'no-store',
        });
        res.end(data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
