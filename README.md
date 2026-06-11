# Desktop Mouse Pet

A lightweight Windows-first desktop pet MVP built with Electron, TypeScript, and PixiJS.

## Features

- Transparent, frameless, always-on-top pet window.
- Global mouse tracking from Electron main process.
- PixiJS sprite animation with one looping `main` action per pet skin.
- Smooth chase movement using velocity, acceleration, and friction.
- Left-click cycles through the available pet sprite sheets.
- Right-click locks/unlocks mouse following while the tray menu remains available.
- Compact in-window control panel with size slider, usage hints, and a close button.
- Drag-and-drop positioning with delayed follow resume.
- Tray menu for follow toggle, follow mode, click-through, always-on-top, and quit.
- Local JSON config saved in Electron `userData`.
- Sprite assets under `assets/pets/default` and `assets/pets/pray`.

## Commands

```bash
npm install
npm run generate:assets
npm run dev
```

For production-style local output:

```bash
npm run build
npm run start
```

## Notes

- First target is Windows. Other desktop platforms are not part of the MVP acceptance pass.
- `clickThrough` makes the pet window ignore mouse input; use the tray menu to turn it off again.
- `assets/pets/default` is a 5x5, 25-frame transparent PNG sprite sheet.
- `assets/pets/pray` is a 4x4, 15-frame transparent PNG sprite sheet.
- Both skins play a single `main` loop. Left-click cycles skins, and right-click toggles follow lock.
- The red `x` in the control panel quits the app.
