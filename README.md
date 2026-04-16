# dig systems — notes

A floating notes app that lives as a small tab on the right edge of your screen.

## Structure

```
dig-systems/
├── main.js          ← Electron main process (windows, IPC)
├── preload.js       ← Secure IPC bridge
├── tab.html         ← The persistent tab UI
├── tab.css          ← Tab styles
├── package.json
└── app/
    ├── index.html   ← The notes app
    └── style.css
```

## Setup

You need [Node.js](https://nodejs.org) installed (v18+ recommended).

```bash
# 1. Install dependencies
npm install

# 2. Run in development
npm start
```

The tab will appear in the top-right corner of your screen, partially tucked behind the edge. Click it to open the notes app. Click it again (or the ✕ in the app) to close.

## Packaging

```bash
# macOS (.dmg — both Apple Silicon and Intel)
npm run package:mac

# Windows (.exe installer)
npm run package:win

# Both at once
npm run package:all
```

Output goes to `dist/`. On macOS, drag the `.app` to Applications.

> **Note:** To build for Windows from macOS you need Wine or a Windows CI runner.
> For macOS builds to be code-signed, you need an Apple Developer certificate.
> Unsigned builds will show a Gatekeeper warning — right-click → Open to bypass.

## Icons

Place your icon files in `assets/`:
- `assets/icon.icns` — macOS
- `assets/icon.ico`  — Windows
- `assets/icon.png`  — 512×512 fallback

If these are missing, Electron uses its default icon.

## Keyboard shortcuts (inside the app)

| Key | Action |
|-----|--------|
| `Enter` | New note |
| `Tab` | Switch Float ↔ Finder view |
| `Shift+A` | Archive oldest old note |
| `⌘↵` | Save note in editor |
| `Esc` | Close editor |
