import { app, BrowserWindow, session, globalShortcut } from 'electron';
import path from 'node:path';
import os from 'node:os';

const isDev = process.env.NODE_ENV === 'development';
const prodPrimaryUrl = process.env.PROD_URL || 'https://192.168.1.10/app/vocs/';
const prodBackupUrl = process.env.PROD_BACKUP_URL || prodPrimaryUrl;
const testPrimaryUrl = process.env.TEST_URL || 'https://192.168.1.11/app/vocs/';
const testBackupUrl = process.env.TEST_BACKUP_URL || testPrimaryUrl;

type Environment = 'prod' | 'test';
let env: Environment = 'prod';
let useBackup = false;
const offlineFile = path.join(__dirname, '..', 'resources', 'offline.html');
let failCount = 0;
const failThreshold = 3;
let retryTimer: NodeJS.Timeout | null = null;

const hostnameParam = `keysetname=${encodeURIComponent(os.hostname())}`;
const currentUrl = () => {
  const base =
    env === 'prod'
      ? (useBackup ? prodBackupUrl : prodPrimaryUrl)
      : (useBackup ? testBackupUrl : testPrimaryUrl);
  const separator = base.includes('?') ? '&' : '?';
  return `${base}${separator}${hostnameParam}`;
};
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
  const loadOffline = () => mainWindow!.loadFile(offlineFile);
  load(currentUrl());

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, _errorDescription, validatedURL, isMainFrame) => {
    if (errorCode === -3 || !isMainFrame) {
      console.debug(`did-fail-load ignored (code: ${errorCode}, url: ${validatedURL}, mainFrame: ${isMainFrame})`);
      return;
    }

    console.error(`did-fail-load (code: ${errorCode}, url: ${validatedURL})`);
    failCount++;

    if (failCount >= failThreshold) {
      useBackup = false;
      loadOffline();
      if (!retryTimer) {
        retryTimer = setInterval(() => {
          if (mainWindow) {
            load(currentUrl());
          }
        }, 30000);
      }
      return;
    }

    if (!useBackup) {
      useBackup = true;
      load(currentUrl());
    } else {
      useBackup = false;
      setTimeout(() => load(currentUrl()), 5000);
    }
  });

  mainWindow.webContents.on('did-finish-load', () => {
    const url = mainWindow!.webContents.getURL();
    if (!url.startsWith('file://')) {
      failCount = 0;
      if (retryTimer) {
        clearInterval(retryTimer);
        retryTimer = null;
      }
    }
  });

  const toggleAccelerator = 'Control+Alt+Shift+T';
  const toggleRegistered = globalShortcut.register(toggleAccelerator, () => {
    if (mainWindow) {
      env = env === 'prod' ? 'test' : 'prod';
      useBackup = false;
      load(currentUrl());
    }
  });

  if (!toggleRegistered) {
    console.error(`Failed to register global shortcut ${toggleAccelerator}; it may already be in use.`);
  }
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
    if (
      url.startsWith(prodPrimaryUrl) ||
      url.startsWith(prodBackupUrl) ||
      url.startsWith(testPrimaryUrl) ||
      url.startsWith(testBackupUrl)
    ) {
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
