import { app, BrowserWindow, globalShortcut, screen, session } from 'electron';

type MicrophonePermissionDetails =
  | Electron.MediaAccessPermissionRequest
  | Electron.PermissionCheckHandlerHandlerDetails
  | undefined;

const isMicrophoneRequest = (details: MicrophonePermissionDetails): boolean => {
  if (!details) {
    return true;
  }

  if ('mediaTypes' in details && Array.isArray(details.mediaTypes)) {
    return details.mediaTypes.some((type) => type === 'audio');
  }

  if ('mediaType' in details && typeof details.mediaType === 'string') {
    return details.mediaType === 'audio';
  }

  return true;
};

const registerDevToolsShortcut = (): void => {
  const accelerator = 'CommandOrControl+Shift+I';
  const registered = globalShortcut.register(accelerator, () => {
    const targetWindow = BrowserWindow.getFocusedWindow() ?? mainWindow;
    const webContents = targetWindow?.webContents;

    if (!webContents) {
      return;
    }

    if (webContents.isDevToolsOpened()) {
      webContents.closeDevTools();
    } else {
      webContents.openDevTools({ mode: 'detach' });
    }
  });

  if (!registered) {
    console.warn(`Failed to register shortcut: ${accelerator}`);
  }
};

const configureMicrophonePermissions = (): void => {
  const defaultSession = session.defaultSession;

  if (!defaultSession) {
    console.warn('No default session available to configure microphone permissions.');
    return;
  }

  defaultSession.setPermissionRequestHandler((_, permission, callback, details) => {
    if (permission === 'media' && isMicrophoneRequest(details)) {
      callback(true);
      return;
    }

    callback(false);
  });

  defaultSession.setPermissionCheckHandler((_, permission, _origin, details) => {
    if (permission === 'media') {
      return isMicrophoneRequest(details);
    }

    return false;
  });
};

const APP_URL = process.env.APP_URL ?? 'https://10.0.0.10/app/vocs/';

app.commandLine.appendSwitch('ignore-certificate-errors');

let mainWindow: BrowserWindow | null = null;

const createWindow = async (): Promise<void> => {
  mainWindow = new BrowserWindow({
    fullscreen: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  const { webContents } = mainWindow;
  let overlayCssInjected = false;

  const updateResolutionOverlay = async (): Promise<void> => {
    if (!mainWindow || mainWindow.isDestroyed() || webContents.isDestroyed()) {
      return;
    }

    const { width, height } = screen.getPrimaryDisplay().size;
    const overlayText = `${width}×${height}`;

    try {
      if (!overlayCssInjected) {
        await webContents.insertCSS(`
          #resolution-overlay {
            position: fixed;
            top: 16px;
            right: 16px;
            padding: 6px 12px;
            background-color: rgba(0, 0, 0, 0.75);
            color: #ffffff;
            font-family: sans-serif;
            font-size: 14px;
            border-radius: 4px;
            z-index: 2147483647;
            pointer-events: none;
          }
        `);
        overlayCssInjected = true;
      }

      await webContents.executeJavaScript(
        `
          (() => {
            const text = ${JSON.stringify(overlayText)};
            let overlay = document.getElementById('resolution-overlay');

            if (!overlay) {
              overlay = document.createElement('div');
              overlay.id = 'resolution-overlay';
              document.body.appendChild(overlay);
            }

            overlay.textContent = text;
          })();
        `,
        true,
      );
    } catch (error) {
      console.error('Failed to update resolution overlay', error);
    }
  };

  const handleDidFinishLoad = (): void => {
    void updateResolutionOverlay();
  };

  webContents.on('did-finish-load', handleDidFinishLoad);

  const handleDisplayMetricsChanged = (): void => {
    void updateResolutionOverlay();
  };

  screen.on('display-metrics-changed', handleDisplayMetricsChanged);

  mainWindow.on('closed', () => {
    screen.removeListener('display-metrics-changed', handleDisplayMetricsChanged);

    if (!webContents.isDestroyed()) {
      webContents.removeListener('did-finish-load', handleDidFinishLoad);
    }

    mainWindow = null;
  });

  try {
    await mainWindow.loadURL(APP_URL);
  } catch (error) {
    console.error('Failed to load application URL', error);
  }
};

app.whenReady().then(() => {
  configureMicrophonePermissions();
  void createWindow();
  registerDevToolsShortcut();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on('certificate-error', (event, _webContents, _url, _error, _certificate, callback) => {
  event.preventDefault();
  callback(true);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});
