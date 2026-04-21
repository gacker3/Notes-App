# dig systems — notes

A floating notes app that lives as a small tab on the right edge of your screen.

LATEST UPDATES: --------------
1. Colour tabs made on desktop when a group is faved!
2. Info is saved when the tab is closed


FEATURES: ---------------------
1. red/yellow/green button are properly embedded
2. no more overlap of the notes when they are grouped
3. no more overlaping text as far as I can see, padding should be all good
4. made the tab a bit bigger and have it just labbeled as 'tab' for now
5. shift + A actually opens the Archive directory instead of just auto archiving elements (it seemed to make more sense)
6. You can still archive items, it's just in the (...) menu in the top right along with ungroup
7. There's now a prompt to label the group instead of defaulting to 'studio' or 'capstone' etc etc
8. the desktop "app" version doesn't still give the prompt if it's not open on a web browser
9. I think that's it, it's all vostly vanity stuff but I figured I'd get the bugs out of the way. The intstall instructions still need some tweaking, but assuming you don't move the zip file from downloads you should be good.
10. Tab is now flush!

Let me know if you spot any other bugs!

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
