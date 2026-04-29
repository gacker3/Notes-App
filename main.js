const fs = require('fs');
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// ── URL scheme ───────────────────────────────────────────────
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient('digsystems', process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient('digsystems');
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) { app.quit(); process.exit(0); }

let tabWindow = null;
let appWindow = null;
let isAppOpen = false;
const groupTabWindows = {};

// ── dimensions ──────────────────────────────────────────────
const TAB_W = 64;
const TAB_H = 140;
const TAB_VISIBLE = 44;
const GTAB_W = 52;
const GTAB_H = 110;
const GTAB_VISIBLE = 36;
const APP_W = 860;
const APP_H = 600;

function getTabPosition(display) {
  const { width } = display.workAreaSize;
  const { x: wx, y: wy } = display.workArea;
  return { x: wx + width - TAB_VISIBLE, y: wy + 80 };
}

function getGroupTabY(display, index) {
  return display.workArea.y + 80 + TAB_H + 8 + index * (GTAB_H + 6);
}

function getAppPosition(display) {
  const { width } = display.workAreaSize;
  const { x: wx, y: wy } = display.workArea;
  return { x: wx + width - APP_W - 8, y: wy + 60 };
}

// ── open / focus app ────────────────────────────────────────
function openApp(navigateToGroup) {
  if (isAppOpen && appWindow) {
    if (appWindow.isMinimized()) appWindow.restore();
    appWindow.focus();
    if (navigateToGroup) appWindow.webContents.send('navigate-group', navigateToGroup);
  } else {
    createAppWindow(navigateToGroup);
    isAppOpen = true;
    if (tabWindow) tabWindow.webContents.send('app-state', true);
  }
}

// ── create main tab ──────────────────────────────────────────
function createTabWindow() {
  const display = screen.getPrimaryDisplay();
  const { x, y } = getTabPosition(display);

  tabWindow = new BrowserWindow({
    width: TAB_W, height: TAB_H, x, y,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, movable: false, skipTaskbar: true,
    hasShadow: false, focusable: true,
    enableLargerThanScreen: true,
    type: 'panel',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  tabWindow.loadFile('tab.html');
  tabWindow.setAlwaysOnTop(true, 'screen-saver');
  tabWindow.on('closed', () => { tabWindow = null; });
}

// ── create group tab ─────────────────────────────────────────
function createGroupTab(groupName, color, index) {
  if (groupTabWindows[groupName]) {
    try { groupTabWindows[groupName].close(); } catch(e) {}
    delete groupTabWindows[groupName];
  }

  const display = screen.getPrimaryDisplay();
  const { width } = display.workAreaSize;
  const wx = display.workArea.x;
  const y = getGroupTabY(display, index);
  const x = wx + width - GTAB_VISIBLE;

  const win = new BrowserWindow({
    width: GTAB_W, height: GTAB_H, x, y,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, movable: false, skipTaskbar: true,
    hasShadow: false, focusable: true,
    enableLargerThanScreen: true,
    type: 'panel',
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const encodedColor = encodeURIComponent(color);
  const encodedName  = encodeURIComponent(groupName);
  win.loadURL(`file://${path.join(__dirname, 'group-tab.html')}?group=${encodedName}&color=${encodedColor}`);
  win.setAlwaysOnTop(true, 'screen-saver');
  win.on('closed', () => { delete groupTabWindows[groupName]; });
  groupTabWindows[groupName] = win;
}

function closeGroupTab(groupName) {
  if (groupTabWindows[groupName]) {
    try { groupTabWindows[groupName].close(); } catch(e) {}
    delete groupTabWindows[groupName];
  }
}

function rebuildGroupTabs(favourites) {
  Object.keys(groupTabWindows).forEach(closeGroupTab);
  if (favourites && favourites.length) {
    favourites.forEach((fav, i) => createGroupTab(fav.name, fav.color, i));
  }
}

// ── create app window ────────────────────────────────────────
function createAppWindow(navigateToGroup) {
  const display = screen.getPrimaryDisplay();
  const { x, y } = getAppPosition(display);

  appWindow = new BrowserWindow({
    width: APP_W, height: APP_H, x, y,
    frame: false, transparent: false, alwaysOnTop: false,
    resizable: true, skipTaskbar: false,
    backgroundColor: '#f0efec',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 14, y: 16 },
    webPreferences: {
      nodeIntegration: false, contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      zoomFactor: 1.0
    }
  });

  appWindow.loadFile(path.join(__dirname, 'app', 'index.html'));

  appWindow.webContents.on('did-finish-load', () => {
    appWindow.webContents.setZoomFactor(1.0);
    appWindow.webContents.setZoomLevel(0);
    if (navigateToGroup) appWindow.webContents.send('navigate-group', navigateToGroup);
  });

  appWindow.on('closed', () => {
    appWindow = null;
    isAppOpen = false;
    if (tabWindow) tabWindow.webContents.send('app-state', false);
  });

  appWindow.on('focus', () => {
    if (tabWindow) tabWindow.setAlwaysOnTop(true, 'screen-saver');
    Object.values(groupTabWindows).forEach(w => w.setAlwaysOnTop(true, 'screen-saver'));
  });
}

// ── IPC ──────────────────────────────────────────────────────
ipcMain.on('toggle-app', () => {
  if (isAppOpen && appWindow) appWindow.close();
  else openApp();
});

ipcMain.on('close-app', () => { if (appWindow) appWindow.close(); });

ipcMain.on('open-group', (event, groupName) => { openApp(groupName); });

ipcMain.on('sync-favourites', (event, favourites) => {
  rebuildGroupTabs(favourites);
  if (appWindow && !appWindow.isDestroyed()) appWindow.focus();
});

// ── Persistence ──────────────────────────────────────────────
function getDataPath() {
  return path.join(app.getPath('userData'), 'notes-data.json');
}

ipcMain.on('save-data', (event, data) => {
  try {
    fs.writeFileSync(getDataPath(), JSON.stringify(data), 'utf8');
    if (data.favourites) rebuildGroupTabs(data.favourites);
  } catch (e) { console.error('Failed to save data:', e); }
  // Refocus app window — prevents needing to re-click after every action
  if (appWindow && !appWindow.isDestroyed()) appWindow.focus();
});

ipcMain.handle('load-data', () => {
  try {
    const filePath = getDataPath();
    if (fs.existsSync(filePath)) return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (e) { console.error('Failed to load data:', e); }
  return null;
});

// ── URL scheme handlers ──────────────────────────────────────
app.on('open-url', (event, url) => { event.preventDefault(); openApp(); });

app.on('second-instance', (event, argv) => {
  const url = argv.find(arg => arg.startsWith('digsystems://'));
  if (url) openApp();
  else if (appWindow) { if (appWindow.isMinimized()) appWindow.restore(); appWindow.focus(); }
});

// ── lifecycle ────────────────────────────────────────────────
app.whenReady().then(() => {
  createTabWindow();

  // Restore group tabs from saved data
  try {
    const dataPath = getDataPath();
    if (fs.existsSync(dataPath)) {
      const saved = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
      if (saved.favourites && saved.favourites.length) rebuildGroupTabs(saved.favourites);
    }
  } catch(e) {}

  const urlArg = process.argv.find(arg => arg.startsWith('digsystems://'));
  if (urlArg) openApp();

  app.on('activate', () => { if (!tabWindow) createTabWindow(); });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
