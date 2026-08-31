const { contextBridge, ipcRenderer } = require('electron');

// Expose a hardened, minimal API to the renderer process
contextBridge.exposeInMainWorld('sovereignTerminalAPI', {
  send: (channel, data) => {
    const APPROVED_CHANNELS = ['ledger:sync', 'withdrawal:initiate', 'audit:status'];
    if (APPROVED_CHANNELS.includes(channel)) {
      ipcRenderer.send('secure-ipc-message', channel, data);
    } else {
      console.warn(`Rejected unauthorized IPC send attempt on channel: ${channel}`);
    }
  },
  onResponse: (callback) => {
    ipcRenderer.removeAllListeners('secure-ipc-response');
    ipcRenderer.on('secure-ipc-response', (event, response) => {
      callback(response);
    });
  }
});