# Keyboard3D

Keyboard3D is a React, Vite, and Three.js based keyboard viewer for previewing keycap layouts and image projection effects in 3D.

## Features

- Render keyboard layouts as interactive 3D keycaps.
- Load keyboard layout data from JSON files.
- Preview PNG artwork projected across keycap tops and sides.
- Synchronize 2D artwork placement with the 3D viewer.
- Support configurable case and panel data from `public/config`.

## Current Milestone

`v1.0.0`: png正确投影显示

This version marks the first important milestone where PNG projection displays correctly on the keyboard model.

## Tech Stack

- React 19
- TypeScript
- Vite
- Three.js
- Zustand
- `@ijprest/kle-serial`

## Getting Started

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Project Structure

```text
docs/                 Technical notes
public/config/        Viewer and panel configuration
public/layouts/       Keyboard layout JSON files
src/                  Application source code
src/App.tsx           Main UI and projection workflow
src/Keyboard.ts       Keyboard rendering and per-key texture slicing
src/keycap.ts         Keycap geometry and projection mapping
styles.css            Application styles
```

## Notes

The PNG projection algorithm is documented in `docs/png-projection.md`.
