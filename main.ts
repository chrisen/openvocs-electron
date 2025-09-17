import { app, BrowserWindow, session } from 'electron';

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
    kiosk: true,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.setMenuBarVisibility(false);

  const { webContents } = mainWindow;

  webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') {
      return;
    }

    const hasDisallowedModifier = input.alt || input.control || input.meta;
    const isFunctionKey = /^F\d+$/.test(input.code);

    if (hasDisallowedModifier || isFunctionKey) {
      event.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
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

