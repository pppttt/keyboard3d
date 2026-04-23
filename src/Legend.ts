import * as THREE from "three";
import type { Profile, RowConfig } from "./keycap";

export type LegendBuildOptions = {
  label?: string;
  labels?: string[];
  iconImageUrl?: string;
  iconPosition?: number;
  iconScale?: number;
  textColors?: string[];
  textSizes?: number[];
  defaultTextColor?: string;
  defaultTextSize?: number;
};

const iconImageCache = new Map<string, HTMLImageElement>();

const LEGEND_POSITIONS: Array<[number, number]> = [
  [0.18, 0.18],
  [0.5, 0.18],
  [0.82, 0.18],
  [0.18, 0.5],
  [0.5, 0.5],
  [0.82, 0.5],
  [0.18, 0.82],
  [0.5, 0.82],
  [0.82, 0.82],
  [0.18, 0.5],
  [0.5, 0.5],
  [0.82, 0.5],
];

const ICON_LABELS: Record<string, string> = {
  "fa-code": "</>",
};

function normalizeLegend(raw: string) {
  const withoutTags = raw.replace(/<i[^>]*class=["'][^"']*(fa-[a-z0-9-]+)[^"']*["'][^>]*><\/i>/gi, (_, icon: string) => {
    return ICON_LABELS[icon.toLowerCase()] ?? icon.replace(/^fa-/, "");
  });
  const text = withoutTags.replace(/<[^>]+>/g, "").trim();
  if (!text) return "";
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

function drawLegendCanvas(
  entries: Array<{ index: number; label: string; color: string; size: number }>,
  width: number,
  height: number,
  scale: number,
  legendScale: number,
  legendFont: string,
) {
  const pxPerMm = 42;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(128, Math.round(width * pxPerMm));
  canvas.height = Math.max(96, Math.round(height * pxPerMm));
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";
  entries.forEach((entry) => {
    const [x, y] = LEGEND_POSITIONS[entry.index];
    const fontSize = Math.max(12, Math.min(canvas.height * 0.72, (6 + entry.size * 2) * scale * legendScale));
    ctx.fillStyle = entry.color;
    ctx.font = `600 ${fontSize}px ${legendFont}, "Segoe UI Symbol", "Arial Unicode MS", sans-serif`;
    ctx.textAlign = x < 0.34 ? "left" : x > 0.66 ? "right" : "center";
    const lines = entry.label.split("\n").filter(Boolean).slice(0, 2);
    const lineHeight = fontSize * 1.08;
    lines.forEach((line, lineIndex) => {
      const offset = (lineIndex - (lines.length - 1) / 2) * lineHeight;
      ctx.fillText(line, x * canvas.width, y * canvas.height + offset);
    });
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function createLegendMaterial(texture: THREE.Texture) {
  return new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    alphaTest: 0.01,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

function getIconImage(url: string) {
  const cached = iconImageCache.get(url);
  if (cached) return cached;
  const image = new Image();
  image.src = url;
  iconImageCache.set(url, image);
  return image;
}

function drawIconOnTexture(texture: THREE.CanvasTexture, image: HTMLImageElement, positionIndex: number, iconScale: number) {
  const canvas = texture.image as HTMLCanvasElement;
  const ctx = canvas.getContext("2d")!;
  const size = Math.min(canvas.width, canvas.height) * 0.42 * iconScale;
  const [x, y] = LEGEND_POSITIONS[Math.max(0, Math.min(8, positionIndex))] ?? LEGEND_POSITIONS[4];
  ctx.drawImage(image, x * canvas.width - size / 2, y * canvas.height - size / 2, size, size);
  texture.needsUpdate = true;
}

export class Legend {
  static build(
    options: LegendBuildOptions,
    topW: number,
    topH: number,
    bottomH: number,
    cfg: Profile["common"] & RowConfig,
    legendScale: number,
    legendFont: string,
    legendColor: string,
    frontLegendHeightRatio: number,
  ) {
    const labels = options.labels?.length ? options.labels : options.label ? [options.label] : [];
    const entries = labels
      .map((label, index) => ({
        index,
        label: normalizeLegend(label ?? ""),
        color: legendColor || options.textColors?.[index] || options.defaultTextColor || "#111111",
        size: options.textSizes?.[index] ?? options.defaultTextSize ?? 3,
      }))
      .filter((entry) => entry.label);
    const iconImage = options.iconImageUrl ? getIconImage(options.iconImageUrl) : null;
    if (!entries.length && !iconImage) return null;

    const group = new THREE.Group();
    const topEntries = entries.filter((entry) => entry.index < 9);
    const iconPosition = options.iconPosition ?? 4;
    const iconScale = Math.max(0.2, Math.min(2.4, options.iconScale ?? 1));
    if (topEntries.length || iconImage) {
      const topPlaneW = topW * 0.82;
      const topPlaneH = topH * 0.82;
      const topTexture = drawLegendCanvas(topEntries, topPlaneW, topPlaneH, Math.min(topW, topH) < 15 ? 1.6 : 1.95, legendScale, legendFont);
      if (iconImage?.complete && iconImage.naturalWidth > 0) {
        drawIconOnTexture(topTexture, iconImage, iconPosition, iconScale);
      } else if (iconImage) {
        iconImage.onload = () => drawIconOnTexture(topTexture, iconImage, iconPosition, iconScale);
      }
      const labelMesh = new THREE.Mesh(new THREE.PlaneGeometry(topPlaneW, topPlaneH), createLegendMaterial(topTexture));
      labelMesh.position.set(0, cfg.topSkew ?? 0, cfg.totalDepth + 0.08);
      labelMesh.rotation.x = THREE.MathUtils.degToRad(cfg.topTilt);
      labelMesh.renderOrder = 4;
      group.add(labelMesh);
    }

    const frontEntries = entries.filter((entry) => entry.index >= 9);
    if (frontEntries.length) {
      const frontHeight = Math.max(3.2, Math.min(6.5, cfg.totalDepth * 0.62));
      const frontPlaneW = topW * 0.82;
      const frontTexture = drawLegendCanvas(frontEntries, frontPlaneW, frontHeight, 1.75, legendScale, legendFont);
      const frontMesh = new THREE.Mesh(new THREE.PlaneGeometry(frontPlaneW, frontHeight), createLegendMaterial(frontTexture));
      const heightRatio = THREE.MathUtils.clamp(frontLegendHeightRatio, 0.35, 1);
      frontMesh.position.set(0, -bottomH / 2 - 0.06, Math.max(2.2, cfg.totalDepth * heightRatio));
      frontMesh.rotation.x = Math.PI / 2;
      frontMesh.renderOrder = 4;
      group.add(frontMesh);
    }

    return group;
  }
}
