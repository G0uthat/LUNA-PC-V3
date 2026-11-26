const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lumaDesktop', {
  isElectron: true,
  getPlatform: () => ipcRenderer.invoke('luma:get-platform'),
  minimize: () => ipcRenderer.invoke('luma:window-minimize'),
  toggleMaximize: () => ipcRenderer.invoke('luma:window-toggle-maximize'),
  close: () => ipcRenderer.invoke('luma:window-close'),
  isMaximized: () => ipcRenderer.invoke('luma:window-is-maximized'),
  onWindowState: (callback) => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('luma:window-state', listener);
    return () => ipcRenderer.removeListener('luma:window-state', listener);
  },
  loadWorkspace: () => ipcRenderer.invoke('luma:load-workspace'),
  saveWorkspace: (jsonString) => ipcRenderer.invoke('luma:save-workspace', jsonString),
  pickFiles: (mode) => ipcRenderer.invoke('luma:pick-files', mode),
  saveExport: (payload) => ipcRenderer.invoke('luma:save-export', payload),
  openExternal: (url) => ipcRenderer.invoke('luma:open-external', url),
});
