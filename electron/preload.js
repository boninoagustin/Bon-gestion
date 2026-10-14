const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  askOpenAI: (contents, settings, tools) => ipcRenderer.invoke('ask-openai', contents, settings, tools),
  loginOpenAI: () => ipcRenderer.invoke('login-openai'),
  checkOpenAIStatus: () => ipcRenderer.invoke('check-openai-status'),
  logoutOpenAI: () => ipcRenderer.invoke('logout-openai'),
  sendNotification: (title, body) => ipcRenderer.invoke('send-notification', { title, body }),
  saveAutoBackup: (data) => ipcRenderer.invoke('save-auto-backup', data),
  openBackupFolder: () => ipcRenderer.invoke('open-backup-folder'),
  getOpenAIModels: () => ipcRenderer.invoke('get-openai-models')
});

