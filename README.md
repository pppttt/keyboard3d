# Keyboard3D

Keyboard3D is a React, Vite, and Three.js based keyboard viewer for previewing keycap layouts and image projection effects in 3D.

## Features

- Render keyboard layouts as interactive 3D keycaps.
- Load keyboard layout data from JSON files.
- Preview PNG artwork projected across keycap tops and sides.
- Synchronize 2D artwork placement with the 3D viewer.
- Support configurable case and panel data from `public/config`.

## Current Milestone

`v1.0.0`: PNG projection display

This version marks the first important milestone where PNG projection displays correctly on the keyboard model.

## PNG Projection And Cutting Algorithm

The 2D projection canvas is the single source of truth. Users place PNG layers on the canvas in screen space, and the app republishes them to a layout-space `projectionCanvas` whose dimensions are proportional to the full keyboard layout bounds.

### Coordinate Mapping

For each key, the KLE rectangle is mapped into the projection canvas:

```text
sourceX = ((key.x - layoutMinX) / layoutFrameW) * projectionCanvas.width
sourceY = ((key.y - layoutMinY) / layoutFrameH) * projectionCanvas.height
sourceW = (key.w / layoutFrameW) * projectionCanvas.width
sourceH = (key.h / layoutFrameH) * projectionCanvas.height
```

That source rectangle is split into a 3 x 3 logical grid:

```text
[ corner ][ back  ][ corner ]
[ left   ][ top   ][ right  ]
[ corner ][ front ][ corner ]
```

The center cell is the keycap top. The four edge cells are the side artwork. Side content is sampled from the current key rectangle's internal border bands, not from outside the key rectangle. This avoids accidentally sampling neighboring keycap tops when KLE keys are directly adjacent.

### 3D Preview Texture

`src/Keyboard.ts` builds a per-key 512 x 512 canvas texture in `createKeyProjectionTexture`.

- The center atlas cell receives the key top artwork.
- The top atlas cell receives the back side band.
- The bottom atlas cell receives the front side band.
- The left and right atlas cells receive the left and right side bands.
- The corner cells are not used by the live 3D preview.

`src/keycap.ts` maps this atlas onto generated keycap geometry. The top mesh samples the center cell, while side geometry samples the matching edge cells.

### Heat Transfer Sheet Export

`src/App.tsx` generates `production/heat-transfer-sheet.png` during project export.

For every key, `heatTransferTileForKey` derives physical face sizes from the selected keycap profile:

- `topW` and `topH` are based on the profile top dimensions.
- `sideX` and `sideY` are based on the sloped distance between the top and bottom keycap edges.
- `projectedInsetX` and `projectedInsetY` define the source border bands used for side artwork.

`drawHeatTransferUnwrap3x3` draws each key as a cross-shaped unwrap:

```text
          back
left      top      right
          front
```

The top uses the center source band. The four sides use the current key's internal border bands. Corner samples are blended into side joins to reduce visible seams in the flattened artwork.

### Five-Face PNG Export

The export also writes separate PNG files to:

```text
production/key-faces/
```

Each key produces five files:

- `top`
- `back`
- `front`
- `left`
- `right`

The file metadata is recorded in `project.json` under `heatTransferFaces.files`, including face name, key index, pixel size, and millimeter size. These face PNGs use the same sampling rules as the heat-transfer sheet, so preview, sheet export, and five-face export stay aligned.

### Artwork Placement Rule

Because side bands come from inside each key rectangle, side graphics should be placed near the edge of the key area on the projection canvas. The central part of the key area becomes the top face; the border area becomes side artwork. Artwork placed over another key's top will not be used for the current key's side.

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
