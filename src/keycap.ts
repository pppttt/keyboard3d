import * as THREE from "three";
import { Legend } from "./Legend";
import type { ParsedKey } from "./utils/KLEParser";

const U = 19.05;

export type DishType = "cylindrical" | "spherical";
export type KeycapMaterial = "pbt" | "abs" | "resin" | "metal";
export type CaseMaterial = "aluminum" | "polycarbonate" | "wood" | "acrylic";

export type KeyOverride = {
  color?: string;
  material?: KeycapMaterial;
  labels?: string[];
  iconImageUrl?: string;
  iconPosition?: number;
  iconScale?: number;
  legendFont?: string;
  legendColor?: string;
  legendScale?: number;
};

export type KeyboardCaseConfig = {
  color: string;
  material: CaseMaterial;
  modelPath?: string;
};

export type RowConfig = { totalDepth: number; topTilt: number; topSkew?: number };
export type Profile = {
  label: string;
  source: string;
  common: {
    bottomKeyWidth: number;
    bottomKeyHeight: number;
    widthDifference: number;
    heightDifference: number;
    dishType: DishType;
    dishDepth: number;
    cornerRadius: number;
    bottomSkew: number;
    topSkew?: number;
  };
  rows: Record<string, RowConfig>;
};

export type SceneConfig = {
  profileId: string;
  rowId: string;
  unitWidth: number;
  unitHeight: number;
  dishDepth: number;
  projectionOpacity: number;
  legendScale: number;
  legendFont: string;
  legendColor: string;
  frontLegendHeight: number;
  sideSpread: number;
  sideEase: number;
  showWire: boolean;
  showGhost: boolean;
  showProjection: boolean;
  showCase: boolean;
  skinImage: HTMLImageElement | null;
  projectionCanvas: HTMLCanvasElement | null;
  projectionVersion: number;
  layoutKeys: ParsedKey[];
  keyOverrides: Record<number, KeyOverride>;
  selectedKeyIndex: number;
  selectedKeyIndices: number[];
  keycapMaterial: KeycapMaterial;
  keycapColor: string;
  caseConfig: KeyboardCaseConfig;
  spotLightDistance: number;
};

export type BuiltKeycap = {
  group: THREE.Group;
  cfg: Profile["common"] & RowConfig;
  topW: number;
  topH: number;
  bottomW: number;
  bottomH: number;
  rowId: string;
};

export type KeyFootprint = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type KeycapBuildOptions = {
  unitWidth?: number;
  unitHeight?: number;
  rowId?: string;
  color?: string;
  label?: string;
  labels?: string[];
  textColors?: string[];
  textSizes?: number[];
  defaultTextColor?: string;
  defaultTextSize?: number;
  material?: KeycapMaterial;
  legendFont?: string;
  legendColor?: string;
  legendScale?: number;
  iconImageUrl?: string;
  iconPosition?: number;
  iconScale?: number;
  footprint?: KeyFootprint[];
  projectionRect?: ProjectionRect;
  hasProjectionTexture?: boolean;
};

export type ProjectionRect = {
  x: number;
  y: number;
  w: number;
  h: number;
  frameW: number;
  frameH: number;
  centerX: number;
  centerY: number;
  rotation: number;
};

export const profiles: Record<string, Profile> = {
  cherry: {
    label: "Cherry",
    source: "src/key_profiles/cherry.scad",
    common: {
      bottomKeyWidth: 18.16,
      bottomKeyHeight: 18.16,
      widthDifference: 6.31,
      heightDifference: 3.52,
      dishType: "cylindrical",
      dishDepth: 0.65,
      cornerRadius: 2.1,
      bottomSkew: 0,
      topSkew: 2,
    },
    rows: {
      R1: { totalDepth: 9.8, topTilt: 0 },
      R2: { totalDepth: 7.45, topTilt: 2.5 },
      R3: { totalDepth: 6.55, topTilt: 5 },
      R4: { totalDepth: 7.35, topTilt: 11.5 },
    },
  },
  oem: {
    label: "OEM",
    source: "src/key_profiles/oem.scad",
    common: {
      bottomKeyWidth: 18.05,
      bottomKeyHeight: 18.05,
      widthDifference: 5.7,
      heightDifference: 4,
      dishType: "cylindrical",
      dishDepth: 1,
      cornerRadius: 2.4,
      bottomSkew: 0,
      topSkew: 1.75,
    },
    rows: {
      R0: { totalDepth: 11.2, topTilt: -3 },
      R1: { totalDepth: 9.45, topTilt: 1 },
      R2: { totalDepth: 9, topTilt: 6 },
      R3: { totalDepth: 9.25, topTilt: 9 },
      R4: { totalDepth: 9.25, topTilt: 10 },
      R5: { totalDepth: 11.2, topTilt: -3 },
    },
  },
  xda: {
    label: "XDA",
    source: "common XDA approximation, KeyV2-style variables",
    common: {
      bottomKeyWidth: 18.1,
      bottomKeyHeight: 18.1,
      widthDifference: 5.1,
      heightDifference: 5.1,
      dishType: "spherical",
      dishDepth: 0.65,
      cornerRadius: 2.7,
      bottomSkew: 0,
    },
    rows: {
      R1: { totalDepth: 7.6, topTilt: 0, topSkew: 0 },
      R2: { totalDepth: 7.6, topTilt: 0, topSkew: 0 },
      R3: { totalDepth: 7.6, topTilt: 0, topSkew: 0 },
      R4: { totalDepth: 7.6, topTilt: 0, topSkew: 0 },
    },
  },
  dsa: {
    label: "DSA",
    source: "src/key_profiles/dsa.scad",
    common: {
      bottomKeyWidth: 18.24,
      bottomKeyHeight: 18.24,
      widthDifference: 7,
      heightDifference: 7,
      dishType: "spherical",
      dishDepth: 1.2,
      cornerRadius: 2.5,
      bottomSkew: 0,
    },
    rows: {
      R1: { totalDepth: 7.4, topTilt: 0, topSkew: 0 },
      R2: { totalDepth: 7.4, topTilt: 0, topSkew: 0 },
      R3: { totalDepth: 7.4, topTilt: 0, topSkew: 0 },
      R4: { totalDepth: 7.4, topTilt: 0, topSkew: 0 },
    },
  },
};

const colors: Record<string, number> = {
  cherry: 0xd9614c,
  oem: 0xe3b34f,
  xda: 0x62c7b2,
  dsa: 0x8fc6ff,
};

const keycapMaterials: Record<
  KeycapMaterial,
  {
    roughness: number;
    metalness: number;
    clearcoat?: number;
    clearcoatRoughness?: number;
    bumpScale?: number;
    texture?: "pbt" | "abs" | "metal";
  }
> = {
  pbt: { roughness: 0.86, metalness: 0.01, bumpScale: 0.055, texture: "pbt" },
  abs: { roughness: 0.28, metalness: 0.01, clearcoat: 0.55, clearcoatRoughness: 0.18, bumpScale: 0.012, texture: "abs" },
  resin: { roughness: 0.18, metalness: 0.02, clearcoat: 0.35, clearcoatRoughness: 0.12 },
  metal: { roughness: 0.18, metalness: 0.92, clearcoat: 0.18, clearcoatRoughness: 0.08, bumpScale: 0.025, texture: "metal" },
};

const materialTextureCache = new Map<string, THREE.CanvasTexture>();

function createMaterialTexture(kind: "pbt" | "abs" | "metal") {
  const cached = materialTextureCache.get(kind);
  if (cached) return cached;

  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);
  const data = image.data;
  let seed = kind === "pbt" ? 73 : kind === "abs" ? 149 : 211;
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0xffffffff;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;
      const grain = rand();
      const brushed = Math.sin((x + grain * 8) * 0.42) * 0.5 + 0.5;
      const value =
        kind === "pbt"
          ? 118 + grain * 58
          : kind === "abs"
            ? 132 + grain * 18
            : 112 + brushed * 48 + grain * 20;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === "metal" ? 18 : 28, kind === "metal" ? 10 : 28);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  materialTextureCache.set(kind, texture);
  return texture;
}

function createKeycapMaterial(materialType: KeycapMaterial, color: string | number) {
  const settings = keycapMaterials[materialType] ?? keycapMaterials.pbt;
  const texture = settings.texture ? createMaterialTexture(settings.texture) : null;
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: settings.roughness,
    metalness: settings.metalness,
    clearcoat: settings.clearcoat ?? 0,
    clearcoatRoughness: settings.clearcoatRoughness ?? 0.4,
    bumpMap: texture ?? undefined,
    roughnessMap: texture ?? undefined,
    bumpScale: settings.bumpScale ?? 0,
  });
}

export function buildReadout(config: SceneConfig): string {
  const profile = profiles[config.profileId] ?? profiles.cherry;
  const rowId = resolveRow(profile, config.rowId);
  const cfg: Profile["common"] & RowConfig = { ...profile.common, ...profile.rows[rowId], dishDepth: config.dishDepth };
  const bottomW = profile.common.bottomKeyWidth + (config.unitWidth - 1) * U;
  const bottomH = profile.common.bottomKeyHeight + (config.unitHeight - 1) * U;
  return JSON.stringify(
    {
      file: profile.source,
      rowModule: `${profile.label.toLowerCase()}_${rowId.toLowerCase()}()`,
      variables: {
        "$total_depth": cfg.totalDepth,
        "$top_tilt": `${cfg.topTilt} deg`,
        "$top_skew": cfg.topSkew,
        "$width_difference": profile.common.widthDifference,
        "$height_difference": profile.common.heightDifference,
        "$dish_type": profile.common.dishType,
        "$dish_depth": config.dishDepth,
        skinUnwrap: {
          center: "top",
          edges: "side skirt scaled by real top-to-bottom surface length",
          sideSpread: config.sideSpread,
          sideEase: config.sideEase,
          corners: "diagonal corner cells carry rounded corner transitions",
        },
      },
      derived: {
        keyCount: config.layoutKeys.length || 1,
        bottomSize: `${bottomW.toFixed(2)} x ${bottomH.toFixed(2)} mm`,
        topSize: `${Math.max(6, bottomW - profile.common.widthDifference).toFixed(2)} x ${Math.max(
          6,
          bottomH - profile.common.heightDifference,
        ).toFixed(2)} mm`,
        meshStrategy: "rounded bottom ring + transformed top ring + dish grid",
      },
    },
    null,
    2,
  );
}

export function createDefaultSkinTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#101416";
  ctx.fillRect(0, 0, 512, 512);
  const labels: Array<[string, number, number, string]> = [
    ["BACK", 1, 0, "#4f88d9"],
    ["LEFT", 0, 1, "#64c6b0"],
    ["TOP", 1, 1, "#e3b34f"],
    ["RIGHT", 2, 1, "#ef8354"],
    ["FRONT", 1, 2, "#d96fa5"],
  ];
  const cw = 512 / 3;
  const ch = 512 / 3;
  ctx.font = "bold 34px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  labels.forEach(([label, x, y, color]) => {
    ctx.fillStyle = color;
    ctx.fillRect(x * cw + 6, y * ch + 6, cw - 12, ch - 12);
    ctx.fillStyle = "rgba(255,255,255,0.28)";
    ctx.fillRect(x * cw + 18, y * ch + 18, cw - 36, ch - 36);
    ctx.fillStyle = "#101416";
    ctx.fillText(label, x * cw + cw / 2, y * ch + ch / 2);
  });
  return makeTextureFromCanvas(canvas);
}

export function buildKeycap(config: SceneConfig, skinTexture: THREE.Texture): BuiltKeycap {
  return buildSingleKeycap(config, skinTexture);
}

export function buildSingleKeycap(config: SceneConfig, skinTexture: THREE.Texture, options: KeycapBuildOptions = {}): BuiltKeycap {
  const profile = profiles[config.profileId] ?? profiles.cherry;
  const rowId = resolveRow(profile, options.rowId ?? config.rowId);
  const cfg: Profile["common"] & RowConfig = { ...profile.common, ...profile.rows[rowId], dishDepth: config.dishDepth };
  const unitWidth = options.unitWidth ?? config.unitWidth;
  const unitHeight = options.unitHeight ?? config.unitHeight;
  const footprint = options.footprint ? normalizeFootprint(options.footprint) : null;
  const footprintBounds = footprint ? footprintBoundsUnits(footprint) : null;
  const effectiveUnitWidth = footprintBounds?.w ?? unitWidth;
  const effectiveUnitHeight = footprintBounds?.h ?? unitHeight;
  const bottomW = profile.common.bottomKeyWidth + (effectiveUnitWidth - 1) * U;
  const bottomH = profile.common.bottomKeyHeight + (effectiveUnitHeight - 1) * U;
  const topW = Math.max(6, bottomW - profile.common.widthDifference);
  const topH = Math.max(6, bottomH - profile.common.heightDifference);
  const bottom = footprint
    ? footprintPoints(footprint, bottomW, bottomH, cfg.cornerRadius + 1.4)
    : roundedRectPoints(bottomW, bottomH, cfg.cornerRadius + 1.4, 7);
  const top = footprint
    ? footprintPoints(footprint, topW, topH, cfg.cornerRadius)
    : roundedRectPoints(topW, topH, cfg.cornerRadius, 7);
  const positions: number[] = [];
  const indices: number[] = [];
  const sideIndices: number[] = [];
  const topIndices: number[] = [];
  const ringCount = bottom.length;
  bottom.forEach((p) => positions.push(p.x, p.y, 0));
  top.forEach((p) => {
    const v = transformTopVertex(p.x, p.y, cfg);
    positions.push(v.x, v.y, v.z - dishOffset(p.x, p.y, topW, topH, cfg) * 0.15);
  });
  for (let i = 0; i < ringCount; i += 1) {
    const n = (i + 1) % ringCount;
    sideIndices.push(i, n, ringCount + n, i, ringCount + n, ringCount + i);
  }
  indices.push(...sideIndices);
  const centerBottom = positions.length / 3;
  positions.push(0, 0, 0);
  for (let i = 0; i < ringCount; i += 1) indices.push(centerBottom, (i + 1) % ringCount, i);
  if (footprint) {
    const topCenter = positions.length / 3;
    positions.push(0, cfg.topSkew ?? 0, cfg.totalDepth - dishOffset(0, 0, topW, topH, cfg));
    for (let i = 0; i < ringCount; i += 1) {
      const next = (i + 1) % ringCount;
      topIndices.push(topCenter, ringCount + i, ringCount + next);
    }
  } else {
    const grid = 22;
    const topStart = positions.length / 3;
    for (let iy = 0; iy <= grid; iy += 1) {
      const y = -topH / 2 + (iy / grid) * topH;
      for (let ix = 0; ix <= grid; ix += 1) {
        const x = -topW / 2 + (ix / grid) * topW;
        const p = clampToRoundedRect(x, y, topW, topH, cfg.cornerRadius);
        const v = transformTopVertex(p.x, p.y, cfg);
        positions.push(v.x, v.y, v.z - dishOffset(p.x, p.y, topW, topH, cfg));
      }
    }
    for (let iy = 0; iy < grid; iy += 1) {
      for (let ix = 0; ix < grid; ix += 1) {
        const a = topStart + iy * (grid + 1) + ix;
        const b = a + 1;
        const c = a + grid + 1;
        const d = c + 1;
        topIndices.push(a, b, c, b, d, c);
      }
    }
  }
  indices.push(...topIndices);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  const uvs: number[] = [];
  for (let i = 0; i < positions.length; i += 3) {
    uvs.push(positions[i] / bottomW + 0.5, positions[i + 1] / bottomH + 0.5);
  }
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const materialType = options.material ?? config.keycapMaterial;
  const hasProjectionTexture = options.hasProjectionTexture ?? Boolean(config.projectionCanvas);
  const mesh = new THREE.Mesh(
    geometry,
    createKeycapMaterial(materialType, options.color ?? config.keycapColor ?? colors[config.profileId]),
  );
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.18 }),
  );
  wire.visible = config.showWire;
  const bottomBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(bottomW, bottomH, 0.02)),
    new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.22 }),
  );
  bottomBox.visible = config.showGhost;
  const topBox = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(topW, topH, 0.02)),
    new THREE.LineBasicMaterial({ color: 0x64c6b0, transparent: true, opacity: 0.45 }),
  );
  topBox.position.set(0, cfg.topSkew ?? 0, cfg.totalDepth);
  topBox.rotation.x = THREE.MathUtils.degToRad(cfg.topTilt);
  topBox.visible = config.showGhost;
  const projection = hasProjectionTexture
    ? buildProjectionOverlays(positions, { topW, topH, bottomW, bottomH, topRing: top, projectionRect: options.projectionRect }, cfg, config, skinTexture)
    : new THREE.Group();
  const group = new THREE.Group();
  group.add(mesh, projection, wire, bottomBox, topBox);
  const legends = Legend.build(
    { ...options, iconImageUrl: options.iconImageUrl, iconPosition: options.iconPosition, iconScale: options.iconScale },
    topW,
    topH,
    bottomH,
    cfg,
    options.legendScale ?? config.legendScale,
    options.legendFont ?? config.legendFont,
    options.legendColor ?? config.legendColor,
    config.frontLegendHeight,
  );
  if (legends) {
    group.add(legends);
  }
  return { group, cfg, topW, topH, bottomW, bottomH, rowId };
}

function resolveRow(profile: Profile, rowId: string) {
  if (profile.rows[rowId]) return rowId;
  if (rowId === "R4" && profile.rows.R3) return "R3";
  if (rowId === "R1" && profile.rows.R0) return "R0";
  return Object.keys(profile.rows)[0];
}

function roundedRectPoints(width: number, height: number, radius: number, segments = 8) {
  const w = width / 2 - radius;
  const h = height / 2 - radius;
  const centers: Array<[number, number, number]> = [
    [w, h, 0],
    [-w, h, Math.PI / 2],
    [-w, -h, Math.PI],
    [w, -h, (Math.PI * 3) / 2],
  ];
  const pts: THREE.Vector2[] = [];
  for (const [cx, cy, start] of centers) {
    for (let i = 0; i <= segments; i += 1) {
      const a = start + (i / segments) * (Math.PI / 2);
      pts.push(new THREE.Vector2(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius));
    }
  }
  return pts;
}

function normalizeFootprint(footprint: KeyFootprint[]) {
  const minX = Math.min(...footprint.map((rect) => rect.x));
  const minY = Math.min(...footprint.map((rect) => rect.y));
  return footprint.map((rect) => ({
    x: rect.x - minX,
    y: rect.y - minY,
    w: rect.w,
    h: rect.h,
  }));
}

function footprintPoints(footprint: KeyFootprint[], width: number, height: number, radius: number) {
  const bounds = footprintBoundsUnits(footprint);
  const xs = Array.from(new Set(footprint.flatMap((rect) => [rect.x, rect.x + rect.w]))).sort((a, b) => a - b);
  const ys = Array.from(new Set(footprint.flatMap((rect) => [rect.y, rect.y + rect.h]))).sort((a, b) => a - b);
  const cells = new Set<string>();
  for (let yi = 0; yi < ys.length - 1; yi += 1) {
    for (let xi = 0; xi < xs.length - 1; xi += 1) {
      const cx = (xs[xi] + xs[xi + 1]) / 2;
      const cy = (ys[yi] + ys[yi + 1]) / 2;
      if (footprint.some((rect) => cx >= rect.x && cx <= rect.x + rect.w && cy >= rect.y && cy <= rect.y + rect.h)) {
        cells.add(`${xi},${yi}`);
      }
    }
  }
  const edges: Array<[THREE.Vector2, THREE.Vector2]> = [];
  const has = (x: number, y: number) => cells.has(`${x},${y}`);
  cells.forEach((key) => {
    const [x, y] = key.split(",").map(Number);
    if (!has(x, y - 1)) edges.push([new THREE.Vector2(xs[x], ys[y]), new THREE.Vector2(xs[x + 1], ys[y])]);
    if (!has(x + 1, y)) edges.push([new THREE.Vector2(xs[x + 1], ys[y]), new THREE.Vector2(xs[x + 1], ys[y + 1])]);
    if (!has(x, y + 1)) edges.push([new THREE.Vector2(xs[x + 1], ys[y + 1]), new THREE.Vector2(xs[x], ys[y + 1])]);
    if (!has(x - 1, y)) edges.push([new THREE.Vector2(xs[x], ys[y + 1]), new THREE.Vector2(xs[x], ys[y])]);
  });

  const points: THREE.Vector2[] = [];
  const first = edges.shift();
  if (!first) return roundedRectPoints(width, height, radius, 7);
  points.push(first[0], first[1]);
  let current = first[1];
  while (edges.length) {
    const index = edges.findIndex((edge) => edge[0].distanceToSquared(current) < 0.0001);
    if (index < 0) break;
    const [edge] = edges.splice(index, 1);
    current = edge[1];
    if (current.distanceToSquared(points[0]) < 0.0001) break;
    points.push(current);
  }

  const raw = points.map((point) => new THREE.Vector2((point.x / bounds.w - 0.5) * width, (0.5 - point.y / bounds.h) * height));
  if (polygonArea(raw) < 0) raw.reverse();
  return roundPolygonPoints(raw, radius, 5);
}

function footprintBoundsUnits(footprint: KeyFootprint[]) {
  const minX = Math.min(...footprint.map((rect) => rect.x));
  const minY = Math.min(...footprint.map((rect) => rect.y));
  const maxX = Math.max(...footprint.map((rect) => rect.x + rect.w));
  const maxY = Math.max(...footprint.map((rect) => rect.y + rect.h));
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

function polygonArea(points: THREE.Vector2[]) {
  let area = 0;
  for (let i = 0; i < points.length; i += 1) {
    const next = (i + 1) % points.length;
    area += points[i].x * points[next].y - points[next].x * points[i].y;
  }
  return area / 2;
}

function roundPolygonPoints(points: THREE.Vector2[], radius: number, segments: number) {
  const rounded: THREE.Vector2[] = [];
  for (let i = 0; i < points.length; i += 1) {
    const prev = points[(i - 1 + points.length) % points.length];
    const current = points[i];
    const next = points[(i + 1) % points.length];
    const toPrev = prev.clone().sub(current);
    const toNext = next.clone().sub(current);
    const distance = Math.min(radius, toPrev.length() * 0.45, toNext.length() * 0.45);
    const start = current.clone().add(toPrev.normalize().multiplyScalar(distance));
    const end = current.clone().add(toNext.normalize().multiplyScalar(distance));
    for (let step = 0; step <= segments; step += 1) {
      const t = step / segments;
      rounded.push(start.clone().lerp(current, t).lerp(current.clone().lerp(end, t), t));
    }
  }
  return rounded;
}

function clampToRoundedRect(x: number, y: number, width: number, height: number, radius: number) {
  const halfW = width / 2;
  const halfH = height / 2;
  const innerX = Math.max(0.001, halfW - radius);
  const innerY = Math.max(0.001, halfH - radius);
  const sx = Math.sign(x) || 1;
  const sy = Math.sign(y) || 1;
  const ax = Math.abs(x);
  const ay = Math.abs(y);
  if (ax <= innerX || ay <= innerY) return new THREE.Vector2(x, y);

  const cx = sx * innerX;
  const cy = sy * innerY;
  const dx = x - cx;
  const dy = y - cy;
  const distance = Math.hypot(dx, dy);
  if (distance <= radius) return new THREE.Vector2(x, y);

  const scale = radius / Math.max(distance, 0.001);
  return new THREE.Vector2(cx + dx * scale, cy + dy * scale);
}

function transformTopVertex(x: number, y: number, cfg: Profile["common"] & RowConfig) {
  const tilt = THREE.MathUtils.degToRad(cfg.topTilt);
  const z = cfg.totalDepth + Math.sin(tilt) * y;
  return new THREE.Vector3(x, y + (cfg.topSkew ?? 0), z);
}

function dishOffset(x: number, y: number, topW: number, topH: number, cfg: Profile["common"] & RowConfig) {
  const depth = cfg.dishDepth;
  if (!depth) return 0;
  const nx = Math.abs(x) / Math.max(1, topW / 2);
  const ny = Math.abs(y) / Math.max(1, topH / 2);
  if (cfg.dishType === "cylindrical") return depth * Math.max(0, 1 - nx ** 2);
  return depth * Math.max(0, 1 - (nx ** 2 + ny ** 2) * 0.75);
}

function makeTextureFromCanvas(canvas: HTMLCanvasElement) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function pushVertex(data: { vertices: number[]; uvs: number[] }, vertex: THREE.Vector3, uv: THREE.Vector2) {
  data.vertices.push(vertex.x, vertex.y, vertex.z);
  data.uvs.push(uv.x, uv.y);
}

function pushQuad(
  data: { vertices: number[]; uvs: number[] },
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  uva: THREE.Vector2,
  uvb: THREE.Vector2,
  uvc: THREE.Vector2,
  uvd: THREE.Vector2,
) {
  pushVertex(data, a, uva);
  pushVertex(data, c, uvc);
  pushVertex(data, b, uvb);
  pushVertex(data, b, uvb);
  pushVertex(data, c, uvc);
  pushVertex(data, d, uvd);
}

function meshFromProjectionData(data: { vertices: number[]; uvs: number[] }, material: THREE.Material) {
  if (!data.vertices.length) return null;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(data.vertices, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(data.uvs, 2));
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 3;
  return mesh;
}

function buildProjectionOverlays(
  positions: number[],
  dims: {
    topW: number;
    topH: number;
    bottomW: number;
    bottomH: number;
    topRing: THREE.Vector2[];
    projectionRect?: ProjectionRect;
  },
  cfg: Profile["common"] & RowConfig,
  config: SceneConfig,
  skinTexture: THREE.Texture,
) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    map: skinTexture,
    color: 0xffffff,
    transparent: true,
    opacity: config.projectionOpacity,
    depthTest: false,
    depthWrite: false,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const topData = { vertices: [] as number[], uvs: [] as number[] };
  const sideData = { vertices: [] as number[], uvs: [] as number[] };
  const cell = 1 / 3;
  const topMinU = cell;
  const topMinV = cell;
  const projectionUv = (x: number, y: number, z = 0) => {
    const rect = dims.projectionRect;
    if (!rect) return null;
    const cos = Math.cos(rect.rotation);
    const sin = Math.sin(rect.rotation);
    const worldX = cos * x - sin * y;
    const worldY = sin * x + cos * y;
    const layoutX = rect.centerX + worldX / U;
    const layoutY = rect.centerY - worldY / U;
    return new THREE.Vector2(
      THREE.MathUtils.clamp(layoutX / rect.frameW, 0, 1),
      THREE.MathUtils.clamp(1 - layoutY / rect.frameH, 0, 1),
    );
  };
  const topUv = (v: THREE.Vector3) => {
    const uv = projectionUv(v.x, v.y, v.z);
    const y = v.y - (cfg.topSkew ?? 0);
    if (uv) return uv;
    return new THREE.Vector2(topMinU + (v.x / dims.topW + 0.5) * cell, topMinV + (y / dims.topH + 0.5) * cell);
  };
  const transformedTopPoint = (x: number, y: number, lift = 0.04) => {
    const v = transformTopVertex(x, y, cfg);
    v.z -= dishOffset(x, y, dims.topW, dims.topH, cfg);
    v.z += lift;
    return v;
  };
  const topRing = dims.topRing;
  const ringCount = topRing.length;
  const topUvFromPoint = (p: THREE.Vector2) => {
    const v = transformedTopPoint(p.x, p.y, 0);
    const uv = projectionUv(v.x, v.y, v.z);
    if (uv) return uv;
    return new THREE.Vector2(topMinU + (p.x / dims.topW + 0.5) * cell, topMinV + (p.y / dims.topH + 0.5) * cell);
  };
  const bottomUvFromRingIndex = (ringIndex: number) => {
    const x = positions[ringIndex * 3];
    const y = positions[ringIndex * 3 + 1];
    const z = positions[ringIndex * 3 + 2];
    return projectionUv(x, y, z) ?? topUvFromPoint(topRing[ringIndex]);
  };
  const outwardFromPoint = (p: THREE.Vector2) => {
    const nx = THREE.MathUtils.clamp(p.x / (dims.topW * 0.5), -1, 1);
    const ny = THREE.MathUtils.clamp(p.y / (dims.topH * 0.5), -1, 1);
    const scale = Math.max(Math.abs(nx), Math.abs(ny), 0.0001);
    return new THREE.Vector2(nx / scale, ny / scale);
  };
  const sideLengths = Array.from({ length: ringCount }, (_, ringIndex) => {
    const bottomVertex = new THREE.Vector3(
      positions[ringIndex * 3],
      positions[ringIndex * 3 + 1],
      positions[ringIndex * 3 + 2],
    );
    const topIndex = ringCount + ringIndex;
    const topVertex = new THREE.Vector3(positions[topIndex * 3], positions[topIndex * 3 + 1], positions[topIndex * 3 + 2]);
    return bottomVertex.distanceTo(topVertex);
  });
  const maxSideLength = Math.max(...sideLengths, 0.001);
  const smoothstep = (value: number) => value * value * (3 - 2 * value);
  const sideUvAt = (ringIndex: number, heightT: number) => {
    const point = topRing[ringIndex];
    const normalizedX = THREE.MathUtils.clamp(point.x / (dims.topW * 0.5), -1, 1);
    const normalizedY = THREE.MathUtils.clamp(point.y / (dims.topH * 0.5), -1, 1);
    if (dims.projectionRect) {
      const anchor = topUvFromPoint(point);
      const topIndex = ringCount + ringIndex;
      const bottomVertex = new THREE.Vector3(positions[ringIndex * 3], positions[ringIndex * 3 + 1], positions[ringIndex * 3 + 2]);
      const topVertex = new THREE.Vector3(positions[topIndex * 3], positions[topIndex * 3 + 1], positions[topIndex * 3 + 2]);
      const vertex = bottomVertex.lerp(topVertex, heightT);
      return projectionUv(vertex.x, vertex.y, vertex.z) ?? anchor;
    }
    if (Math.abs(normalizedX) > Math.abs(normalizedY)) {
      const u = normalizedX > 0 ? cell * 2 + (1 - heightT) * cell : heightT * cell;
      return new THREE.Vector2(u, topMinV + (normalizedY * 0.5 + 0.5) * cell);
    }
    const v = normalizedY > 0 ? cell * 2 + (1 - heightT) * cell : heightT * cell;
    return new THREE.Vector2(topMinU + (normalizedX * 0.5 + 0.5) * cell, v);
  };
  const sideVertexAt = (ringIndex: number, heightT: number) => {
    const topIndex = ringCount + ringIndex;
    const bottomVertex = new THREE.Vector3(positions[ringIndex * 3], positions[ringIndex * 3 + 1], positions[ringIndex * 3 + 2]);
    const topVertex = new THREE.Vector3(positions[topIndex * 3], positions[topIndex * 3 + 1], positions[topIndex * 3 + 2]);
    const vertex = bottomVertex.lerp(topVertex, heightT);
    const outward = outwardFromPoint(topRing[ringIndex]).multiplyScalar(0.035);
    vertex.x += outward.x;
    vertex.y += outward.y;
    return vertex;
  };
  const topSteps = 12;
  const topCenter = transformedTopPoint(0, 0);
  const topCenterUv = topUv(topCenter);
  for (let i = 0; i < ringCount; i += 1) {
    const n = (i + 1) % ringCount;
    for (let step = 0; step < topSteps; step += 1) {
      const t0 = step / topSteps;
      const t1 = (step + 1) / topSteps;
      const innerA = topRing[i].clone().multiplyScalar(t0);
      const innerB = topRing[n].clone().multiplyScalar(t0);
      const outerA = topRing[i].clone().multiplyScalar(t1);
      const outerB = topRing[n].clone().multiplyScalar(t1);
      const a = t0 === 0 ? topCenter : transformedTopPoint(innerA.x, innerA.y);
      const b = t0 === 0 ? topCenter : transformedTopPoint(innerB.x, innerB.y);
      const c = transformedTopPoint(outerA.x, outerA.y);
      const d = transformedTopPoint(outerB.x, outerB.y);
      pushQuad(topData, a, b, c, d, t0 === 0 ? topCenterUv : topUv(a), t0 === 0 ? topCenterUv : topUv(b), topUv(c), topUv(d));
    }
  }
  const sideSteps = 16;
  for (let i = 0; i < ringCount; i += 1) {
    const n = (i + 1) % ringCount;
    for (let step = 0; step < sideSteps; step += 1) {
      const t0 = step / sideSteps;
      const t1 = (step + 1) / sideSteps;
      pushQuad(
        sideData,
        sideVertexAt(i, t0),
        sideVertexAt(n, t0),
        sideVertexAt(i, t1),
        sideVertexAt(n, t1),
        sideUvAt(i, t0),
        sideUvAt(n, t0),
        sideUvAt(i, t1),
        sideUvAt(n, t1),
      );
    }
  }
  [topData, sideData].forEach((data) => {
    const mesh = meshFromProjectionData(data, material);
    if (mesh) group.add(mesh);
  });
  return group;
}
