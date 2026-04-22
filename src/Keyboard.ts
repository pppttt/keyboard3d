import * as THREE from "three";
import { buildSingleKeycap, type BuiltKeycap, type KeyFootprint, type SceneConfig } from "./keycap";

const U = 19.05;
const PROJECTION_TEXTURE_SIZE = 512;

export class Keyboard {
  static build(config: SceneConfig, skinTexture: THREE.Texture): BuiltKeycap {
    if (!config.layoutKeys.length) return buildSingleKeycap(config, skinTexture);

    const layoutGroup = new THREE.Group();
    const keys = config.layoutKeys;
    const minX = Math.min(...keys.map((key) => key.x));
    const minY = Math.min(...keys.map((key) => key.y));
    const maxX = Math.max(...keys.map((key) => key.x + key.w));
    const maxY = Math.max(...keys.map((key) => key.y + key.h));
    const centerX = minX + (maxX - minX) / 2;
    const centerY = minY + (maxY - minY) / 2;
    let first: BuiltKeycap | null = null;

    keys.forEach((key, index) => {
      const override = config.keyOverrides[index] ?? {};
      const labels = override.labels ?? key.labels;
      const footprint = Keyboard.keyFootprint(key);
      const center = Keyboard.keyCenter(key, footprint);
      const keyProjection =
        config.projectionCanvas
          ? Keyboard.createKeyProjectionTexture(config.projectionCanvas, {
              x: key.x - minX,
              y: key.y - minY,
              w: key.w,
              h: key.h,
              frameW: maxX - minX,
              frameH: maxY - minY,
            })
          : null;
      const built = buildSingleKeycap(config, keyProjection?.texture ?? skinTexture, {
        unitWidth: key.w,
        unitHeight: key.h,
        rowId: key.profileRow === "SB" ? config.rowId : key.profileRow,
        color: override.color,
        label: labels.find(Boolean) ?? key.label,
        labels,
        textColors: key.textColors,
        textSizes: key.textSizes,
        defaultTextColor: key.textColor,
        defaultTextSize: key.textSize,
        material: override.material,
        legendFont: override.legendFont,
        legendColor: override.legendColor,
        legendScale: override.legendScale,
        iconImageUrl: override.iconImageUrl,
        iconPosition: override.iconPosition,
        iconScale: override.iconScale,
        footprint,
        hasProjectionTexture: Boolean(keyProjection?.hasContent),
      });
      if (!first) first = built;
      built.group.position.set((key.x + center.x - centerX) * U, -(key.y + center.y - centerY) * U, 0);
      built.group.rotation.z = THREE.MathUtils.degToRad(-(key.r ?? 0));
      if ((config.selectedKeyIndices?.length ? config.selectedKeyIndices : [config.selectedKeyIndex]).includes(index)) {
        built.group.add(Keyboard.createSelectionHighlight(built));
      }
      layoutGroup.add(built.group);
    });

    const built = first ?? buildSingleKeycap(config, skinTexture);
    return {
      ...built,
      group: layoutGroup,
      bottomW: (maxX - minX) * U,
      bottomH: (maxY - minY) * U,
      topW: built.topW,
      topH: built.topH,
    };
  }

  private static keyFootprint(key: SceneConfig["layoutKeys"][number]): KeyFootprint[] | undefined {
    if (key.enterType !== "iso" || key.w2 === undefined || key.h2 === undefined) return undefined;
    return [
      { x: 0, y: 0, w: key.w, h: key.h },
      { x: key.x2 ?? 0, y: key.y2 ?? 0, w: key.w2, h: key.h2 },
    ];
  }

  private static keyCenter(key: SceneConfig["layoutKeys"][number], footprint: KeyFootprint[] | undefined) {
    if (!footprint?.length) return { x: key.w / 2, y: key.h / 2 };
    const minX = Math.min(...footprint.map((rect) => rect.x));
    const minY = Math.min(...footprint.map((rect) => rect.y));
    const maxX = Math.max(...footprint.map((rect) => rect.x + rect.w));
    const maxY = Math.max(...footprint.map((rect) => rect.y + rect.h));
    return { x: minX + (maxX - minX) / 2, y: minY + (maxY - minY) / 2 };
  }

  private static createSelectionHighlight(keycap: BuiltKeycap) {
    const group = new THREE.Group();
    [0, 0.35, 0.7].forEach((offset, index) => {
      const topOutline = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(keycap.topW + 2.4 + offset, keycap.topH + 2.4 + offset, 0.28)),
        new THREE.LineBasicMaterial({ color: 0xff2f2f, transparent: true, opacity: index === 0 ? 1 : 0.72 }),
      );
      topOutline.position.set(0, keycap.cfg.topSkew ?? 0, keycap.cfg.totalDepth + 0.18 + index * 0.015);
      topOutline.rotation.x = THREE.MathUtils.degToRad(keycap.cfg.topTilt);
      topOutline.renderOrder = 6;
      group.add(topOutline);
    });
    return group;
  }

  private static createKeyProjectionTexture(
    projectionCanvas: HTMLCanvasElement,
    rect: { x: number; y: number; w: number; h: number; frameW: number; frameH: number },
  ) {
    const canvas = document.createElement("canvas");
    canvas.width = PROJECTION_TEXTURE_SIZE;
    canvas.height = PROJECTION_TEXTURE_SIZE;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const cell = PROJECTION_TEXTURE_SIZE / 3;
    const sourceX = (rect.x / rect.frameW) * projectionCanvas.width;
    const sourceY = (rect.y / rect.frameH) * projectionCanvas.height;
    const sourceW = (rect.w / rect.frameW) * projectionCanvas.width;
    const sourceH = (rect.h / rect.frameH) * projectionCanvas.height;
    const sideDepthX = Math.min(sourceW * 0.28, Math.max(4, sourceW * 0.18));
    const sideDepthY = Math.min(sourceH * 0.28, Math.max(4, sourceH * 0.18));

    const drawSlice = (sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw = cell, dh = cell) => {
      const clippedX = Math.max(0, sx);
      const clippedY = Math.max(0, sy);
      const clippedRight = Math.min(projectionCanvas.width, sx + sw);
      const clippedBottom = Math.min(projectionCanvas.height, sy + sh);
      const clippedW = clippedRight - clippedX;
      const clippedH = clippedBottom - clippedY;
      if (clippedW <= 0 || clippedH <= 0) return;

      const offsetX = ((clippedX - sx) / sw) * dw;
      const offsetY = ((clippedY - sy) / sh) * dh;
      const destW = (clippedW / sw) * dw;
      const destH = (clippedH / sh) * dh;
      ctx.drawImage(projectionCanvas, clippedX, clippedY, clippedW, clippedH, dx + offsetX, dy + offsetY, destW, destH);
    };

    drawSlice(sourceX + sideDepthX, sourceY + sideDepthY, sourceW - sideDepthX * 2, sourceH - sideDepthY * 2, cell, cell);
    drawSlice(sourceX + sideDepthX, sourceY, sourceW - sideDepthX * 2, sideDepthY, cell, 0);
    drawSlice(sourceX, sourceY + sideDepthY, sideDepthX, sourceH - sideDepthY * 2, 0, cell);
    drawSlice(sourceX + sourceW - sideDepthX, sourceY + sideDepthY, sideDepthX, sourceH - sideDepthY * 2, cell * 2, cell);
    drawSlice(sourceX + sideDepthX, sourceY + sourceH - sideDepthY, sourceW - sideDepthX * 2, sideDepthY, cell, cell * 2);

    const hasContent = Keyboard.hasVisiblePixels(ctx, canvas.width, canvas.height);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.generateMipmaps = false;
    texture.minFilter = THREE.LinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.anisotropy = 8;
    texture.needsUpdate = true;
    return { texture, hasContent };
  }

  private static hasVisiblePixels(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const { data } = ctx.getImageData(0, 0, width, height);
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 8) return true;
    }
    return false;
  }
}
