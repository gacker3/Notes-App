const { app, BrowserWindow, ipcMain, screen, shell } = require('electron');
const path = require('path');

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let tabWindow = null;   // the small persistent tab
let appWindow = null;   // the main notes app
let isAppOpen = false;

// ── dimensions ──────────────────────────────────────────────
const TAB_W = 48;
const TAB_H = 110;
const APP_W = 860;
const APP_H = 600;
const EDGE_MARGIN = 0; // flush to right edge

function getTabPosition(display) {
  const { width, height } = display.workAreaSize;
  const { x: wx, y: wy } = display.workArea;
  // Top-right, tab protrudes from edge — sits so only the visible face shows
  return {
    x: wx + width - TAB_W + 18, // 18px hidden behind screen edge
    y: wy + 60                  // drop from top a little
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

  // keep tab on top even when other windows focus
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
    titleBarStyle: 'hidden',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  appWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  appWindow.on('closed', () => {
    appWindow = null;
    isAppOpen = false;
    if (tabWindow) tabWindow.webContents.send('app-state', false);
  });

  appWindow.on('focus', () => {
    // Bring tab back on top when app is focused
    if (tabWindow) tabWindow.setAlwaysOnTop(true, 'screen-saver');
  });
}

// ── IPC: tab clicks ──────────────────────────────────────────
ipcMain.on('toggle-app', () => {
  if (isAppOpen && appWindow) {
    appWindow.close();
  } else {
    createAppWindow();
    isAppOpen = true;
    if (tabWindow) tabWindow.webContents.send('app-state', true);
  }
});

ipcMain.on('close-app', () => {
  if (appWindow) appWindow.close();
});

// ── app lifecycle ────────────────────────────────────────────
app.whenReady().then(() => {
  createTabWindow();

  app.on('activate', () => {
    if (!tabWindow) createTabWindow();
  });
});

app.on('window-all-closed', () => {
  // On macOS keep running; on Windows quit when all windows close
  // but we always keep the tab, so this shouldn't fire normally
  if (process.platform !== 'darwin') app.quit();
});

// Re-focus app window if second instance is launched
app.on('second-instance', () => {
  if (appWindow) {
    if (appWindow.isMinimized()) appWindow.restore();
    appWindow.focus();
  }
});
