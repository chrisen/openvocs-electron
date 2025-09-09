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

## Build (AppImage + deb)

```bash
npm run package
```
