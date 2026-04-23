# Keyboard3D

Keyboard3D is a React, Vite, and Three.js based keyboard viewer for previewing keycap layouts and image projection effects in 3D.

## Features

- Render keyboard layouts as interactive 3D keycaps.
- Load keyboard layout data from JSON files.
- Preview PNG artwork projected across keycap tops and sides after manual Apply.
- Support configurable case and panel data from `public/config`.
- Export production ZIP packages with heat-transfer sheets and per-face key PNGs.
- Render 4K advertising-style product images from a 45-degree studio camera.
- Optionally generate Gemini/Veo advertising videos from the rendered product image through a local server proxy.

## Current Milestone

`v1.0.3`: Advertising render workflow and manual projection apply

This version adds a dedicated advertising render pipeline, a Gemini/Veo video-generation proxy, manual Apply control for PNG projection updates, and a Case visibility switch.

## v1.0.3 Features

- 4K advertising image render: `Render HD image` exports a 3840 x 2160 PNG from a 45-degree three-quarter camera angle.
- Dedicated render module: still/video advertising render code now lives in `src/SceneRender.ts`.
- Studio lighting pass: three-direction product lighting, background atmosphere, subtle Bloom, lens finishing, and vignette are isolated from the live viewer.
- Manual PNG Apply: uploaded or edited PNG layers update the 2D Projection Canvas immediately, but the 3D view updates only after clicking `Apply`.
- Case visibility toggle: the left panel can show or hide the keyboard case without affecting keycaps or projection editing.
- Gemini/Veo video proxy: a local Vite middleware at `/api/gemini-ad-video` sends the rendered PNG to Gemini and downloads the generated MP4.
- Environment-key handling: `GEMINI_API_KEY` is read server-side from `.env` or the shell environment, never from browser code.

### Gemini Video Setup

Create a local `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

Then restart the dev server and click `Generate ad video`. The app renders the current keyboard as a PNG, sends it to the local proxy, waits for Gemini/Veo generation, and downloads an MP4.

## v1.0.2 Features

- PNG cutting projection: each key samples its own projection rectangle and splits it into top, back, front, left, and right face regions.
- 3D preview projection: per-key PNG regions are converted into a 3 x 3 texture atlas and projected onto the generated keycap top and side geometry.
- Heat-transfer sheet export: `production/heat-transfer-sheet.png` contains a flattened cross-style unwrap for all keys.
- Five-face PNG export: `production/key-faces/` contains separate `top`, `back`, `front`, `left`, and `right` PNG files for each key.
- Project metadata export: `project.json` records layout, projection layers, heat-transfer sheet metrics, five-face file paths, pixel sizes, and millimeter sizes.
- Theme export: `theme.json` records reusable keycap colors, legend fonts, legend colors, legend positions, icons, and per-key style overrides.
- ZIP download: the `Export` button packages the project metadata, production PNGs, and original projection layer assets into one `.zip` file.

### Export ZIP Contents

```text
project.json
theme.json
production/heat-transfer-sheet.png
production/key-faces/{key-index}-{key-label}-top.png
production/key-faces/{key-index}-{key-label}-back.png
production/key-faces/{key-index}-{key-label}-front.png
production/key-faces/{key-index}-{key-label}-left.png
production/key-faces/{key-index}-{key-label}-right.png
assets/images/{layer-index}-{source-name}.{ext}
```

The ZIP is generated entirely in the browser. If export fails, the UI shows an error message near the projection canvas.

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
server/               Local Vite API middleware for Gemini video generation
src/                  Application source code
src/App.tsx           Main UI and projection workflow
src/FileExporter.ts   ZIP export, heat-transfer sheet, and five-face PNG generation
src/Keyboard.ts       Keyboard rendering and per-key texture slicing
src/SceneRender.ts    Advertising still/video render pipeline
src/keycap.ts         Keycap geometry and projection mapping
styles.css            Application styles
```

## Notes

The PNG projection algorithm is documented in `docs/png-projection.md`.
