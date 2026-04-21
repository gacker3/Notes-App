const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  toggleApp:  () => ipcRenderer.send('toggle-app'),
  closeApp:   () => ipcRenderer.send('close-app'),
  onAppState: (cb) => ipcRenderer.on('app-state', (_event, isOpen) => cb(isOpen)),
  saveData:   (data) => ipcRenderer.send('save-data', data),
  loadData:   () => ipcRenderer.invoke('load-data')
});