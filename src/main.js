const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    title: "Marshall Sovereign Terminal",
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,  // Enforces context isolation
      nodeIntegration: false,  // Disables Node.js integration in renderer
      sandbox: true,           // Enforces sandbox
      webSecurity: true,       // Enforces same-origin policy & web security
    }
  });

  // Load the application
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:3000';
  win.loadURL(startUrl);

  // Hardening: Block navigation to untrusted origins
  win.webContents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsedUrl = new URL(navigationUrl);
      const allowedOrigins = [
        new URL(startUrl).origin,
        'https://www.sovereigns.ca',
        'https://sovereigns.ca'
      ];
      if (!allowedOrigins.includes(parsedUrl.origin)) {
        event.preventDefault();
        console.warn(`Blocked unauthorized navigation to: ${navigationUrl}`);
      }
    } catch (e) {
      event.preventDefault();
    }
  });

  // Hardening: Block new window creation
  win.webContents.setWindowOpenHandler(({ url }) => {
    console.warn(`Blocked window creation for URL: ${url}`);
    return { action: 'deny' };
  });
}

// Hardening: Enforce sandbox globally
app.enableSandbox();

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Secure Whitelisted IPC Channels
const APPROVED_CHANNELS = ['ledger:sync', 'withdrawal:initiate', 'audit:status'];

ipcMain.on('secure-ipc-message', (event, channel, data) => {
  if (!APPROVED_CHANNELS.includes(channel)) {
    console.error(`Rejected unauthorized IPC channel access: ${channel}`);
    event.reply('secure-ipc-response', { success: false, error: 'Unauthorized IPC channel' });
    return;
  }

  console.log(`Processing secure IPC message for channel: ${channel}`);
  event.reply('secure-ipc-response', { success: true, channel, data: `Processed ${channel} successfully` });
});