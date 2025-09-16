import { app, BrowserWindow, session, globalShortcut } from 'electron';
import path from 'node:path';

const allowSelfSignedCertificates =
  process.env.ALLOW_SELF_SIGNED_CERTS === undefined
    ? true
    : process.env.ALLOW_SELF_SIGNED_CERTS !== 'false';
const appUrl = 'https://10.0.0.10/app/vocs/';
const offlineFile = path.join(__dirname, '..', 'resources', 'offline.html');

let mainWindow: BrowserWindow | null = null;
let retryTimer: NodeJS.Timeout | null = null;

function loadApp() {
  if (!mainWindow) {
    console.warn('Skipping app load because the window is gone.');
    return;
  }
  mainWindow.loadURL(appUrl);
}

function loadOffline() {
  if (!mainWindow) {
    console.warn('Skipping offline page load because the window is gone.');
    return;
  }
  mainWindow.loadFile(offlineFile);
}

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

  loadApp();

  mainWindow.webContents.on(
    'did-fail-load',
    (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
      if (errorCode === -3 || !isMainFrame) {
        console.debug(
          `did-fail-load ignored (code: ${errorCode}, url: ${validatedURL}, mainFrame: ${isMainFrame})`
        );
        return;
      }

      console.error(`did-fail-load (code: ${errorCode}, url: ${validatedURL})`);
      loadOffline();

      if (!retryTimer) {
        retryTimer = setInterval(() => {
          if (mainWindow) {
            loadApp();
          }
        }, 30000);
      }
    }
  );

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow?.webContents.getURL();
    if (!url) {
      return;
    }
    if (!url.startsWith('file://') && retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  });

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

  mainWindow.on('closed', () => {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
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

if (allowSelfSignedCertificates) {
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    if (url.startsWith(appUrl)) {
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
