import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildReadout,
  profiles,
  type CaseMaterial,
  type KeyOverride,
  type KeycapMaterial,
  type SceneConfig,
} from "./keycap";
import { FileExporter, type ProjectionLayer } from "./FileExporter";
import { parseKLE, type ParsedKey } from "./utils/KLEParser";
import { KeycapScene } from "./ViewScene";

type KeyboardPreset = {
  id: string;
  name: string;
  layoutPath: string;
  defaultConfig?: {
    keycapType: string;
    caseColor: string;
    caseMaterial: CaseMaterial;
    caseModelPath?: string;
    keycapMaterial: KeycapMaterial;
    keycapColor?: string;
  };
  profileId?: string;
  caseColor?: string;
  caseMaterial?: CaseMaterial;
  keycapMaterial?: KeycapMaterial;
  description: string;
};

type SelectOption = {
  label: string;
  value: string;
};

type ThemeOption = {
  id: string;
  name: string;
  layoutPath: string;
  path: string;
  description?: string;
};

type NumberOption = {
  label: string;
  value: number;
};

type PanelConfig = {
  brand: {
    title: string;
    subtitle: string;
  };
  keyboardModels: KeyboardPreset[];
  layouts: SelectOption[];
  themes?: ThemeOption[];
  caseMaterials: Array<SelectOption & { value: CaseMaterial }>;
  keycapTypes: SelectOption[];
  keycapMaterials: Array<SelectOption & { value: KeycapMaterial }>;
  keycapColors: SelectOption[];
  legendFonts: SelectOption[];
  iconPresets: SelectOption[];
  iconPositions?: NumberOption[];
  defaults: Omit<SceneConfig, "skinImage" | "projectionCanvas" | "projectionVersion" | "layoutKeys" | "keyOverrides">;
};

type ResizeHandle = "nw" | "ne" | "se" | "sw";

type LayerInteraction =
  | { type: "move"; layerId: string; startX: number; startY: number; pointerX: number; pointerY: number }
  | { type: "rotate"; layerId: string; centerX: number; centerY: number; startRotation: number; pointerAngle: number }
  | {
      type: "resize";
      layerId: string;
      handle: ResizeHandle;
      fixedX: number;
      fixedY: number;
      startWidth: number;
      startHeight: number;
      rotation: number;
    };

const PANEL_CONFIG_STORAGE_KEY = "keyboard3d.panelConfig";

type ExportedProject = {
  mode?: "preset" | "custom";
  presetId?: string;
  layoutPath?: string;
  config?: Partial<SceneConfig>;
  projectionLayers?: Array<{
    id?: string;
    name?: string;
    file?: string;
    mime?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    rotation?: number;
    opacity?: number;
  }>;
};

type ThemeJson = {
  name?: string;
  source?: {
    layoutPath?: string;
  };
  defaults?: {
    keycap?: {
      color?: string;
      material?: KeycapMaterial;
    };
    legend?: {
      font?: string;
      color?: string;
      scale?: number;
    };
    case?: {
      color?: string;
      material?: CaseMaterial;
    };
  };
  keys?: Array<{
    index?: number;
    keycap?: {
      color?: string;
      material?: KeycapMaterial;
    };
    legend?: {
      labels?: string[];
      font?: string;
      color?: string;
      scale?: number;
    };
    icon?: {
      imageUrl?: string;
      position?: number;
      scale?: number;
    };
  }>;
};

const fallbackPresets: KeyboardPreset[] = [
  {
    id: "atelier-60",
    name: "Atelier 60",
    layoutPath: "/layouts/60_ansi_layout.json",
    defaultConfig: {
      keycapType: "cherry",
      caseColor: "#6f7780",
      caseMaterial: "aluminum",
      keycapMaterial: "pbt",
      keycapColor: "#ececec",
    },
    description: "60% aluminum daily board with Cherry profile caps.",
  },
  {
    id: "studio-iso",
    name: "Studio ISO",
    layoutPath: "/layouts/iso-60-layout.json",
    defaultConfig: {
      keycapType: "oem",
      caseColor: "#28313b",
      caseMaterial: "polycarbonate",
      keycapMaterial: "abs",
      keycapColor: "#ececec",
    },
    description: "ISO layout with a translucent case and taller sculpt.",
  },
  {
    id: "canvas-xda",
    name: "Canvas XDA",
    layoutPath: "/layouts/60_ansi_layout.json",
    defaultConfig: {
      keycapType: "xda",
      caseColor: "#d8d1c5",
      caseMaterial: "acrylic",
      keycapMaterial: "resin",
      keycapColor: "#ececec",
    },
    description: "Flat XDA profile for artwork-heavy projected designs.",
  },
];

const fallbackLegendFonts = [
  { label: "Segoe UI", value: '"Segoe UI"' },
  { label: "Arial", value: "Arial" },
  { label: "Arial Narrow", value: '"Arial Narrow"' },
  { label: "Verdana", value: "Verdana" },
  { label: "Tahoma", value: "Tahoma" },
  { label: "Consolas", value: "Consolas" },
  { label: "Times New Roman", value: '"Times New Roman"' },
  { label: "Microsoft YaHei", value: '"Microsoft YaHei"' },
  { label: "SimHei", value: "SimHei" },
];

const fallbackIconPresets = [
  { label: "None", value: "" },
  { label: "Arrow", value: "/icons/arrow-up.png" },
  { label: "Gear", value: "/icons/gear.png" },
  { label: "Check", value: "/icons/check.png" },
];

const iconPositionOptions = [
  { label: "Top left", value: 0 },
  { label: "Top", value: 1 },
  { label: "Top right", value: 2 },
  { label: "Left", value: 3 },
  { label: "Center", value: 4 },
  { label: "Right", value: 5 },
  { label: "Bottom left", value: 6 },
  { label: "Bottom", value: 7 },
  { label: "Bottom right", value: 8 },
];

const legendPositionOptions = [
  ...iconPositionOptions,
  { label: "Front left", value: 9 },
  { label: "Front", value: 10 },
  { label: "Front right", value: 11 },
];

const fallbackDefaults: SceneConfig = {
  profileId: "cherry",
  rowId: "R3",
  unitWidth: 1,
  unitHeight: 1,
  dishDepth: 0.65,
  projectionOpacity: 0.86,
  legendScale: 4,
  legendFont: '"Segoe UI"',
  legendColor: "#111111",
  frontLegendHeight: 0.76,
  sideSpread: 0.92,
  sideEase: 1.12,
  showWire: false,
  showGhost: false,
  showProjection: false,
  showCase: true,
  skinImage: null,
  projectionCanvas: null,
  projectionVersion: 0,
  layoutKeys: [],
  keyOverrides: {},
  selectedKeyIndex: -1,
  selectedKeyIndices: [],
  keycapMaterial: "pbt",
  keycapColor: "#ececec",
  caseConfig: { color: "#6f7780", material: "aluminum" },
  spotLightDistance: 200,
};

const fallbackPanelConfig: PanelConfig = {
  brand: {
    title: "Keyforge Studio",
    subtitle: "Commercial 3D keyboard customization pipeline",
  },
  keyboardModels: fallbackPresets,
  layouts: [
    { label: "60 ANSI", value: "/layouts/60_ansi_layout.json" },
    { label: "60 ISO", value: "/layouts/iso-60-layout.json" },
    { label: "ISO Compact", value: "/layouts/iso-60-layout.json" },
  ],
  themes: [
    {
      id: "ansi-night-market",
      name: "Night Market",
      layoutPath: "/layouts/60_ansi_layout.json",
      path: "/themes/ansi-night-market/theme.json",
      description: "Dark green ANSI set with warm legends.",
    },
    {
      id: "iso-signal",
      name: "Signal ISO",
      layoutPath: "/layouts/iso-60-layout.json",
      path: "/themes/iso-signal/theme.json",
      description: "ISO-only contrast theme with highlighted Enter.",
    },
  ],
  caseMaterials: [
    { label: "Aluminum", value: "aluminum" },
    { label: "Polycarbonate", value: "polycarbonate" },
    { label: "Wood", value: "wood" },
    { label: "Acrylic", value: "acrylic" },
  ],
  keycapTypes: [
    { label: "Cherry", value: "cherry" },
    { label: "OEM", value: "oem" },
    { label: "XDA", value: "xda" },
    { label: "DSA", value: "dsa" },
  ],
  keycapMaterials: [
    { label: "PBT", value: "pbt" },
    { label: "ABS", value: "abs" },
    { label: "Resin", value: "resin" },
    { label: "Metal", value: "metal" },
  ],
  keycapColors: [
    { label: "Warm white", value: "#ececec" },
    { label: "Charcoal", value: "#2f3438" },
    { label: "Red clay", value: "#d9614c" },
    { label: "Amber", value: "#e3b34f" },
    { label: "Mint", value: "#62c7b2" },
    { label: "Sky blue", value: "#8fc6ff" },
  ],
  legendFonts: fallbackLegendFonts,
  iconPresets: fallbackIconPresets,
  iconPositions: iconPositionOptions,
  defaults: {
    profileId: fallbackDefaults.profileId,
    rowId: fallbackDefaults.rowId,
    unitWidth: fallbackDefaults.unitWidth,
    unitHeight: fallbackDefaults.unitHeight,
    dishDepth: fallbackDefaults.dishDepth,
    projectionOpacity: fallbackDefaults.projectionOpacity,
    legendScale: fallbackDefaults.legendScale,
    legendFont: fallbackDefaults.legendFont,
    legendColor: fallbackDefaults.legendColor,
    frontLegendHeight: fallbackDefaults.frontLegendHeight,
    sideSpread: fallbackDefaults.sideSpread,
    sideEase: fallbackDefaults.sideEase,
    showWire: fallbackDefaults.showWire,
    showGhost: fallbackDefaults.showGhost,
    showProjection: fallbackDefaults.showProjection,
    showCase: fallbackDefaults.showCase,
    selectedKeyIndex: fallbackDefaults.selectedKeyIndex,
    selectedKeyIndices: fallbackDefaults.selectedKeyIndices,
    keycapMaterial: fallbackDefaults.keycapMaterial,
    keycapColor: fallbackDefaults.keycapColor,
    caseConfig: fallbackDefaults.caseConfig,
    spotLightDistance: fallbackDefaults.spotLightDistance,
  },
};

function sceneConfigFromPanel(panelConfig: PanelConfig): SceneConfig {
  return {
    ...panelConfig.defaults,
    skinImage: null,
    projectionCanvas: null,
    projectionVersion: 0,
    layoutKeys: [],
    keyOverrides: {},
    selectedKeyIndex: -1,
    selectedKeyIndices: [],
  };
}

function materialLabel(value: string) {
  return value[0].toUpperCase() + value.slice(1);
}

function keyboardModelDefaults(model: KeyboardPreset) {
  return {
    keycapType: model.defaultConfig?.keycapType ?? model.profileId ?? "cherry",
    caseColor: model.defaultConfig?.caseColor ?? model.caseColor ?? "#6f7780",
    caseMaterial: model.defaultConfig?.caseMaterial ?? model.caseMaterial ?? "aluminum",
    caseModelPath: model.defaultConfig?.caseModelPath,
    keycapMaterial: model.defaultConfig?.keycapMaterial ?? model.keycapMaterial ?? "pbt",
    keycapColor: model.defaultConfig?.keycapColor ?? "#ececec",
  };
}

function withKeyOverride(config: SceneConfig, index: number, patch: KeyOverride): SceneConfig {
  const current = config.keyOverrides[index] ?? {};
  return {
    ...config,
    keyOverrides: {
      ...config.keyOverrides,
      [index]: { ...current, ...patch },
    },
  };
}

function resolveKeyLabel(key: ParsedKey | undefined, override: KeyOverride | undefined) {
  const labels = override?.labels ?? key?.labels ?? [];
  return labels.find(Boolean) ?? key?.label ?? "Key";
}

function firstLegendSlot(labels: string[] | undefined) {
  const index = labels?.findIndex((label) => Boolean(label?.trim())) ?? -1;
  return index >= 0 ? index : 4;
}

function hasLegendText(labels: string[] | undefined, slot: number) {
  return Boolean(labels?.[slot]?.trim());
}

function normalizePath(path: string) {
  return path.replace(/^https?:\/\/[^/]+/i, "").replace(/\\/g, "/");
}

function sameLayoutPath(a: string, b: string) {
  return normalizePath(a) === normalizePath(b);
}

function applyTheme(config: SceneConfig, theme: ThemeJson): SceneConfig {
  const defaults = theme.defaults ?? {};
  const keyOverrides: Record<number, KeyOverride> = {};

  theme.keys?.forEach((keyTheme, fallbackIndex) => {
    const index = Number.isInteger(keyTheme.index) ? keyTheme.index! : fallbackIndex;
    if (index < 0 || index >= config.layoutKeys.length) return;

    const override: KeyOverride = {};
    if (keyTheme.keycap?.color) override.color = keyTheme.keycap.color;
    if (keyTheme.keycap?.material) override.material = keyTheme.keycap.material;
    if (keyTheme.legend?.labels) override.labels = keyTheme.legend.labels;
    if (keyTheme.legend?.font) override.legendFont = keyTheme.legend.font;
    if (keyTheme.legend?.color) override.legendColor = keyTheme.legend.color;
    if (typeof keyTheme.legend?.scale === "number") override.legendScale = keyTheme.legend.scale;
    if (keyTheme.icon?.imageUrl) override.iconImageUrl = keyTheme.icon.imageUrl;
    if (typeof keyTheme.icon?.position === "number") override.iconPosition = keyTheme.icon.position;
    if (typeof keyTheme.icon?.scale === "number") override.iconScale = keyTheme.icon.scale;

    if (Object.keys(override).length) keyOverrides[index] = override;
  });

  return {
    ...config,
    keycapColor: defaults.keycap?.color ?? config.keycapColor,
    keycapMaterial: defaults.keycap?.material ?? config.keycapMaterial,
    legendFont: defaults.legend?.font ?? config.legendFont,
    legendColor: defaults.legend?.color ?? config.legendColor,
    legendScale: defaults.legend?.scale ?? config.legendScale,
    caseConfig: {
      color: defaults.case?.color ?? config.caseConfig.color,
      material: defaults.case?.material ?? config.caseConfig.material,
    },
    keyOverrides,
  };
}

function localPanelConfig() {
  try {
    const stored = localStorage.getItem(PANEL_CONFIG_STORAGE_KEY);
    return stored ? (JSON.parse(stored) as PanelConfig) : null;
  } catch {
    return null;
  }
}

function readStoredZip(bytes: Uint8Array) {
  const entries = new Map<string, Uint8Array>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 0;

  while (offset + 30 <= bytes.length) {
    const signature = view.getUint32(offset, true);
    if (signature !== 0x04034b50) break;

    const method = view.getUint16(offset + 8, true);
    const compressedSize = view.getUint32(offset + 18, true);
    const fileNameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + fileNameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    if (dataEnd > bytes.length) throw new Error("ZIP file is truncated.");
    if (method !== 0) throw new Error("This importer currently supports stored ZIP entries only.");

    const path = new TextDecoder().decode(bytes.slice(nameStart, nameStart + fileNameLength)).replace(/\\/g, "/");
    entries.set(path, bytes.slice(dataStart, dataEnd));
    offset = dataEnd;
  }

  return entries;
}

function bytesToDataUrl(bytes: Uint8Array, mime: string) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return `data:${mime};base64,${btoa(binary)}`;
}

function imageFromDataUrl(dataUrl: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode an image from the ZIP."));
    image.src = dataUrl;
  });
}

function mimeFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<KeycapScene | null>(null);
  const projectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectionVersionRef = useRef(0);
  const projectionUpdateFrameRef = useRef(0);
  const pendingProjectionRef = useRef<{ canvas: HTMLCanvasElement; hasArtwork: boolean } | null>(null);
  const previousSelectedKeyRef = useRef(-1);
  const suppressNextLayoutLoadRef = useRef(false);
  const suppressNextPresetApplyRef = useRef(false);
  const initialConfig = sceneConfigFromPanel(fallbackPanelConfig);
  const latestConfigRef = useRef<SceneConfig>(initialConfig);
  const [panelConfig, setPanelConfig] = useState<PanelConfig>(fallbackPanelConfig);
  const [config, setConfig] = useState<SceneConfig>(initialConfig);
  const [presetId, setPresetId] = useState(fallbackPanelConfig.keyboardModels[0].id);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [layoutPath, setLayoutPath] = useState(fallbackPanelConfig.keyboardModels[0].layoutPath);
  const [themeId, setThemeId] = useState("");
  const [themeError, setThemeError] = useState("");
  const [layoutError, setLayoutError] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const [selectedLegendSlot, setSelectedLegendSlot] = useState(4);
  const [projectionLayers, setProjectionLayers] = useState<ProjectionLayer[]>([]);
  const [projectionApplyVersion, setProjectionApplyVersion] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRenderingImage, setIsRenderingImage] = useState(false);
  const [isRenderingGeminiVideo, setIsRenderingGeminiVideo] = useState(false);
  const [exportError, setExportError] = useState("");
  const [importError, setImportError] = useState("");
  const [renderError, setRenderError] = useState("");
  const activeProfile = profiles[config.profileId] ?? profiles.cherry;
  const selectedKey = selectedKeys[selectedKeys.length - 1] ?? -1;
  const isMultiSelecting = selectedKeys.length > 1;
  const hasSelectedKey = selectedKey >= 0;
  const selected = config.layoutKeys[selectedKey];
  const selectedOverride = config.keyOverrides[selectedKey] ?? {};
  const readout = buildReadout(config);
  const keyboardModels = panelConfig.keyboardModels;
  const legendFonts = panelConfig.legendFonts;
  const iconPresets = panelConfig.iconPresets;
  const iconPositions = panelConfig.iconPositions ?? iconPositionOptions;
  const activeThemes = useMemo(
    () => (panelConfig.themes ?? []).filter((theme) => sameLayoutPath(theme.layoutPath, layoutPath)),
    [panelConfig.themes, layoutPath],
  );
  const activeKeycapColor = panelConfig.keycapColors.find((color) => color.value.toLowerCase() === config.keycapColor.toLowerCase());

  useEffect(() => {
    let cancelled = false;
    const applyPanelConfig = (nextPanelConfig: PanelConfig) => {
      const nextSceneConfig = sceneConfigFromPanel(nextPanelConfig);
      setPanelConfig(nextPanelConfig);
      setConfig((current) => ({
        ...nextSceneConfig,
        layoutKeys: current.layoutKeys,
        projectionCanvas: projectionCanvasRef.current,
        projectionVersion: current.projectionVersion,
        showProjection: current.showProjection,
      }));
      latestConfigRef.current = {
        ...nextSceneConfig,
        layoutKeys: latestConfigRef.current.layoutKeys,
        projectionCanvas: projectionCanvasRef.current,
        projectionVersion: latestConfigRef.current.projectionVersion,
        showProjection: latestConfigRef.current.showProjection,
      };
      setPresetId(nextPanelConfig.keyboardModels[0]?.id ?? fallbackPanelConfig.keyboardModels[0].id);
      setLayoutPath(nextPanelConfig.keyboardModels[0]?.layoutPath ?? fallbackPanelConfig.keyboardModels[0].layoutPath);
      setThemeId("");
    };

    fetch("/config/panel.json")
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<PanelConfig>;
      })
      .then((fetchedPanelConfig) => {
        if (cancelled) return;
        applyPanelConfig(localPanelConfig() ?? fetchedPanelConfig);
      })
      .catch(() => {
        if (!cancelled) applyPanelConfig(localPanelConfig() ?? fallbackPanelConfig);
      });

    const onStorage = (event: StorageEvent) => {
      if (event.key !== PANEL_CONFIG_STORAGE_KEY) return;
      applyPanelConfig(localPanelConfig() ?? fallbackPanelConfig);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  useEffect(() => {
    latestConfigRef.current = { ...config, projectionCanvas: projectionCanvasRef.current };
  }, [config]);

  useEffect(() => {
    setConfig((current) =>
      current.selectedKeyIndex === selectedKey && current.selectedKeyIndices.join(",") === selectedKeys.join(",")
        ? current
        : { ...current, selectedKeyIndex: selectedKey, selectedKeyIndices: selectedKeys },
    );
  }, [selectedKey, selectedKeys]);

  useEffect(() => {
    if (previousSelectedKeyRef.current === selectedKey) return;
    previousSelectedKeyRef.current = selectedKey;
    if (!hasSelectedKey || isMultiSelecting) return;
    const labels = config.keyOverrides[selectedKey]?.labels ?? config.layoutKeys[selectedKey]?.labels;
    setSelectedLegendSlot(firstLegendSlot(labels));
  }, [config.keyOverrides, config.layoutKeys, hasSelectedKey, isMultiSelecting, selectedKey]);

  useEffect(() => {
    if (!canvasRef.current) return;
    const viewer = new KeycapScene(canvasRef.current);
    viewerRef.current = viewer;
    viewer.update({ ...config, projectionCanvas: projectionCanvasRef.current });
    return () => {
      if (projectionUpdateFrameRef.current) cancelAnimationFrame(projectionUpdateFrameRef.current);
      viewer.dispose();
    };
  }, []);

  useEffect(() => {
    viewerRef.current?.update({ ...config, projectionCanvas: projectionCanvasRef.current });
  }, [config]);

  useEffect(() => {
    if (suppressNextPresetApplyRef.current) {
      suppressNextPresetApplyRef.current = false;
      return;
    }
    const preset = panelConfig.keyboardModels.find((item) => item.id === presetId);
    if (!preset || mode !== "preset") return;
    const modelDefaults = keyboardModelDefaults(preset);
    setLayoutPath(preset.layoutPath);
    setConfig((current) => ({
      ...current,
      profileId: modelDefaults.keycapType,
      rowId: "R3",
      keycapMaterial: modelDefaults.keycapMaterial,
      keycapColor: modelDefaults.keycapColor,
      caseConfig: { color: modelDefaults.caseColor, material: modelDefaults.caseMaterial, modelPath: modelDefaults.caseModelPath },
      keyOverrides: {},
    }));
    setSelectedKeys([]);
    setThemeId("");
    setThemeError("");
  }, [presetId, mode, panelConfig.keyboardModels]);

  useEffect(() => {
    if (suppressNextLayoutLoadRef.current) {
      suppressNextLayoutLoadRef.current = false;
      return;
    }
    let cancelled = false;
    fetch(layoutPath)
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<unknown[]>;
      })
      .then((layout) => {
        if (cancelled) return;
        const parsed = parseKLE(layout);
        setLayoutError("");
        setConfig((current) => ({ ...current, layoutKeys: parsed.keys, keyOverrides: {} }));
        setSelectedKeys([]);
        setThemeId("");
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLayoutError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [layoutPath]);

  useEffect(() => {
    if (!themeId || activeThemes.some((theme) => theme.id === themeId)) return;
    setThemeId("");
    setThemeError("");
  }, [activeThemes, themeId]);

  function patch(next: Partial<SceneConfig>) {
    setConfig((current) => ({ ...current, ...next }));
  }

  async function onThemeChange(nextThemeId: string) {
    setThemeId(nextThemeId);
    setThemeError("");
    if (!nextThemeId) return;

    const theme = activeThemes.find((item) => item.id === nextThemeId);
    if (!theme) return;

    try {
      const response = await fetch(theme.path);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const themeJson = (await response.json()) as ThemeJson;
      const themeLayoutPath = themeJson.source?.layoutPath ?? theme.layoutPath;
      if (!sameLayoutPath(themeLayoutPath, layoutPath) || !sameLayoutPath(theme.layoutPath, layoutPath)) {
        throw new Error("Theme layout does not match the current keyboard layout.");
      }
      setConfig((current) => applyTheme(current, themeJson));
      setSelectedKeys([]);
    } catch (error) {
      setThemeId("");
      setThemeError(error instanceof Error ? error.message : String(error));
    }
  }

  function patchSelectedKey(next: KeyOverride) {
    if (!hasSelectedKey) return;
    setConfig((current) => withKeyOverride(current, selectedKey, next));
  }

  function patchSelectedKeys(next: KeyOverride) {
    if (!selectedKeys.length) return;
    setConfig((current) =>
      selectedKeys.reduce((acc, index) => withKeyOverride(acc, index, next), current),
    );
  }

  function resetSelectedKeyAppearance() {
    if (!selectedKeys.length) return;
    setConfig((current) => {
      const keyOverrides = { ...current.keyOverrides };
      selectedKeys.forEach((index) => {
        const currentOverride = current.keyOverrides[index] ?? {};
        const { color, material, ...rest } = currentOverride;
        if (Object.keys(rest).length) {
          keyOverrides[index] = rest;
        } else {
          delete keyOverrides[index];
        }
      });
      return { ...current, keyOverrides };
    });
  }

  function selectKey(index: number, multiSelect: boolean) {
    if (!multiSelect) {
      setSelectedKeys([index]);
      return;
    }
    setSelectedKeys((current) => {
      if (current.includes(index)) {
        return current.length > 1 ? current.filter((item) => item !== index) : current;
      }
      return [...current, index];
    });
  }

  function setSelectedLegend(value: string, slot = 4) {
    if (!hasSelectedKey) return;
    const labels = [...(selectedOverride.labels ?? selected?.labels ?? [])];
    while (labels.length <= slot) labels.push("");
    labels[slot] = value;
    patchSelectedKey({ labels });
  }

  const onProjectionCanvas = useCallback((canvas: HTMLCanvasElement, hasArtwork: boolean) => {
    if (projectionUpdateFrameRef.current) {
      cancelAnimationFrame(projectionUpdateFrameRef.current);
      projectionUpdateFrameRef.current = 0;
    }
    pendingProjectionRef.current = null;
    projectionVersionRef.current += 1;
    const projectionCanvas = hasArtwork ? canvas : null;
    projectionCanvasRef.current = projectionCanvas;
    const next = {
      ...latestConfigRef.current,
      projectionCanvas,
      projectionVersion: projectionVersionRef.current,
      showProjection: hasArtwork,
    };
    latestConfigRef.current = next;
    setConfig((current) => ({
      ...current,
      projectionCanvas,
      projectionVersion: projectionVersionRef.current,
      showProjection: hasArtwork,
    }));
    viewerRef.current?.update(next);
  }, []);

  function onPngChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    files.forEach((file, index) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        const image = new Image();
        image.addEventListener("load", () => {
          setProjectionLayers((current) => [
            ...current,
            {
              id: `${file.name}-${Date.now()}-${index}`,
              name: file.name,
              image,
              sourceDataUrl: String(reader.result),
              sourceMime: file.type || "image/png",
              x: 80 + index * 32,
              y: 60 + index * 24,
              width: Math.min(320, image.width),
              height: Math.min(180, image.height),
              rotation: 0,
              opacity: 0.9,
            },
          ]);
        });
        image.src = String(reader.result);
      });
      reader.readAsDataURL(file);
    });
    event.target.value = "";
  }

  function onApplyProjection() {
    setProjectionApplyVersion((current) => current + 1);
  }

  async function onProjectZipChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || isImporting) return;

    setIsImporting(true);
    setImportError("");
    try {
      const entries = readStoredZip(new Uint8Array(await file.arrayBuffer()));
      const projectBytes = entries.get("project.json");
      if (!projectBytes) throw new Error("project.json was not found in this ZIP.");
      const project = JSON.parse(new TextDecoder().decode(projectBytes)) as ExportedProject;
      if (!project.config) throw new Error("project.json does not contain a config object.");

      const nextLayers = await Promise.all(
        (project.projectionLayers ?? []).map(async (layer, index) => {
          if (!layer.file) throw new Error(`Projection layer ${index + 1} is missing its file path.`);
          const imageBytes = entries.get(layer.file);
          if (!imageBytes) throw new Error(`Missing projection layer image: ${layer.file}`);
          const sourceMime = layer.mime || mimeFromPath(layer.file);
          const sourceDataUrl = bytesToDataUrl(imageBytes, sourceMime);
          const image = await imageFromDataUrl(sourceDataUrl);
          return {
            id: layer.id || `${layer.name || "layer"}-${Date.now()}-${index}`,
            name: layer.name || layer.file.split("/").pop() || `Layer ${index + 1}`,
            image,
            sourceDataUrl,
            sourceMime,
            x: layer.x ?? 80,
            y: layer.y ?? 60,
            width: layer.width ?? image.naturalWidth,
            height: layer.height ?? image.naturalHeight,
            rotation: layer.rotation ?? 0,
            opacity: layer.opacity ?? 0.9,
          } satisfies ProjectionLayer;
        }),
      );

      const importedLayoutPath = project.layoutPath || layoutPath;
      const nextConfig: SceneConfig = {
        ...sceneConfigFromPanel(panelConfig),
        ...project.config,
        skinImage: null,
        projectionCanvas: null,
        projectionVersion: projectionVersionRef.current,
        selectedKeyIndex: -1,
        selectedKeyIndices: [],
      } as SceneConfig;

      suppressNextLayoutLoadRef.current = importedLayoutPath !== layoutPath;
      suppressNextPresetApplyRef.current = project.mode === "preset";
      setMode(project.mode ?? "custom");
      setPresetId(project.presetId ?? "");
      setLayoutPath(importedLayoutPath);
      setConfig(nextConfig);
      latestConfigRef.current = { ...nextConfig, projectionCanvas: projectionCanvasRef.current };
      setProjectionLayers(nextLayers);
      setSelectedKeys([]);
      setThemeId("");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setImportError(message || "Import failed.");
      console.error("Import failed", error);
    } finally {
      setIsImporting(false);
    }
  }

  async function onExportProject() {
    if (isExporting) return;
    setIsExporting(true);
    setExportError("");
    try {
      const blob = await FileExporter.exportProjectZip({
        mode,
        presetId,
        layoutPath,
        config,
        layers: projectionLayers,
        projectionCanvas: projectionCanvasRef.current,
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `keyboard3d-export-${FileExporter.timestampForFile()}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setExportError(message || "Export failed.");
      console.error("Export failed", error);
    } finally {
      setIsExporting(false);
    }
  }

  async function onRenderImage() {
    if (isRenderingImage || !viewerRef.current) return;
    setIsRenderingImage(true);
    setRenderError("");
    try {
      const blob = await viewerRef.current.renderAdImage();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `keyboard-ad-render-${FileExporter.timestampForFile()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRenderError(message || "Render failed.");
      console.error("Render failed", error);
    } finally {
      setIsRenderingImage(false);
    }
  }

  async function onRenderGeminiVideo() {
    if (isRenderingGeminiVideo || !viewerRef.current) return;
    setIsRenderingGeminiVideo(true);
    setRenderError("");
    try {
      const imageBlob = await viewerRef.current.renderAdImage();
      const imageBase64 = await blobToBase64(imageBlob);
      const response = await fetch("/api/gemini-ad-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64,
          mimeType: imageBlob.type || "image/png",
        }),
      });
      if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error || `${response.status} ${response.statusText}`);
      }

      const videoBlob = await response.blob();
      const url = URL.createObjectURL(videoBlob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `keyboard-gemini-ad-${FileExporter.timestampForFile()}.mp4`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setRenderError(message || "Gemini video render failed.");
      console.error("Gemini video render failed", error);
    } finally {
      setIsRenderingGeminiVideo(false);
    }
  }

  function onIconPngChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      patchSelectedKey({ iconImageUrl: String(reader.result), iconPosition: selectedOverride.iconPosition ?? 4, iconScale: selectedOverride.iconScale ?? 1 });
    });
    reader.readAsDataURL(file);
    event.target.value = "";
  }

  const selectedLabel = resolveKeyLabel(selected, selectedOverride);
  const selectedLabels = selectedOverride.labels ?? selected?.labels ?? [];
  const selectedLegendText = hasSelectedKey && !isMultiSelecting ? selectedLabels[selectedLegendSlot] ?? "" : "";
  const filledLegendPositions = legendPositionOptions
    .filter((position) => hasLegendText(selectedLabels, position.value))
    .map((position) => position.label);
  const inspectorSummary = !selectedKeys.length
    ? "No key selected"
    : isMultiSelecting
      ? `${selectedKeys.length} keys selected`
      : `#${selectedKey + 1} ${selectedLabel}`;
  const modeCopy = useMemo(
    () => keyboardModels.find((item) => item.id === presetId)?.description ?? "",
    [presetId, keyboardModels],
  );

  return (
    <main className="customizer-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="mark" />
          <div>
            <h1>{panelConfig.brand.title}</h1>
            <p>{panelConfig.brand.subtitle}</p>
          </div>
        </div>

        <section className="control-group">
          <label className="file-button">
            {isImporting ? "Loading..." : "Load ZIP"}
            <input type="file" accept=".zip,application/zip" disabled={isImporting} onChange={onProjectZipChange} />
          </label>
          {importError ? <p className="hint error">Load failed: {importError}</p> : null}
        </section>

        <section className="control-group">
          <label htmlFor="mode">Design mode</label>
          <select id="mode" value={mode} onChange={(event) => setMode(event.target.value as "preset" | "custom")}>
            <option value="preset">Built keyboard model</option>
            <option value="custom">Custom keyboard</option>
          </select>
        </section>

        {mode === "preset" ? (
          <section className="control-group">
            <label htmlFor="preset">Keyboard model</label>
            <select id="preset" value={presetId} onChange={(event) => setPresetId(event.target.value)}>
              {keyboardModels.map((preset) => (
                <option value={preset.id} key={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
            <p className="hint">{modeCopy}</p>
          </section>
        ) : (
          <section className="control-group">
            <label htmlFor="customLayout">Keyboard layout</label>
            <select id="customLayout" value={layoutPath} onChange={(event) => setLayoutPath(event.target.value)}>
              {panelConfig.layouts.map((layout) => (
                <option value={layout.value} key={layout.value}>
                  {layout.label}
                </option>
              ))}
            </select>
          </section>
        )}

        <section className="control-group">
          <label htmlFor="presetTheme">预设主题</label>
          <select id="presetTheme" value={themeId} onChange={(event) => void onThemeChange(event.target.value)}>
            <option value="">No theme</option>
            {activeThemes.map((theme) => (
              <option value={theme.id} key={theme.id}>
                {theme.name}
              </option>
            ))}
          </select>
          {themeError ? (
            <p className="hint error">{themeError}</p>
          ) : (
            <p className="hint">{activeThemes.find((theme) => theme.id === themeId)?.description ?? `${activeThemes.length} layout theme(s)`}</p>
          )}
        </section>

        <section className="control-grid">
          <label>
            Case material
            <select
              value={config.caseConfig.material}
              onChange={(event) => patch({ caseConfig: { ...config.caseConfig, material: event.target.value as CaseMaterial } })}
            >
              {panelConfig.caseMaterials.map((material) => (
                <option value={material.value} key={material.value}>
                  {material.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Case color
            <input
              type="color"
              value={config.caseConfig.color}
              onChange={(event) => patch({ caseConfig: { ...config.caseConfig, color: event.target.value } })}
            />
          </label>
        </section>

        <section className="control-grid">
          <label>
            Keycap type
            <select value={config.profileId} onChange={(event) => patch({ profileId: event.target.value, rowId: "R3" })}>
              {panelConfig.keycapTypes.map((keycapType) => (
                <option value={keycapType.value} key={keycapType.value}>
                  {keycapType.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Keycap material
            <select value={config.keycapMaterial} onChange={(event) => patch({ keycapMaterial: event.target.value as KeycapMaterial })}>
              {panelConfig.keycapMaterials.map((material) => (
                <option value={material.value} key={material.value}>
                  {material.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Keycap color
            <select value={config.keycapColor} onChange={(event) => patch({ keycapColor: event.target.value })}>
              {panelConfig.keycapColors.map((color) => (
                <option value={color.value} key={color.value}>
                  {color.label}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section className="control-group">
          <label htmlFor="legendScale">Legend size {config.legendScale.toFixed(1)}x</label>
          <input
            id="legendScale"
            type="range"
            min="4"
            max="10"
            step="0.1"
            value={config.legendScale}
            onChange={(event) => patch({ legendScale: Number(event.target.value) })}
          />
        </section>

        <section className="control-group">
          <label htmlFor="frontLegendHeight">Side legend height {Math.round(config.frontLegendHeight * 100)}%</label>
          <input
            id="frontLegendHeight"
            type="range"
            min="0.45"
            max="0.95"
            step="0.01"
            value={config.frontLegendHeight}
            onChange={(event) => patch({ frontLegendHeight: Number(event.target.value) })}
          />
        </section>

        <section className="control-grid">
          <label>
            Legend font
            <select value={config.legendFont} onChange={(event) => patch({ legendFont: event.target.value })}>
              {legendFonts.map((font) => (
                <option value={font.value} key={font.value}>
                  {font.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Legend color
            <input type="color" value={config.legendColor} onChange={(event) => patch({ legendColor: event.target.value })} />
          </label>
        </section>

        <section className="toggles">
          <label>
            <input type="checkbox" checked={config.showProjection} onChange={(event) => patch({ showProjection: event.target.checked })} />
            PNG projection
          </label>
          <label>
            <input type="checkbox" checked={config.showCase} onChange={(event) => patch({ showCase: event.target.checked })} />
            Case
          </label>
          <label>
            <input type="checkbox" checked={config.showWire} onChange={(event) => patch({ showWire: event.target.checked })} />
            Mesh lines
          </label>
          <label>
            <input type="checkbox" checked={config.showGhost} onChange={(event) => patch({ showGhost: event.target.checked })} />
            Size guides
          </label>
        </section>

        {layoutError ? <p className="hint error">{layoutError}</p> : <p className="hint">{config.layoutKeys.length} keys loaded</p>}
      </aside>

      <section className="workbench">
        <section className="preview-area">
          <div className="toolbar">
            <div>
              <strong>{mode === "preset" ? keyboardModels.find((preset) => preset.id === presetId)?.name : "Custom Keyboard"}</strong>
              <span>
                {activeProfile.label} caps, {materialLabel(config.caseConfig.material)} case, {activeKeycapColor?.label ?? config.keycapColor}{" "}
                {materialLabel(config.keycapMaterial)} keycaps
              </span>
            </div>
            <div className="toolbar-actions">
              <button className="toolbar-button render-button" type="button" disabled={isRenderingImage || isRenderingGeminiVideo} onClick={() => void onRenderImage()}>
                {isRenderingImage ? "渲染中" : "渲染高清图"}
              </button>
              <button
                className="toolbar-button render-button"
                type="button"
                disabled={isRenderingImage || isRenderingGeminiVideo}
                onClick={() => void onRenderGeminiVideo()}
              >
                {isRenderingGeminiVideo ? "生成视频中" : "生成广告视频"}
              </button>
              <button className="toolbar-button" id="resetView" title="Reset view" aria-label="Reset view" onClick={() => viewerRef.current?.resetCamera()}>
                鈫?
              </button>
            </div>
          </div>
          {renderError ? <p className="render-error">Render failed: {renderError}</p> : null}
          <canvas ref={canvasRef} />
        </section>

        <section className="design-area">
          <div className="canvas-panel">
            <div className="section-heading">
              <div>
                <h2>Projection Canvas</h2>
                <p>Place PNG artwork over the keyboard map. The same canvas is projected onto keycaps in 3D.</p>
              </div>
              <div className="section-actions">
                <label className="file-button">
                  Add PNG
                  <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onPngChange} />
                </label>
                <button className="secondary-button" type="button" onClick={onApplyProjection}>
                  Apply
                </button>
                <button className="secondary-button" type="button" disabled={isExporting} onClick={onExportProject}>
                  {isExporting ? "Exporting..." : "Export"}
                </button>
              </div>
            </div>
            {exportError ? <p className="error">Export failed: {exportError}</p> : null}
            <ProjectionDesigner
              keys={config.layoutKeys}
              layers={projectionLayers}
              selectedKeys={selectedKeys}
              applyVersion={projectionApplyVersion}
              onSelectKey={selectKey}
              onClearSelection={() => setSelectedKeys([])}
              onLayersChange={setProjectionLayers}
              onProjectionCanvas={onProjectionCanvas}
            />
          </div>

          <aside className="inspector">
            <div className="section-heading">
              <div>
                <h2>Key Inspector</h2>
                <p>
                  {inspectorSummary}
                </p>
              </div>
            </div>

            <section className="control-grid">
              <label>
                Key cap color
                <select
                  value={selectedOverride.color ?? ""}
                  disabled={!selectedKeys.length}
                  onChange={(event) => patchSelectedKeys({ color: event.target.value || undefined })}
                >
                  <option value="">Keyboard default ({activeKeycapColor?.label ?? config.keycapColor})</option>
                  {panelConfig.keycapColors.map((color) => (
                    <option value={color.value} key={color.value}>
                      {color.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Key material
                <select
                  value={selectedOverride.material ?? ""}
                  disabled={!selectedKeys.length}
                  onChange={(event) => patchSelectedKeys({ material: event.target.value ? (event.target.value as KeycapMaterial) : undefined })}
                >
                  <option value="">Keyboard default ({materialLabel(config.keycapMaterial)})</option>
                  {panelConfig.keycapMaterials.map((material) => (
                    <option value={material.value} key={material.value}>
                      {material.label}
                    </option>
                  ))}
                </select>
              </label>
            </section>

            <section className="control-group">
              <button type="button" disabled={!selectedKeys.length} onClick={resetSelectedKeyAppearance}>
                Reset key appearance
              </button>
            </section>

            <section className="control-group">
              <label htmlFor="legendSlot">Legend position</label>
              <select
                id="legendSlot"
                value={selectedLegendSlot}
                disabled={!hasSelectedKey || isMultiSelecting}
                onChange={(event) => setSelectedLegendSlot(Number(event.target.value))}
              >
                {legendPositionOptions.map((position) => (
                  <option
                    className={hasLegendText(selectedLabels, position.value) ? "filled-option" : undefined}
                    value={position.value}
                    key={position.value}
                  >
                    {hasLegendText(selectedLabels, position.value) ? "● " : ""}{position.label}
                  </option>
                ))}
              </select>
              {hasSelectedKey && !isMultiSelecting && filledLegendPositions.length ? (
                <p className="hint legend-filled-hint">Filled: {filledLegendPositions.join(", ")}</p>
              ) : null}
            </section>

            <section className="control-group">
              <label htmlFor="keyLegend">Legend text</label>
              <input
                id="keyLegend"
                value={selectedLegendText}
                disabled={!hasSelectedKey || isMultiSelecting}
                onChange={(event) => setSelectedLegend(event.target.value, selectedLegendSlot)}
              />
            </section>

            <section className="control-grid">
              <label>
                Key font
                <select disabled={!selectedKeys.length} value={selectedOverride.legendFont ?? config.legendFont} onChange={(event) => patchSelectedKeys({ legendFont: event.target.value })}>
                  {legendFonts.map((font) => (
                    <option value={font.value} key={font.value}>
                      {font.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Key legend color
                <input
                  type="color"
                  value={selectedOverride.legendColor ?? config.legendColor}
                  disabled={!selectedKeys.length}
                  onChange={(event) => patchSelectedKeys({ legendColor: event.target.value })}
                />
              </label>
            </section>

            <section className="control-group">
              <label htmlFor="iconSelect">Add icon</label>
              <select
                id="iconSelect"
                value={selectedOverride.iconImageUrl ?? ""}
                disabled={!hasSelectedKey || isMultiSelecting}
                onChange={(event) =>
                  patchSelectedKey({ iconImageUrl: event.target.value, iconPosition: selectedOverride.iconPosition ?? 4, iconScale: selectedOverride.iconScale ?? 1 })
                }
              >
                {iconPresets.map((icon) => (
                  <option value={icon.value} key={icon.label}>
                    {icon.label}
                  </option>
                ))}
              </select>
              <label className="file-button">
                Upload PNG icon
                <input type="file" accept="image/png" disabled={!hasSelectedKey || isMultiSelecting} onChange={onIconPngChange} />
              </label>
            </section>

            <section className="control-group">
              <label htmlFor="iconPosition">Icon position</label>
              <select
                id="iconPosition"
                value={selectedOverride.iconPosition ?? 4}
                disabled={!hasSelectedKey || isMultiSelecting}
                onChange={(event) => patchSelectedKey({ iconPosition: Number(event.target.value) })}
              >
                {iconPositions.map((position) => (
                  <option value={position.value} key={position.value}>
                    {position.label}
                  </option>
                ))}
              </select>
            </section>

            <section className="control-group">
              <label htmlFor="iconScale">Icon size {(selectedOverride.iconScale ?? 1).toFixed(1)}x</label>
              <input
                id="iconScale"
                type="range"
                min="0.4"
                max="1.8"
                step="0.1"
                value={selectedOverride.iconScale ?? 1}
                disabled={!hasSelectedKey || isMultiSelecting}
                onChange={(event) => patchSelectedKey({ iconScale: Number(event.target.value) })}
              />
            </section>

            <section className="control-group">
              <label htmlFor="keyLegendScale">Key legend size {(selectedOverride.legendScale ?? config.legendScale).toFixed(1)}x</label>
              <input
                id="keyLegendScale"
                type="range"
                min="4"
                max="10"
                step="0.1"
                value={selectedOverride.legendScale ?? config.legendScale}
                disabled={!selectedKeys.length}
                onChange={(event) => patchSelectedKeys({ legendScale: Number(event.target.value) })}
              />
            </section>

            <section className="readout compact">
              <h2>Manufacturing Data</h2>
              <pre>{readout}</pre>
            </section>
          </aside>
        </section>
      </section>
    </main>
  );
}

function ProjectionDesigner({
  keys,
  layers,
  selectedKeys,
  applyVersion,
  onSelectKey,
  onClearSelection,
  onLayersChange,
  onProjectionCanvas,
}: {
  keys: ParsedKey[];
  layers: ProjectionLayer[];
  selectedKeys: number[];
  applyVersion: number;
  onSelectKey: (index: number, multiSelect: boolean) => void;
  onClearSelection: () => void;
  onLayersChange: (layers: ProjectionLayer[]) => void;
  onProjectionCanvas: (canvas: HTMLCanvasElement, hasArtwork: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectionRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const dragRef = useRef<LayerInteraction | null>(null);
  const layersRef = useRef(layers);
  const lastApplyVersionRef = useRef(applyVersion);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  const frame = useMemo(() => {
    if (!keys.length) return { minX: 0, minY: 0, maxX: 15, maxY: 5 };
    const minX = Math.min(...keys.map((key) => key.x));
    const minY = Math.min(...keys.map((key) => key.y));
    const maxX = Math.max(...keys.map((key) => key.x + key.w));
    const maxY = Math.max(...keys.map((key) => key.y + key.h));
    return { minX, minY, maxX, maxY };
  }, [keys]);

  const renderProjectionCanvas = useCallback((layersToRender: ProjectionLayer[], options?: { publish?: boolean }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const publish = options?.publish ?? true;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#11171b";
    ctx.fillRect(0, 0, width, height);

    const padding = 34 * dpr;
    const layoutW = Math.max(1, frame.maxX - frame.minX);
    const layoutH = Math.max(1, frame.maxY - frame.minY);
    const scale = Math.min((width - padding * 2) / layoutW, (height - padding * 2) / layoutH);
    const originX = (width - layoutW * scale) / 2;
    const originY = (height - layoutH * scale) / 2;

    const projectionScale = 128;
    const projection = projectionRef.current ?? document.createElement("canvas");
    projectionRef.current = projection;
    const projectionCtx = publish ? projection.getContext("2d") : null;
    if (publish) {
      projection.width = Math.max(1, Math.ceil(layoutW * projectionScale));
      projection.height = Math.max(1, Math.ceil(layoutH * projectionScale));
      projectionCtx?.clearRect(0, 0, projection.width, projection.height);
    }

    const drawLayer = (targetCtx: CanvasRenderingContext2D, layer: ProjectionLayer, x: number, y: number, width: number, height: number) => {
      targetCtx.globalAlpha = layer.opacity;
      targetCtx.save();
      targetCtx.translate(x + width / 2, y + height / 2);
      targetCtx.rotate(layer.rotation);
      targetCtx.drawImage(layer.image, -width / 2, -height / 2, width, height);
      targetCtx.restore();
    };

    layersToRender.forEach((layer) => {
      ctx.globalAlpha = layer.opacity;
      drawLayer(ctx, layer, layer.x * dpr, layer.y * dpr, layer.width * dpr, layer.height * dpr);
      if (projectionCtx) {
        const layoutLayerX = (layer.x * dpr - originX) / scale;
        const layoutLayerY = (layer.y * dpr - originY) / scale;
        const layoutLayerW = (layer.width * dpr) / scale;
        const layoutLayerH = (layer.height * dpr) / scale;
        drawLayer(
          projectionCtx,
          layer,
          layoutLayerX * projectionScale,
          layoutLayerY * projectionScale,
          layoutLayerW * projectionScale,
          layoutLayerH * projectionScale,
        );
      }
    });
    ctx.globalAlpha = 1;
    if (projectionCtx) projectionCtx.globalAlpha = 1;

    keys.forEach((key, index) => {
      const x = originX + (key.x - frame.minX) * scale;
      const y = originY + (key.y - frame.minY) * scale;
      const w = key.w * scale;
      const h = key.h * scale;
      const isSelected = selectedKeys.includes(index);
      ctx.fillStyle = isSelected ? "rgba(227,179,79,0.34)" : "rgba(255,255,255,0.08)";
      ctx.strokeStyle = isSelected ? "#e3b34f" : "rgba(255,255,255,0.24)";
      ctx.lineWidth = isSelected ? 2.5 * dpr : 1 * dpr;
      roundRect(ctx, x, y, w, h, 5 * dpr);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "rgba(238,243,244,0.78)";
      ctx.font = `${11 * dpr}px Segoe UI, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(key.label || String(index + 1), x + w / 2, y + h / 2);
    });

    const selectedLayer = layersToRender.find((layer) => layer.id === selectedLayerId);
    if (selectedLayer) drawLayerHandles(ctx, selectedLayer, dpr);

    if (publish) {
      onProjectionCanvas(projection, layersToRender.length > 0);
    }
  }, [keys, selectedKeys, selectedLayerId, frame, onProjectionCanvas]);

  useEffect(() => {
    renderProjectionCanvas(layers, { publish: false });
  }, [layers, selectedLayerId, renderProjectionCanvas]);

  useEffect(() => {
    if (lastApplyVersionRef.current === applyVersion) return;
    lastApplyVersionRef.current = applyVersion;
    renderProjectionCanvas(layersRef.current, { publish: true });
  }, [applyVersion, renderProjectionCanvas]);

  function canvasPoint(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function pickKey(point: { x: number; y: number }) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const layoutW = Math.max(1, frame.maxX - frame.minX);
    const layoutH = Math.max(1, frame.maxY - frame.minY);
    const padding = 34;
    const scale = Math.min((rect.width - padding * 2) / layoutW, (rect.height - padding * 2) / layoutH);
    const originX = (rect.width - layoutW * scale) / 2;
    const originY = (rect.height - layoutH * scale) / 2;
    return keys.findIndex((key) => {
      const x = originX + (key.x - frame.minX) * scale;
      const y = originY + (key.y - frame.minY) * scale;
      return point.x >= x && point.x <= x + key.w * scale && point.y >= y && point.y <= y + key.h * scale;
    });
  }

  function localLayerPoint(layer: ProjectionLayer, point: { x: number; y: number }) {
    const center = layerCenter(layer);
    const local = rotatePoint({ x: point.x - center.x, y: point.y - center.y }, -layer.rotation);
    return { x: local.x + layer.width / 2, y: local.y + layer.height / 2 };
  }

  function hitLayer(layer: ProjectionLayer, point: { x: number; y: number }) {
    const local = localLayerPoint(layer, point);
    return local.x >= 0 && local.x <= layer.width && local.y >= 0 && local.y <= layer.height;
  }

  function commitLayers(nextLayers: ProjectionLayer[]) {
    layersRef.current = nextLayers;
    onLayersChange(nextLayers);
    renderProjectionCanvas(nextLayers, { publish: false });
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    const selectedLayer = layersRef.current.find((item) => item.id === selectedLayerId);
    if (selectedLayer) {
      const handle = hitLayerHandle(selectedLayer, point);
      if (handle === "delete") {
        const nextLayers = layersRef.current.filter((item) => item.id !== selectedLayer.id);
        setSelectedLayerId(null);
        commitLayers(nextLayers);
        return;
      }
      if (handle === "rotate") {
        const center = layerCenter(selectedLayer);
        dragRef.current = {
          type: "rotate",
          layerId: selectedLayer.id,
          centerX: center.x,
          centerY: center.y,
          startRotation: selectedLayer.rotation,
          pointerAngle: angleFrom(center.x, center.y, point),
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
      if (handle) {
        const fixed = resizeFixedPoint(selectedLayer, handle);
        dragRef.current = {
          type: "resize",
          layerId: selectedLayer.id,
          handle,
          fixedX: fixed.x,
          fixedY: fixed.y,
          startWidth: selectedLayer.width,
          startHeight: selectedLayer.height,
          rotation: selectedLayer.rotation,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        return;
      }
    }

    const layer = [...layers]
      .reverse()
      .find((item) => hitLayer(item, point));
    if (layer) {
      setSelectedLayerId(layer.id);
      dragRef.current = { type: "move", layerId: layer.id, startX: layer.x, startY: layer.y, pointerX: point.x, pointerY: point.y };
      event.currentTarget.setPointerCapture(event.pointerId);
      return;
    }
    setSelectedLayerId(null);
    const keyIndex = pickKey(point);
    if (keyIndex >= 0) onSelectKey(keyIndex, event.ctrlKey);
    else onClearSelection();
  }

  function onPointerMove(event: PointerEvent<HTMLCanvasElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    const point = canvasPoint(event);
    const nextLayers = layersRef.current.map((layer) => {
      if (layer.id !== drag.layerId) return layer;
      if (drag.type === "move") return { ...layer, x: drag.startX + point.x - drag.pointerX, y: drag.startY + point.y - drag.pointerY };
      if (drag.type === "rotate") return { ...layer, rotation: drag.startRotation + angleFrom(drag.centerX, drag.centerY, point) - drag.pointerAngle };
      return resizeLayer(layer, drag, point);
    });
    layersRef.current = nextLayers;
    renderProjectionCanvas(nextLayers, { publish: false });
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    const nextLayers = layersRef.current;
    onLayersChange(nextLayers);
    renderProjectionCanvas(nextLayers, { publish: false });
    dragRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <canvas
      className="projection-canvas"
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    />
  );
}

const HANDLE_SIZE = 14;
const DELETE_HANDLE_SIZE = 18;
const ROTATE_HANDLE_SIZE = 16;
const ROTATE_HANDLE_OFFSET = 34;
const MIN_LAYER_SIZE = 24;

function layerHandles(layer: ProjectionLayer) {
  const corners = layerCorners(layer);
  const topCenter = rotatedLayerPoint(layer, layer.width / 2, 0);
  return {
    nw: centeredRect(corners.nw, HANDLE_SIZE),
    ne: centeredRect(corners.ne, HANDLE_SIZE),
    se: centeredRect(corners.se, HANDLE_SIZE),
    sw: centeredRect(corners.sw, HANDLE_SIZE),
    rotate: centeredRect(rotatedLayerPoint(layer, layer.width / 2, -ROTATE_HANDLE_OFFSET), ROTATE_HANDLE_SIZE),
    delete: centeredRect({ x: topCenter.x + Math.cos(layer.rotation) * (layer.width / 2 + 18), y: topCenter.y + Math.sin(layer.rotation) * (layer.width / 2 + 18) }, DELETE_HANDLE_SIZE),
  };
}

function centeredRect(point: { x: number; y: number }, size: number) {
  return { x: point.x - size / 2, y: point.y - size / 2, width: size, height: size };
}

function hitRect(rect: { x: number; y: number; width: number; height: number }, point: { x: number; y: number }) {
  return point.x >= rect.x && point.x <= rect.x + rect.width && point.y >= rect.y && point.y <= rect.y + rect.height;
}

function hitLayerHandle(layer: ProjectionLayer, point: { x: number; y: number }): ResizeHandle | "delete" | "rotate" | null {
  const handles = layerHandles(layer);
  if (hitRect(handles.delete, point)) return "delete";
  if (hitRect(handles.rotate, point)) return "rotate";
  if (hitRect(handles.nw, point)) return "nw";
  if (hitRect(handles.ne, point)) return "ne";
  if (hitRect(handles.se, point)) return "se";
  if (hitRect(handles.sw, point)) return "sw";
  return null;
}

function resizeFixedPoint(layer: ProjectionLayer, handle: ResizeHandle) {
  const corners = layerCorners(layer);
  if (handle === "nw") return corners.se;
  if (handle === "ne") return corners.sw;
  if (handle === "se") return corners.nw;
  return corners.ne;
}

function resizeLayer(layer: ProjectionLayer, interaction: Extract<LayerInteraction, { type: "resize" }>, point: { x: number; y: number }): ProjectionLayer {
  const pointer = rotatePoint({ x: point.x - interaction.fixedX, y: point.y - interaction.fixedY }, -interaction.rotation);
  const rawWidth = interaction.handle === "nw" || interaction.handle === "sw" ? -pointer.x : pointer.x;
  const rawHeight = interaction.handle === "nw" || interaction.handle === "ne" ? -pointer.y : pointer.y;
  const scale = Math.max(MIN_LAYER_SIZE / interaction.startWidth, MIN_LAYER_SIZE / interaction.startHeight, rawWidth / interaction.startWidth, rawHeight / interaction.startHeight);
  const width = interaction.startWidth * scale;
  const height = interaction.startHeight * scale;
  const fixedLocal =
    interaction.handle === "nw"
      ? { x: width / 2, y: height / 2 }
      : interaction.handle === "ne"
        ? { x: -width / 2, y: height / 2 }
        : interaction.handle === "se"
          ? { x: -width / 2, y: -height / 2 }
          : { x: width / 2, y: -height / 2 };
  const centerOffset = rotatePoint(fixedLocal, interaction.rotation);
  const center = { x: interaction.fixedX - centerOffset.x, y: interaction.fixedY - centerOffset.y };
  return {
    ...layer,
    x: center.x - width / 2,
    y: center.y - height / 2,
    width,
    height,
  };
}

function layerCenter(layer: ProjectionLayer) {
  return { x: layer.x + layer.width / 2, y: layer.y + layer.height / 2 };
}

function rotatePoint(point: { x: number; y: number }, angle: number) {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos };
}

function rotatedLayerPoint(layer: ProjectionLayer, x: number, y: number) {
  const center = layerCenter(layer);
  const rotated = rotatePoint({ x: x - layer.width / 2, y: y - layer.height / 2 }, layer.rotation);
  return { x: center.x + rotated.x, y: center.y + rotated.y };
}

function layerCorners(layer: ProjectionLayer) {
  return {
    nw: rotatedLayerPoint(layer, 0, 0),
    ne: rotatedLayerPoint(layer, layer.width, 0),
    se: rotatedLayerPoint(layer, layer.width, layer.height),
    sw: rotatedLayerPoint(layer, 0, layer.height),
  };
}

function angleFrom(centerX: number, centerY: number, point: { x: number; y: number }) {
  return Math.atan2(point.y - centerY, point.x - centerX);
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to encode image."));
    reader.readAsDataURL(blob);
  });
}

function drawLayerHandles(ctx: CanvasRenderingContext2D, layer: ProjectionLayer, dpr: number) {
  const corners = layerCorners(layer);
  const scaledCorners = [corners.nw, corners.ne, corners.se, corners.sw].map((point) => ({ x: point.x * dpr, y: point.y * dpr }));
  const handles = layerHandles(layer);
  const handleSize = HANDLE_SIZE * dpr;
  const deleteSize = DELETE_HANDLE_SIZE * dpr;
  const rotateSize = ROTATE_HANDLE_SIZE * dpr;

  ctx.save();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = "#64c6b0";
  ctx.lineWidth = 2 * dpr;
  ctx.setLineDash([6 * dpr, 4 * dpr]);
  ctx.beginPath();
  ctx.moveTo(scaledCorners[0].x, scaledCorners[0].y);
  scaledCorners.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  const topCenter = rotatedLayerPoint(layer, layer.width / 2, 0);
  const rotateCenter = { x: (handles.rotate.x + handles.rotate.width / 2) * dpr, y: (handles.rotate.y + handles.rotate.height / 2) * dpr };
  ctx.strokeStyle = "#64c6b0";
  ctx.lineWidth = 1.6 * dpr;
  ctx.beginPath();
  ctx.moveTo(topCenter.x * dpr, topCenter.y * dpr);
  ctx.lineTo(rotateCenter.x, rotateCenter.y);
  ctx.stroke();

  (["nw", "ne", "se", "sw"] as ResizeHandle[]).forEach((handle) => {
    const rect = handles[handle];
    const handleX = rect.x * dpr;
    const handleY = rect.y * dpr;
    ctx.fillStyle = "#101416";
    ctx.strokeStyle = "#64c6b0";
    ctx.lineWidth = 2 * dpr;
    ctx.fillRect(handleX, handleY, handleSize, handleSize);
    ctx.strokeRect(handleX, handleY, handleSize, handleSize);
  });

  ctx.beginPath();
  ctx.arc(rotateCenter.x, rotateCenter.y, rotateSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#101416";
  ctx.fill();
  ctx.strokeStyle = "#64c6b0";
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
  ctx.strokeStyle = "#64c6b0";
  ctx.lineWidth = 1.7 * dpr;
  ctx.beginPath();
  ctx.arc(rotateCenter.x, rotateCenter.y, rotateSize * 0.23, Math.PI * 0.15, Math.PI * 1.65);
  ctx.stroke();

  const deleteX = (handles.delete.x + handles.delete.width / 2) * dpr;
  const deleteY = (handles.delete.y + handles.delete.height / 2) * dpr;
  ctx.beginPath();
  ctx.arc(deleteX, deleteY, deleteSize / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#ef8354";
  ctx.fill();
  ctx.strokeStyle = "#101416";
  ctx.lineWidth = 2 * dpr;
  ctx.stroke();
  ctx.strokeStyle = "#101416";
  ctx.lineWidth = 2.2 * dpr;
  ctx.beginPath();
  ctx.moveTo(deleteX - deleteSize * 0.22, deleteY - deleteSize * 0.22);
  ctx.lineTo(deleteX + deleteSize * 0.22, deleteY + deleteSize * 0.22);
  ctx.moveTo(deleteX + deleteSize * 0.22, deleteY - deleteSize * 0.22);
  ctx.lineTo(deleteX - deleteSize * 0.22, deleteY + deleteSize * 0.22);
  ctx.stroke();
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}
