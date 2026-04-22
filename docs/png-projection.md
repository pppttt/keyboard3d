# PNG Projection Algorithm

Version note: png投影正确显示

This document records the current working PNG projection algorithm for keycap artwork.

## Data Flow

1. Users place PNG/JPEG/WebP layers on the 2D projection canvas.
2. The editor renders those layers into an offscreen projection canvas in keyboard layout coordinates.
3. Each keycap uses its KLE layout rectangle to cut its own image region from that projection canvas.
4. The cut image is converted into a 3x3 unwrap texture:
   - center cell: keycap top face
   - top cell: back side
   - left cell: left side
   - right cell: right side
   - bottom cell: front side
5. The generated texture is applied through the five-face projection overlay, not through the base keycap material UVs.

## Coordinate Rules

- The offscreen projection canvas is based on layout units, not screen pixels.
- One layout unit currently maps to 128 pixels in the offscreen projection canvas.
- Per-key cutting uses:
  - `key.x - minX`
  - `key.y - minY`
  - `key.w`
  - `key.h`
  - `frameW = maxX - minX`
  - `frameH = maxY - minY`

This keeps PNG placement aligned with the KLE key positions.

## Side Projection

Side faces use widened edge strips from the key top region.

- The side sample depth is currently 34% of the key slice width or height.
- Top and side UVs are arranged so the side starts from pixels adjacent to the top edge.
- Rounded corner vertices are assigned to the dominant side direction so corner faces are covered instead of sampling blank texture gaps.

## Refresh Behavior

Projection canvas changes are pushed synchronously to the 3D viewer.

- Dragging a PNG layer immediately redraws the offscreen projection canvas.
- Pointer release forces one final redraw.
- The viewer receives a bumped `projectionVersion` so canvas textures and keycap overlays are rebuilt without requiring key selection.

## Key Files

- `src/App.tsx`: 2D layer placement, offscreen projection canvas generation, viewer refresh.
- `src/Keyboard.ts`: per-key PNG slicing and 3x3 unwrap texture creation.
- `src/keycap.ts`: keycap projection overlay geometry and five-face UV mapping.
