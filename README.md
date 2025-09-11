# openvocs-electron

Minimal Electron kiosk wrapper for OpenVocs on Linux.

## Install

```bash
npm install
```

## Development

Use the start script, which builds the project and launches Electron in development
mode:

```bash
npm start
```

The `start` script sets `NODE_ENV=development`. When launching Electron
manually, ensure the environment variable is set:

```bash
NODE_ENV=development electron .
```

## Configuration

The app loads its URLs from environment variables:

- `PROD_URL` – production primary server (defaults to `https://192.168.1.10/app/vocs/`)
- `PROD_BACKUP_URL` – production backup server (defaults to the value of `PROD_URL`)
- `TEST_URL` – test primary server (defaults to `https://192.168.1.11/app/vocs/`)
- `TEST_BACKUP_URL` – test backup server (defaults to the value of `TEST_URL`)

At runtime you can press the hidden shortcut <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Shift</kbd>+<kbd>T</kbd> to toggle
between the production and test servers. If a load fails, the app automatically
falls back to the backup server for the current environment.

Use <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>D</kbd> to exit kiosk mode and open the
Electron developer tools. This works in all environments and lets you inspect
the app when issues occur in production.

## Build (AppImage + deb)

```bash
npm run package
```
