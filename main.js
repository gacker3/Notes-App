const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');

// ── Register custom URL scheme (digsystems://) ───────────────
// Must be called before app is ready
if (process.defaultApp) {
  // Running via `electron .` in dev — register with the electron binary
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('digsystems', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  // Running as packaged app
  app.setAsDefaultProtocolClient('digsystems');
}

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let tabWindow = null;   // the small persistent tab
let appWindow = null;   // the main notes app
let isAppOpen = false;

// ── dimensions ──────────────────────────────────────────────
const TAB_W = 64;   // wider window — more of the face is visible
const TAB_H = 140;  // taller
const APP_W = 860;
const APP_H = 600;

function getTabPosition(display) {
  const { width } = display.workAreaSize;
  const { x: wx, y: wy } = display.workArea;
  return {
    x: wx + width - TAB_W + 20, // 20px tucked behind edge, rest protrudes
    y: wy + 80
  };
}

function getAppPosition(display) {
  const { width } = display.workAreaSize;
  const { x: wx, y: wy } = display.workArea;
  return {
    x: wx + width - APP_W - 8,
    y: wy + 60
  };
}

// ── open or focus the app window ────────────────────────────
function openApp() {
  if (isAppOpen && appWindow) {
    if (appWindow.isMinimized()) appWindow.restore();
    appWindow.focus();
  } else {
    createAppWindow();
    isAppOpen = true;
    if (tabWindow) tabWindow.webContents.send('app-state', true);
  }
}

// ── create tab window ────────────────────────────────────────
function createTabWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y } = getTabPosition(display);

  tabWindow = new BrowserWindow({
    width: TAB_W,
    height: TAB_H,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  tabWindow.loadFile('tab.html');
  tabWindow.setAlwaysOnTop(true, 'screen-saver');
  tabWindow.on('closed', () => { tabWindow = null; });
}

// ── create app window ────────────────────────────────────────
function createAppWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y } = getAppPosition(display);

  appWindow = new BrowserWindow({
    width: APP_W,
    height: APP_H,
    x,
    y,
    frame: false,
    transparent: false,
    alwaysOnTop: false,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#f0efec',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 1.0
    }
  });

  appWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Lock zoom to 1.0 — prevents macOS Retina scaling the UI up
  appWindow.webContents.on('did-finish-load', () => {
    appWindow.webContents.setZoomFactor(1.0);
    appWindow.webContents.setZoomLevel(0);
  });

  appWindow.on('closed', () => {
    appWindow = null;
    isAppOpen = false;
    if (tabWindow) tabWindow.webContents.send('app-state', false);
  });

  appWindow.on('focus', () => {
    if (tabWindow) tabWindow.setAlwaysOnTop(true, 'screen-saver');
  });
}

// ── IPC: tab clicks ──────────────────────────────────────────
ipcMain.on('toggle-app', () => {
  if (isAppOpen && appWindow) {
    appWindow.close();
  } else {
    openApp();
  }
});

ipcMain.on('close-app', () => {
  if (appWindow) appWindow.close();
});

// ── URL scheme handler (macOS) ───────────────────────────────
// Fired when app is already running and receives a digsystems:// URL
app.on('open-url', (event, url) => {
  event.preventDefault();
  openApp();
});

// ── URL scheme handler (Windows) ────────────────────────────
// On Windows, a second instance is launched with the URL as an argv
app.on('second-instance', (event, argv) => {
  const url = argv.find(arg => arg.startsWith('digsystems://'));
  if (url) {
    openApp();
  } else if (appWindow) {
    if (appWindow.isMinimized()) appWindow.restore();
    appWindow.focus();
  }
});

// ── app lifecycle ────────────────────────────────────────────
app.whenReady().then(() => {
  createTabWindow();

  // Handle URL if app was cold-launched via digsystems:// link
  const urlArg = process.argv.find(arg => arg.startsWith('digsystems://'));
  if (urlArg) openApp();

  app.on('activate', () => {
    if (!tabWindow) createTabWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

