const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const FLASK_URL = 'http://localhost:5000';
let flaskProc = null;
let win = null;

function startFlask() {
  const py = process.platform === 'win32' ? 'python' : 'python3';
  flaskProc = spawn(py, [path.join(__dirname, 'app.py')], {
    cwd: __dirname,
    windowsHide: true,
  });
  flaskProc.stderr.on('data', chunk => process.stderr.write(chunk));
  flaskProc.on('error', err => console.error('[pallas] flask spawn error:', err.message));
}

function waitForFlask() {
  return new Promise(resolve => {
    function attempt() {
      http.get(FLASK_URL, res => { res.resume(); resolve(); })
          .on('error', () => setTimeout(attempt, 500));
    }
    attempt();
  });
}

function createWindow() {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    frame: false,
    transparent: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadURL(FLASK_URL);

  win.on('closed', () => {
    if (flaskProc) { flaskProc.kill(); flaskProc = null; }
    win = null;
  });
}

app.whenReady().then(async () => {
  startFlask();
  await waitForFlask();
  createWindow();
});

app.on('window-all-closed', () => {
  if (flaskProc) { flaskProc.kill(); flaskProc = null; }
  app.quit();
});

ipcMain.on('win:minimize',        () => win?.minimize());
ipcMain.on('win:toggle-maximize', () => win?.isMaximized() ? win.unmaximize() : win.maximize());
ipcMain.on('win:close',           () => win?.close());
