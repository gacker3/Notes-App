const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleApp:      () => ipcRenderer.send('toggle-app'),
  closeApp:       () => ipcRenderer.send('close-app'),
  onAppState:     (cb) => ipcRenderer.on('app-state', (_event, isOpen) => cb(isOpen)),
  saveData:       (data) => ipcRenderer.send('save-data', data),
  loadData:       () => ipcRenderer.invoke('load-data'),
  openGroup:      (group) => ipcRenderer.send('open-group', group),
  onOpenGroup:    (cb) => ipcRenderer.on('navigate-group', (_event, group) => cb(group)),
  syncFavourites: (favs) => ipcRenderer.send('sync-favourites', favs),
});
