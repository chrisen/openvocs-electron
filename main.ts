import { app, BrowserWindow, session, globalShortcut } from 'electron';
import path from 'node:path';

const isDev = process.env.NODE_ENV === 'development';
const primaryUrl = 'https://192.168.1.10/app/vocs/';
const fallbackUrl = 'https://192.168.1.11/app/vocs/';
let currentUrl = primaryUrl;
let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    kiosk: true,
    fullscreen: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    }
  });

  const load = (url: string) => mainWindow!.loadURL(url);
  load(primaryUrl);

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
    if (errorCode === -3 || !isMainFrame) {
      console.debug(`did-fail-load ignored (code: ${errorCode}, url: ${validatedURL}, mainFrame: ${isMainFrame})`);
      return;
    }

    console.error(`did-fail-load (code: ${errorCode}, url: ${validatedURL})`);

    if (currentUrl === primaryUrl) {
      currentUrl = fallbackUrl;
      load(currentUrl);
    } else {
      currentUrl = primaryUrl;
      setTimeout(() => load(currentUrl), 5000);
    }
  });

  if (isDev) {
    const accelerator = 'Control+Alt+D';
    const registered = globalShortcut.register(accelerator, () => {
      if (mainWindow) {
        mainWindow.setKiosk(false);
        mainWindow.webContents.openDevTools({ mode: 'detach' });
      }
    });

    if (!registered) {
      console.error(`Failed to register global shortcut ${accelerator}; it may already be in use.`);
    } else {
      console.log(`Registered global shortcut ${accelerator}`);
    }
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback) => {
    if (permission === 'media') {
      callback(true);
    } else {
      callback(false);
    }
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

if (isDev) {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.startsWith(primaryUrl) || url.startsWith(fallbackUrl)) {
      event.preventDefault();
      callback(true);
    } else {
      callback(false);
    }
  });
}

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
