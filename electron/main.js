const { app, BrowserWindow, ipcMain } = require('electron');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { emulatorRegistry } = require('./emulators');
const { getGameStatus, launchGame } = require('./launcher');
const { resolveStaticPath } = require('./static-path');

const rootDir = path.join(__dirname, '..');

const mimeTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.ico': 'image/x-icon',
    '.jpg': 'image/jpeg',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.md': 'text/markdown',
    '.mp4': 'video/mp4',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ttf': 'font/ttf',
    '.txt': 'text/plain',
    '.woff': 'font/woff',
    '.xml': 'application/xml',
    '.zip': 'application/zip'
};

function startStaticServer() {
    const server = http.createServer((req, res) => {
        const target = resolveStaticPath(rootDir, req.url);

        if (!target || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not found');
            return;
        }

        const type = mimeTypes[path.extname(target).toLowerCase()] || 'application/octet-stream';
        res.writeHead(200, { 'Content-Type': type });
        fs.createReadStream(target).pipe(res);
    });

    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            resolve({ server, url: `http://127.0.0.1:${address.port}` });
        });
    });
}

function createWindow(appUrl) {
    const win = new BrowserWindow({
        width: 1280,
        height: 820,
        minWidth: 960,
        minHeight: 640,
        backgroundColor: '#08090d',
        title: 'Arcade World',
        webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            preload: path.join(__dirname, 'preload.js')
        }
    });

    win.loadURL(appUrl);
}

let staticServer;
let staticUrl;

ipcMain.handle('desktop:game-status', (_event, game) => (
    getGameStatus({ rootDir, registry: emulatorRegistry, game })
));

ipcMain.handle('desktop:launch-game', async (_event, game) => {
    try {
        return await launchGame({ rootDir, registry: emulatorRegistry, game });
    } catch (error) {
        return {
            ok: false,
            status: 'launch-failed',
            message: `The emulator could not be started: ${error.message}`
        };
    }
});

app.whenReady().then(async () => {
    const serverInfo = await startStaticServer();
    staticServer = serverInfo.server;
    staticUrl = serverInfo.url;

    createWindow(staticUrl);

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow(staticUrl);
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        if (staticServer) {
            staticServer.close();
        }

        app.quit();
    }
});
