import { ChangeEvent, PointerEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  buildReadout,
  profiles,
  type CaseMaterial,
  type KeyOverride,
  type KeycapMaterial,
  type SceneConfig,
} from "./keycap";
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
  caseMaterials: Array<SelectOption & { value: CaseMaterial }>;
  keycapTypes: SelectOption[];
  keycapMaterials: Array<SelectOption & { value: KeycapMaterial }>;
  keycapColors: SelectOption[];
  legendFonts: SelectOption[];
  iconPresets: SelectOption[];
  iconPositions?: NumberOption[];
  defaults: Omit<SceneConfig, "skinImage" | "projectionCanvas" | "projectionVersion" | "layoutKeys" | "keyOverrides">;
};

type ProjectionLayer = {
  id: string;
  name: string;
  image: HTMLImageElement;
  sourceDataUrl?: string;
  sourceMime?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
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
  sideSpread: 0.92,
  sideEase: 1.12,
  showWire: false,
  showGhost: false,
  showProjection: false,
  skinImage: null,
  projectionCanvas: null,
  projectionVersion: 0,
  layoutKeys: [],
  keyOverrides: {},
  selectedKeyIndex: 0,
  selectedKeyIndices: [0],
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
    sideSpread: fallbackDefaults.sideSpread,
    sideEase: fallbackDefaults.sideEase,
    showWire: fallbackDefaults.showWire,
    showGhost: fallbackDefaults.showGhost,
    showProjection: fallbackDefaults.showProjection,
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
    selectedKeyIndex: 0,
    selectedKeyIndices: [0],
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

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const viewerRef = useRef<KeycapScene | null>(null);
  const projectionCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectionVersionRef = useRef(0);
  const projectionUpdateFrameRef = useRef(0);
  const pendingProjectionRef = useRef<{ canvas: HTMLCanvasElement; hasArtwork: boolean } | null>(null);
  const initialConfig = sceneConfigFromPanel(fallbackPanelConfig);
  const latestConfigRef = useRef<SceneConfig>(initialConfig);
  const [panelConfig, setPanelConfig] = useState<PanelConfig>(fallbackPanelConfig);
  const [config, setConfig] = useState<SceneConfig>(initialConfig);
  const [presetId, setPresetId] = useState(fallbackPanelConfig.keyboardModels[0].id);
  const [mode, setMode] = useState<"preset" | "custom">("preset");
  const [layoutPath, setLayoutPath] = useState(fallbackPanelConfig.keyboardModels[0].layoutPath);
  const [layoutError, setLayoutError] = useState("");
  const [selectedKeys, setSelectedKeys] = useState([0]);
  const [projectionLayers, setProjectionLayers] = useState<ProjectionLayer[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState("");
  const activeProfile = profiles[config.profileId] ?? profiles.cherry;
  const selectedKey = selectedKeys[selectedKeys.length - 1] ?? 0;
  const isMultiSelecting = selectedKeys.length > 1;
  const selected = config.layoutKeys[selectedKey];
  const selectedOverride = config.keyOverrides[selectedKey] ?? {};
  const readout = buildReadout(config);
  const keyboardModels = panelConfig.keyboardModels;
  const legendFonts = panelConfig.legendFonts;
  const iconPresets = panelConfig.iconPresets;
  const iconPositions = panelConfig.iconPositions ?? iconPositionOptions;
  const activeKeycapColor = panelConfig.keycapColors.find((color) => color.value.toLowerCase() === config.keycapColor.toLowerCase());

  useEffect(() => {
    let cancelled = false;
    fetch("/config/panel.json")
      .then((response) => {
        if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
        return response.json() as Promise<PanelConfig>;
      })
      .then((nextPanelConfig) => {
        if (cancelled) return;
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
      })
      .catch(() => {
        if (!cancelled) setPanelConfig(fallbackPanelConfig);
      });
    return () => {
      cancelled = true;
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
      caseConfig: { color: modelDefaults.caseColor, material: modelDefaults.caseMaterial },
      keyOverrides: {},
    }));
    setSelectedKeys([0]);
  }, [presetId, mode, panelConfig.keyboardModels]);

  useEffect(() => {
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
        setSelectedKeys([0]);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLayoutError(error instanceof Error ? error.message : String(error));
      });
    return () => {
      cancelled = true;
    };
  }, [layoutPath]);

  function patch(next: Partial<SceneConfig>) {
    setConfig((current) => ({ ...current, ...next }));
  }

  function patchSelectedKey(next: KeyOverride) {
    setConfig((current) => withKeyOverride(current, selectedKey, next));
  }

  function patchSelectedKeys(next: KeyOverride) {
    setConfig((current) =>
      selectedKeys.reduce((acc, index) => withKeyOverride(acc, index, next), current),
    );
  }

  function resetSelectedKeyAppearance() {
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

  function toggleSelectedKey(index: number) {
    setSelectedKeys((current) => {
      if (current.includes(index)) {
        return current.length > 1 ? current.filter((item) => item !== index) : current;
      }
      return [...current, index];
    });
  }

  function setSelectedLegend(value: string, slot = 4) {
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

  async function onExportProject() {
    if (isExporting) return;
    setIsExporting(true);
    setExportError("");
    try {
      const blob = await exportProjectZip({
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
      link.download = `keyboard3d-export-${timestampForFile()}.zip`;
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
            <button id="resetView" title="Reset view" aria-label="Reset view" onClick={() => viewerRef.current?.resetCamera()}>
              鈫?            </button>
          </div>
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
              onSelectKey={toggleSelectedKey}
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
                  {isMultiSelecting ? `${selectedKeys.length} keys selected` : `#${selectedKey + 1} ${selectedLabel}`}
                </p>
              </div>
            </div>

            <section className="control-grid">
              <label>
                Key cap color
                <select
                  value={selectedOverride.color ?? ""}
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
              <button type="button" onClick={resetSelectedKeyAppearance}>
                Reset key appearance
              </button>
            </section>

            <section className="control-group">
              <label htmlFor="keyLegend">Legend text</label>
              <input id="keyLegend" value={isMultiSelecting ? "" : selectedLabel} disabled={isMultiSelecting} onChange={(event) => setSelectedLegend(event.target.value)} />
            </section>

            <section className="control-grid">
              <label>
                Key font
                <select value={selectedOverride.legendFont ?? config.legendFont} onChange={(event) => patchSelectedKey({ legendFont: event.target.value })}>
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
                  onChange={(event) => patchSelectedKey({ legendColor: event.target.value })}
                />
              </label>
            </section>

            <section className="control-group">
              <label htmlFor="iconSelect">Add icon</label>
              <select
                id="iconSelect"
                value={selectedOverride.iconImageUrl ?? ""}
                disabled={isMultiSelecting}
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
                <input type="file" accept="image/png" disabled={isMultiSelecting} onChange={onIconPngChange} />
              </label>
            </section>

            <section className="control-group">
              <label htmlFor="iconPosition">Icon position</label>
              <select
                id="iconPosition"
                value={selectedOverride.iconPosition ?? 4}
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
                onChange={(event) => patchSelectedKey({ legendScale: Number(event.target.value) })}
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
  onSelectKey,
  onClearSelection,
  onLayersChange,
  onProjectionCanvas,
}: {
  keys: ParsedKey[];
  layers: ProjectionLayer[];
  selectedKeys: number[];
  onSelectKey: (index: number) => void;
  onClearSelection: () => void;
  onLayersChange: (layers: ProjectionLayer[]) => void;
  onProjectionCanvas: (canvas: HTMLCanvasElement, hasArtwork: boolean) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const projectionRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const dragRef = useRef<LayerInteraction | null>(null);
  const layersRef = useRef(layers);

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
    renderProjectionCanvas(layers, { publish: !dragRef.current });
  }, [layers, selectedLayerId, renderProjectionCanvas]);

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
    renderProjectionCanvas(nextLayers, { publish: true });
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
    if (keyIndex >= 0) onSelectKey(keyIndex);
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
    renderProjectionCanvas(nextLayers, { publish: true });
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

type ExportProjectInput = {
  mode: "preset" | "custom";
  presetId: string;
  layoutPath: string;
  config: SceneConfig;
  layers: ProjectionLayer[];
  projectionCanvas: HTMLCanvasElement | null;
};

async function exportProjectZip(input: ExportProjectInput) {
  const imageFiles = await Promise.all(
    input.layers.map(async (layer, index) => {
      const image = await layerImageBytes(layer);
      const extension = extensionFromMime(image.mime, layer.name);
      const path = `assets/images/${String(index + 1).padStart(2, "0")}-${safeFileBase(layer.name)}.${extension}`;
      return { layer, image, path };
    }),
  );
  const transferSheet = await createHeatTransferSheet(input.config, input.projectionCanvas);
  const faceCuts = await createHeatTransferFaceCuts(input.config, input.projectionCanvas);

  const project = {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    app: "keyboard3d",
    mode: input.mode,
    presetId: input.presetId,
    layoutPath: input.layoutPath,
    config: exportableConfig(input.config),
    heatTransferSheet: {
      file: "production/heat-transfer-sheet.png",
      dpi: HEAT_TRANSFER_DPI,
      pxPerMm: HEAT_TRANSFER_PX_PER_MM,
      keySpacingMm: HEAT_TRANSFER_KEY_SPACING_MM,
      sizePx: { width: transferSheet.canvas.width, height: transferSheet.canvas.height },
      sizeMm: {
        width: transferSheet.canvas.width / HEAT_TRANSFER_PX_PER_MM,
        height: transferSheet.canvas.height / HEAT_TRANSFER_PX_PER_MM,
      },
      layout: transferSheet.layout,
    },
    heatTransferFaces: {
      directory: "production/key-faces",
      dpi: HEAT_TRANSFER_DPI,
      pxPerMm: HEAT_TRANSFER_PX_PER_MM,
      files: faceCuts.map(({ data, ...face }) => face),
    },
    projectionLayers: imageFiles.map(({ layer, image, path }) => ({
      id: layer.id,
      name: layer.name,
      file: path,
      mime: image.mime,
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      rotation: layer.rotation,
      rotationDegrees: (layer.rotation * 180) / Math.PI,
      opacity: layer.opacity,
      naturalWidth: layer.image.naturalWidth,
      naturalHeight: layer.image.naturalHeight,
    })),
  };

  const encoder = new TextEncoder();
  return createZip([
    { path: "project.json", data: encoder.encode(JSON.stringify(project, null, 2)) },
    { path: "production/heat-transfer-sheet.png", data: transferSheet.png },
    ...faceCuts.map(({ path, data }) => ({ path, data })),
    ...imageFiles.map(({ image, path }) => ({ path, data: image.data })),
  ]);
}

function exportableConfig(config: SceneConfig) {
  const { skinImage, projectionCanvas, projectionVersion, ...rest } = config;
  void skinImage;
  void projectionCanvas;
  void projectionVersion;
  return rest;
}

const KEY_UNIT_MM = 19.05;
const HEAT_TRANSFER_DPI = 300;
const HEAT_TRANSFER_PX_PER_MM = HEAT_TRANSFER_DPI / 25.4;
const HEAT_TRANSFER_KEY_SPACING_MM = 5;
const HEAT_TRANSFER_BLEED_PX = 2;
const HEAT_TRANSFER_FACE_JOIN_OVERLAP_PX = 6;
const HEAT_TRANSFER_SEAM_REPAIR_PX = 10;

type HeatTransferFaceName = "top" | "back" | "front" | "left" | "right";

type HeatTransferTile = {
  key: ParsedKey;
  topW: number;
  topH: number;
  sideX: number;
  sideY: number;
  projectedBottomW: number;
  projectedBottomH: number;
  projectedInsetX: number;
  projectedInsetY: number;
};

type HeatTransferSourceRect = {
  sourceX: number;
  sourceY: number;
  sourceW: number;
  sourceH: number;
};

type HeatTransferFrame = {
  minX: number;
  minY: number;
  frameW: number;
  frameH: number;
};

async function createHeatTransferSheet(config: SceneConfig, projectionCanvas: HTMLCanvasElement | null) {
  const keys = config.layoutKeys;
  if (!keys.length) {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    return { canvas, png: await canvasToPngBytes(canvas), layout: [] };
  }

  const minX = Math.min(...keys.map((key) => key.x));
  const minY = Math.min(...keys.map((key) => key.y));
  const maxX = Math.max(...keys.map((key) => key.x + key.w));
  const maxY = Math.max(...keys.map((key) => key.y + key.h));
  const frameW = Math.max(1, maxX - minX);
  const frameH = Math.max(1, maxY - minY);
  const spacingPx = Math.round(HEAT_TRANSFER_KEY_SPACING_MM * HEAT_TRANSFER_PX_PER_MM);
  const paddingPx = spacingPx;

  const rows = groupKeysForTransfer(keys);
  const tiles = rows.map((row) =>
    row.map((key) => heatTransferTileForKey(config, key)),
  );

  const rowSizes = tiles.map((row) => ({
    width: row.reduce((sum, tile, index) => sum + tile.sideX * 2 + tile.topW + (index ? spacingPx : 0), 0),
    height: Math.max(...row.map((tile) => tile.sideY * 2 + tile.topH)),
  }));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, paddingPx * 2 + Math.max(...rowSizes.map((row) => row.width)));
  canvas.height = Math.max(1, paddingPx * 2 + rowSizes.reduce((sum, row, index) => sum + row.height + (index ? spacingPx : 0), 0));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { canvas, png: await canvasToPngBytes(canvas), layout: [] };
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const layout: Array<Record<string, unknown>> = [];
  let cursorY = paddingPx;
  for (let rowIndex = 0; rowIndex < tiles.length; rowIndex += 1) {
    const row = tiles[rowIndex];
    let cursorX = paddingPx;
    for (let columnIndex = 0; columnIndex < row.length; columnIndex += 1) {
      const tile = row[columnIndex];
      const tileW = tile.sideX * 2 + tile.topW;
      const tileH = tile.sideY * 2 + tile.topH;
      await drawHeatTransferTile(ctx, projectionCanvas, tile, cursorX, cursorY, {
        minX,
        minY,
        frameW,
        frameH,
        config,
        keyIndex: keys.indexOf(tile.key),
      });
      const unwrap = heatTransferUnwrapMetrics(tile);
      layout.push({
        row: rowIndex,
        column: columnIndex,
        label: tile.key.label,
        source: { x: tile.key.x, y: tile.key.y, w: tile.key.w, h: tile.key.h },
        sheetPx: { x: cursorX, y: cursorY, width: tileW, height: tileH },
        sheetMm: {
          x: cursorX / HEAT_TRANSFER_PX_PER_MM,
          y: cursorY / HEAT_TRANSFER_PX_PER_MM,
          width: tileW / HEAT_TRANSFER_PX_PER_MM,
          height: tileH / HEAT_TRANSFER_PX_PER_MM,
        },
        faces: {
          back: { x: tile.sideX, y: 0, width: tile.topW, height: tile.sideY },
          left: { x: 0, y: tile.sideY, width: tile.sideX, height: tile.topH },
          top: { x: tile.sideX, y: tile.sideY, width: tile.topW, height: tile.topH },
          right: { x: tile.sideX + tile.topW, y: tile.sideY, width: tile.sideX, height: tile.topH },
          front: { x: tile.sideX, y: tile.sideY + tile.topH, width: tile.topW, height: tile.sideY },
        },
        unwrap3x3: {
          cornerWidthPx: unwrap.cornerW,
          cornerHeightPx: unwrap.cornerH,
          centerPx: { x: tile.sideX, y: tile.sideY, width: tile.topW, height: tile.topH },
          sideDepthPx: { x: tile.sideX, y: tile.sideY },
          projectedInsetPx: { x: tile.projectedInsetX, y: tile.projectedInsetY },
        },
      });
      cursorX += tileW + spacingPx;
    }
    cursorY += rowSizes[rowIndex].height + spacingPx;
  }

  return { canvas, png: await canvasToPngBytes(canvas), layout };
}

async function createHeatTransferFaceCuts(config: SceneConfig, projectionCanvas: HTMLCanvasElement | null) {
  const keys = config.layoutKeys;
  if (!keys.length) return [];

  const frame = heatTransferFrameForKeys(keys);
  const cuts: Array<{
    path: string;
    data: Uint8Array;
    keyIndex: number;
    keyLabel: string;
    face: HeatTransferFaceName;
    sizePx: { width: number; height: number };
    sizeMm: { width: number; height: number };
  }> = [];

  for (let keyIndex = 0; keyIndex < keys.length; keyIndex += 1) {
    const key = keys[keyIndex];
    const tile = heatTransferTileForKey(config, key);
    const override = config.keyOverrides[keyIndex] ?? {};
    const keyLabel = resolveKeyLabel(key, override);
    const source = projectionCanvas ? heatTransferSourceForKey(tile, projectionCanvas, frame) : null;
    const faceNames: HeatTransferFaceName[] = ["top", "back", "front", "left", "right"];

    for (const face of faceNames) {
      const canvas = await createHeatTransferFaceCanvas(config, projectionCanvas, tile, keyIndex, face, source);
      const keySlug = safeFileBase(`${String(keyIndex + 1).padStart(3, "0")}-${keyLabel}`);
      const path = `production/key-faces/${keySlug}-${face}.png`;
      cuts.push({
        path,
        data: await canvasToPngBytes(canvas),
        keyIndex,
        keyLabel,
        face,
        sizePx: { width: canvas.width, height: canvas.height },
        sizeMm: {
          width: canvas.width / HEAT_TRANSFER_PX_PER_MM,
          height: canvas.height / HEAT_TRANSFER_PX_PER_MM,
        },
      });
    }
  }

  return cuts;
}

async function createHeatTransferFaceCanvas(
  config: SceneConfig,
  projectionCanvas: HTMLCanvasElement | null,
  tile: HeatTransferTile,
  keyIndex: number,
  face: HeatTransferFaceName,
  source: HeatTransferSourceRect | null,
) {
  const canvas = document.createElement("canvas");
  const faceSize = heatTransferFaceSize(tile, face);
  canvas.width = faceSize.width;
  canvas.height = faceSize.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  drawHeatTransferFaceBase(ctx, tile, config, keyIndex, face);
  if (projectionCanvas && source) {
    drawHeatTransferFaceArtwork(ctx, projectionCanvas, tile, face, source);
  }
  await drawHeatTransferFaceLegends(ctx, tile, config, keyIndex, face);
  return canvas;
}

function heatTransferFrameForKeys(keys: ParsedKey[]): HeatTransferFrame {
  const minX = Math.min(...keys.map((key) => key.x));
  const minY = Math.min(...keys.map((key) => key.y));
  const maxX = Math.max(...keys.map((key) => key.x + key.w));
  const maxY = Math.max(...keys.map((key) => key.y + key.h));
  return {
    minX,
    minY,
    frameW: Math.max(1, maxX - minX),
    frameH: Math.max(1, maxY - minY),
  };
}

function heatTransferSourceForKey(tile: HeatTransferTile, projectionCanvas: HTMLCanvasElement, frame: HeatTransferFrame): HeatTransferSourceRect {
  return {
    sourceX: ((tile.key.x - frame.minX) / frame.frameW) * projectionCanvas.width,
    sourceY: ((tile.key.y - frame.minY) / frame.frameH) * projectionCanvas.height,
    sourceW: (tile.key.w / frame.frameW) * projectionCanvas.width,
    sourceH: (tile.key.h / frame.frameH) * projectionCanvas.height,
  };
}

function heatTransferFaceSize(tile: HeatTransferTile, face: HeatTransferFaceName) {
  if (face === "left" || face === "right") return { width: tile.sideX, height: tile.topH };
  if (face === "back" || face === "front") return { width: tile.topW, height: tile.sideY };
  return { width: tile.topW, height: tile.topH };
}

function drawHeatTransferFaceBase(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  config: SceneConfig,
  keyIndex: number,
  face: HeatTransferFaceName,
) {
  const override = config.keyOverrides[keyIndex] ?? {};
  const color = override.color ?? tile.key.color ?? config.keycapColor;
  ctx.fillStyle = face === "top" ? color : shadeColor(color, -12);
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
}

function drawHeatTransferFaceArtwork(
  ctx: CanvasRenderingContext2D,
  projectionCanvas: HTMLCanvasElement,
  tile: HeatTransferTile,
  face: HeatTransferFaceName,
  source: HeatTransferSourceRect,
) {
  const sourceBandX = Math.max(1, source.sourceW * (tile.projectedInsetX / tile.projectedBottomW));
  const sourceBandY = Math.max(1, source.sourceH * (tile.projectedInsetY / tile.projectedBottomH));
  const sourceCenterW = Math.max(1, source.sourceW - sourceBandX * 2);
  const sourceCenterH = Math.max(1, source.sourceH - sourceBandY * 2);
  const sx1 = source.sourceX + sourceBandX;
  const sx2 = source.sourceX + source.sourceW - sourceBandX;
  const sy1 = source.sourceY + sourceBandY;
  const sy2 = source.sourceY + source.sourceH - sourceBandY;

  if (face === "top") {
    drawClippedImage(ctx, projectionCanvas, sx1, sy1, sourceCenterW, sourceCenterH, 0, 0, tile.topW, tile.topH);
  } else if (face === "back") {
    drawClippedImage(ctx, projectionCanvas, sx1, source.sourceY, sourceCenterW, sourceBandY, 0, 0, tile.topW, tile.sideY);
  } else if (face === "front") {
    drawClippedImage(ctx, projectionCanvas, sx1, sy2, sourceCenterW, sourceBandY, 0, 0, tile.topW, tile.sideY);
  } else if (face === "left") {
    drawClippedImage(ctx, projectionCanvas, source.sourceX, sy1, sourceBandX, sourceCenterH, 0, 0, tile.sideX, tile.topH);
  } else {
    drawClippedImage(ctx, projectionCanvas, sx2, sy1, sourceBandX, sourceCenterH, 0, 0, tile.sideX, tile.topH);
  }
}

async function drawHeatTransferFaceLegends(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  config: SceneConfig,
  keyIndex: number,
  face: HeatTransferFaceName,
) {
  const { entries, legendScale, legendFont } = heatTransferLegendContext(tile, config, keyIndex);
  if (face === "top") {
    drawLegendEntries(ctx, entries.filter((entry) => entry.index < 9), {
      x: 0,
      y: 0,
      width: tile.topW,
      height: tile.topH,
      fontScale: Math.min(tile.topW, tile.topH) / 512,
      legendScale,
      legendFont,
    });

    const iconUrl = config.keyOverrides[keyIndex]?.iconImageUrl;
    if (!iconUrl) return;
    const icon = await loadExportImage(iconUrl);
    if (!icon) return;
    const override = config.keyOverrides[keyIndex] ?? {};
    const [iconX, iconY] = EXPORT_LEGEND_POSITIONS[Math.max(0, Math.min(8, override.iconPosition ?? 4))] ?? EXPORT_LEGEND_POSITIONS[4];
    const iconSize = tile.topW * 0.42 * Math.max(0.2, Math.min(2.4, override.iconScale ?? 1));
    ctx.drawImage(icon, iconX * tile.topW - iconSize / 2, iconY * tile.topH - iconSize / 2, iconSize, iconSize);
    return;
  }

  if (face === "front") {
    drawLegendEntries(ctx, entries.filter((entry) => entry.index >= 9), {
      x: 0,
      y: 0,
      width: tile.topW,
      height: tile.sideY,
      fontScale: Math.min(tile.topW, tile.sideY) / 512,
      legendScale,
      legendFont,
    });
  }
}

function groupKeysForTransfer(keys: ParsedKey[]) {
  const rows: ParsedKey[][] = [];
  keys
    .slice()
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .forEach((key) => {
      const row = rows.find((items) => Math.abs(items[0].y - key.y) < 0.01);
      if (row) row.push(key);
      else rows.push([key]);
    });
  rows.forEach((row) => row.sort((a, b) => a.x - b.x));
  return rows;
}

function heatTransferTileForKey(config: SceneConfig, key: ParsedKey): HeatTransferTile {
  const profile = profiles[config.profileId] ?? profiles.cherry;
  const row = key.profileRow === "SB" ? config.rowId : key.profileRow;
  const cfg = { ...profile.common, ...profile.rows[row], dishDepth: config.dishDepth };
  const bottomWmm = profile.common.bottomKeyWidth + (key.w - 1) * KEY_UNIT_MM;
  const bottomHmm = profile.common.bottomKeyHeight + (key.h - 1) * KEY_UNIT_MM;
  const topWmm = Math.max(6, bottomWmm - profile.common.widthDifference);
  const topHmm = Math.max(6, bottomHmm - profile.common.heightDifference);
  const insetXmm = Math.max(0.1, (bottomWmm - topWmm) / 2);
  const insetYmm = Math.max(0.1, (bottomHmm - topHmm) / 2);
  const sideXmm = Math.hypot(insetXmm, cfg.totalDepth);
  const sideYmm = Math.hypot(insetYmm, cfg.totalDepth);
  const px = HEAT_TRANSFER_PX_PER_MM;

  return {
    key,
    topW: Math.round(topWmm * px),
    topH: Math.round(topHmm * px),
    sideX: Math.round(sideXmm * px),
    sideY: Math.round(sideYmm * px),
    projectedBottomW: Math.max(1, bottomWmm * px),
    projectedBottomH: Math.max(1, bottomHmm * px),
    projectedInsetX: Math.max(1, insetXmm * px),
    projectedInsetY: Math.max(1, insetYmm * px),
  };
}

async function drawHeatTransferTile(
  ctx: CanvasRenderingContext2D,
  projectionCanvas: HTMLCanvasElement | null,
  tile: HeatTransferTile,
  x: number,
  y: number,
  frame: HeatTransferFrame & { config: SceneConfig; keyIndex: number },
) {
  drawHeatTransferKeyBase(ctx, tile, x, y, frame.config, frame.keyIndex);
  if (projectionCanvas) {
    const sourceX = ((tile.key.x - frame.minX) / frame.frameW) * projectionCanvas.width;
    const sourceY = ((tile.key.y - frame.minY) / frame.frameH) * projectionCanvas.height;
    const sourceW = (tile.key.w / frame.frameW) * projectionCanvas.width;
    const sourceH = (tile.key.h / frame.frameH) * projectionCanvas.height;
    drawHeatTransferUnwrap3x3(ctx, projectionCanvas, tile, x, y, { sourceX, sourceY, sourceW, sourceH });
  }
  await drawHeatTransferLegends(ctx, tile, x, y, frame.config, frame.keyIndex);
}

function drawHeatTransferUnwrap3x3(
  ctx: CanvasRenderingContext2D,
  projectionCanvas: HTMLCanvasElement,
  tile: HeatTransferTile,
  x: number,
  y: number,
  source: { sourceX: number; sourceY: number; sourceW: number; sourceH: number },
) {
  const sourceBandX = Math.max(1, source.sourceW * (tile.projectedInsetX / tile.projectedBottomW));
  const sourceBandY = Math.max(1, source.sourceH * (tile.projectedInsetY / tile.projectedBottomH));
  const sourceCenterW = Math.max(1, source.sourceW - sourceBandX * 2);
  const sourceCenterH = Math.max(1, source.sourceH - sourceBandY * 2);
  const { cornerW, cornerH } = heatTransferUnwrapMetrics(tile);
  const overlap = Math.min(HEAT_TRANSFER_FACE_JOIN_OVERLAP_PX, tile.sideX / 3, tile.sideY / 3);

  const sx0 = source.sourceX;
  const sx1 = source.sourceX + sourceBandX;
  const sx2 = source.sourceX + source.sourceW - sourceBandX;
  const sy0 = source.sourceY;
  const sy1 = source.sourceY + sourceBandY;
  const sy2 = source.sourceY + source.sourceH - sourceBandY;
  const topX = x + tile.sideX;
  const topY = y + tile.sideY;

  drawClippedImage(ctx, projectionCanvas, sx1, sy1, sourceCenterW, sourceCenterH, topX - overlap, topY - overlap, tile.topW + overlap * 2, tile.topH + overlap * 2);

  drawClippedImage(ctx, projectionCanvas, sx1, sy0, sourceCenterW, sourceBandY, topX + cornerW, y, Math.max(1, tile.topW - cornerW * 2), tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx1, sy2, sourceCenterW, sourceBandY, topX + cornerW, topY + tile.topH - overlap, Math.max(1, tile.topW - cornerW * 2), tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx0, sy1, sourceBandX, sourceCenterH, x, topY + cornerH, tile.sideX + overlap, Math.max(1, tile.topH - cornerH * 2));
  drawClippedImage(ctx, projectionCanvas, sx2, sy1, sourceBandX, sourceCenterH, topX + tile.topW - overlap, topY + cornerH, tile.sideX + overlap, Math.max(1, tile.topH - cornerH * 2));

  drawClippedImage(ctx, projectionCanvas, sx0, sy0, sourceBandX, sourceBandY, x, topY, tile.sideX + overlap, cornerH + overlap);
  drawClippedImage(ctx, projectionCanvas, sx0, sy2, sourceBandX, sourceBandY, x, topY + tile.topH - cornerH, tile.sideX + overlap, cornerH + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy0, sourceBandX, sourceBandY, topX + tile.topW - overlap, topY, tile.sideX + overlap, cornerH + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy2, sourceBandX, sourceBandY, topX + tile.topW - overlap, topY + tile.topH - cornerH, tile.sideX + overlap, cornerH + overlap);

  drawClippedImage(ctx, projectionCanvas, sx0, sy0, sourceBandX, sourceBandY, topX, y, cornerW + overlap, tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy0, sourceBandX, sourceBandY, topX + tile.topW - cornerW, y, cornerW + overlap, tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx0, sy2, sourceBandX, sourceBandY, topX, topY + tile.topH - overlap, cornerW + overlap, tile.sideY + overlap);
  drawClippedImage(ctx, projectionCanvas, sx2, sy2, sourceBandX, sourceBandY, topX + tile.topW - cornerW, topY + tile.topH - overlap, cornerW + overlap, tile.sideY + overlap);
}

function heatTransferUnwrapMetrics(tile: HeatTransferTile) {
  return {
    cornerW: Math.min(tile.sideX, Math.max(1, tile.topW * (tile.projectedInsetX / tile.projectedBottomW))),
    cornerH: Math.min(tile.sideY, Math.max(1, tile.topH * (tile.projectedInsetY / tile.projectedBottomH))),
  };
}

function drawHeatTransferKeyBase(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  x: number,
  y: number,
  config: SceneConfig,
  keyIndex: number,
) {
  const override = config.keyOverrides[keyIndex] ?? {};
  const color = override.color ?? tile.key.color ?? config.keycapColor;
  const overlap = Math.min(HEAT_TRANSFER_FACE_JOIN_OVERLAP_PX, tile.sideX / 3, tile.sideY / 3);
  ctx.fillStyle = shadeColor(color, -12);
  ctx.fillRect(x + tile.sideX, y, tile.topW, tile.sideY + overlap);
  ctx.fillRect(x, y + tile.sideY, tile.sideX + overlap, tile.topH);
  ctx.fillRect(x + tile.sideX + tile.topW - overlap, y + tile.sideY, tile.sideX + overlap, tile.topH);
  ctx.fillRect(x + tile.sideX, y + tile.sideY + tile.topH - overlap, tile.topW, tile.sideY + overlap);
  ctx.fillStyle = color;
  ctx.fillRect(x + tile.sideX - overlap, y + tile.sideY - overlap, tile.topW + overlap * 2, tile.topH + overlap * 2);
}

function repairHeatTransferSeams(
  ctx: CanvasRenderingContext2D,
  projectionCanvas: HTMLCanvasElement,
  tile: { key: ParsedKey; topW: number; topH: number; sideX: number; sideY: number },
  x: number,
  y: number,
  config: SceneConfig,
  keyIndex: number,
  source: { sourceX: number; sourceY: number; sourceW: number; sourceH: number },
) {
  const seam = Math.min(HEAT_TRANSFER_SEAM_REPAIR_PX, tile.sideX / 2, tile.sideY / 2);
  const topX = x + tile.sideX;
  const topY = y + tile.sideY;
  const override = config.keyOverrides[keyIndex] ?? {};
  const color = override.color ?? tile.key.color ?? config.keycapColor;

  ctx.save();
  ctx.fillStyle = color;
  ctx.fillRect(topX, topY - seam, tile.topW, seam * 2);
  ctx.fillRect(topX, topY + tile.topH - seam, tile.topW, seam * 2);
  ctx.fillRect(topX - seam, topY, seam * 2, tile.topH);
  ctx.fillRect(topX + tile.topW - seam, topY, seam * 2, tile.topH);
  ctx.restore();

  const sourceSeamY = (source.sourceH / tile.topH) * seam;
  drawClippedImage(ctx, projectionCanvas, source.sourceX, source.sourceY, source.sourceW, sourceSeamY, topX, topY - seam, tile.topW, seam * 2);
  drawClippedImage(ctx, projectionCanvas, source.sourceX, source.sourceY + source.sourceH - sourceSeamY, source.sourceW, sourceSeamY, topX, topY + tile.topH - seam, tile.topW, seam * 2);
}

async function drawHeatTransferLegends(
  ctx: CanvasRenderingContext2D,
  tile: HeatTransferTile,
  x: number,
  y: number,
  config: SceneConfig,
  keyIndex: number,
) {
  const { entries, legendScale, legendFont } = heatTransferLegendContext(tile, config, keyIndex);

  drawLegendEntries(ctx, entries.filter((entry) => entry.index < 9), {
    x: x + tile.sideX,
    y: y + tile.sideY,
    width: tile.topW,
    height: tile.topH,
    fontScale: Math.min(tile.topW, tile.topH) / 512,
    legendScale,
    legendFont,
  });
  drawLegendEntries(ctx, entries.filter((entry) => entry.index >= 9), {
    x: x + tile.sideX,
    y: y + tile.sideY + tile.topH,
    width: tile.topW,
    height: tile.sideY,
    fontScale: Math.min(tile.topW, tile.sideY) / 512,
    legendScale,
    legendFont,
  });

  const override = config.keyOverrides[keyIndex] ?? {};
  const iconUrl = override.iconImageUrl;
  if (!iconUrl) return;
  const icon = await loadExportImage(iconUrl);
  if (!icon) return;
  const [iconX, iconY] = EXPORT_LEGEND_POSITIONS[Math.max(0, Math.min(8, override.iconPosition ?? 4))] ?? EXPORT_LEGEND_POSITIONS[4];
  const iconSize = tile.topW * 0.42 * Math.max(0.2, Math.min(2.4, override.iconScale ?? 1));
  ctx.drawImage(icon, x + tile.sideX + iconX * tile.topW - iconSize / 2, y + tile.sideY + iconY * tile.topH - iconSize / 2, iconSize, iconSize);
}

function heatTransferLegendContext(tile: HeatTransferTile, config: SceneConfig, keyIndex: number) {
  const override = config.keyOverrides[keyIndex] ?? {};
  const labels = override.labels?.length ? override.labels : tile.key.labels;
  const entries = labels
    .map((label, index) => ({
      index,
      label: normalizeExportLegend(label ?? ""),
      color: override.legendColor ?? config.legendColor ?? tile.key.textColors[index] ?? tile.key.textColor,
      size: tile.key.textSizes[index] ?? tile.key.textSize ?? 3,
    }))
    .filter((entry) => entry.label);
  const legendScale = override.legendScale ?? config.legendScale;
  const legendFont = override.legendFont ?? config.legendFont;
  return { entries, legendScale, legendFont };
}

const EXPORT_LEGEND_POSITIONS: Array<[number, number]> = [
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

function drawLegendEntries(
  ctx: CanvasRenderingContext2D,
  entries: Array<{ index: number; label: string; color: string; size: number }>,
  area: { x: number; y: number; width: number; height: number; fontScale: number; legendScale: number; legendFont: string },
) {
  ctx.save();
  ctx.textBaseline = "middle";
  entries.forEach((entry) => {
    const [positionX, positionY] = EXPORT_LEGEND_POSITIONS[entry.index] ?? EXPORT_LEGEND_POSITIONS[4];
    const fontSize = Math.max(7, Math.min(area.height * 0.68, (6 + entry.size * 2) * 1.95 * area.legendScale * area.fontScale));
    ctx.fillStyle = entry.color;
    ctx.font = `600 ${fontSize}px ${area.legendFont}, "Segoe UI Symbol", "Arial Unicode MS", sans-serif`;
    ctx.textAlign = positionX < 0.34 ? "left" : positionX > 0.66 ? "right" : "center";
    const lines = entry.label.split("\n").filter(Boolean).slice(0, 2);
    const lineHeight = fontSize * 1.08;
    lines.forEach((line, lineIndex) => {
      const offset = (lineIndex - (lines.length - 1) / 2) * lineHeight;
      ctx.fillText(line, area.x + positionX * area.width, area.y + positionY * area.height + offset);
    });
  });
  ctx.restore();
}

function normalizeExportLegend(raw: string) {
  const withoutTags = raw.replace(/<i[^>]*class=["'][^"']*(fa-[a-z0-9-]+)[^"']*["'][^>]*><\/i>/gi, (_match, icon: string) => icon.replace(/^fa-/, ""));
  const text = withoutTags.replace(/<[^>]+>/g, "").trim();
  if (!text) return "";
  const textarea = document.createElement("textarea");
  textarea.innerHTML = text;
  return textarea.value;
}

async function loadExportImage(url: string) {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
    return image;
  } catch {
    return null;
  }
}

function shadeColor(color: string, amount: number) {
  const hex = color.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return color;
  const channel = (start: number) => Math.max(0, Math.min(255, parseInt(hex.slice(start, start + 2), 16) + amount));
  return `#${[channel(0), channel(2), channel(4)].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function drawFlippedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  flipX: boolean,
  flipY: boolean,
) {
  const bleedX = Math.min(HEAT_TRANSFER_BLEED_PX, Math.max(0, dw / 3));
  const bleedY = Math.min(HEAT_TRANSFER_BLEED_PX, Math.max(0, dh / 3));
  ctx.save();
  ctx.translate(dx + dw / 2, dy + dh / 2);
  ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  ctx.drawImage(image, sx, sy, sw, sh, -dw / 2 - bleedX, -dh / 2 - bleedY, dw + bleedX * 2, dh + bleedY * 2);
  ctx.restore();
}

function drawClippedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
) {
  const sourceWidth = image.width;
  const sourceHeight = image.height;
  const bleedX = Math.min(HEAT_TRANSFER_BLEED_PX, Math.max(0, dw / 3));
  const bleedY = Math.min(HEAT_TRANSFER_BLEED_PX, Math.max(0, dh / 3));
  const sourceBleedX = (sw / dw) * bleedX;
  const sourceBleedY = (sh / dh) * bleedY;
  const expandedSx = sx - sourceBleedX;
  const expandedSy = sy - sourceBleedY;
  const expandedSw = sw + sourceBleedX * 2;
  const expandedSh = sh + sourceBleedY * 2;
  const expandedDx = dx - bleedX;
  const expandedDy = dy - bleedY;
  const expandedDw = dw + bleedX * 2;
  const expandedDh = dh + bleedY * 2;

  const clippedX = Math.max(0, expandedSx);
  const clippedY = Math.max(0, expandedSy);
  const clippedRight = Math.min(sourceWidth, expandedSx + expandedSw);
  const clippedBottom = Math.min(sourceHeight, expandedSy + expandedSh);
  const clippedW = clippedRight - clippedX;
  const clippedH = clippedBottom - clippedY;
  if (clippedW <= 0 || clippedH <= 0) return;

  const offsetX = ((clippedX - expandedSx) / expandedSw) * expandedDw;
  const offsetY = ((clippedY - expandedSy) / expandedSh) * expandedDh;
  const destW = (clippedW / expandedSw) * expandedDw;
  const destH = (clippedH / expandedSh) * expandedDh;
  ctx.drawImage(image, clippedX, clippedY, clippedW, clippedH, expandedDx + offsetX, expandedDy + offsetY, destW, destH);
}

async function canvasToPngBytes(canvas: HTMLCanvasElement) {
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((nextBlob) => resolve(nextBlob ?? new Blob()), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function layerImageBytes(layer: ProjectionLayer): Promise<{ data: Uint8Array; mime: string }> {
  if (layer.sourceDataUrl) {
    const parsed = dataUrlToBytes(layer.sourceDataUrl);
    if (parsed) return parsed;
  }

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, layer.image.naturalWidth || Math.round(layer.width));
  canvas.height = Math.max(1, layer.image.naturalHeight || Math.round(layer.height));
  const ctx = canvas.getContext("2d");
  if (!ctx) return { data: new Uint8Array(), mime: "image/png" };
  ctx.drawImage(layer.image, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob((nextBlob) => resolve(nextBlob ?? new Blob()), "image/png"));
  return { data: new Uint8Array(await blob.arrayBuffer()), mime: "image/png" };
}

function dataUrlToBytes(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;,]+)?(;base64)?,(.*)$/);
  if (!match) return null;
  const mime = match[1] || "application/octet-stream";
  const isBase64 = Boolean(match[2]);
  const payload = match[3] ?? "";
  const binary = isBase64 ? atob(payload) : decodeURIComponent(payload);
  const data = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) data[index] = binary.charCodeAt(index);
  return { data, mime };
}

function extensionFromMime(mime: string, fallbackName: string) {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/webp") return "webp";
  if (mime === "image/png") return "png";
  const extension = fallbackName.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return extension || "png";
}

function safeFileBase(name: string) {
  const base = name.replace(/\.[^/.]+$/, "");
  return base.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "layer";
}

function timestampForFile() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

type ZipFile = {
  path: string;
  data: Uint8Array;
};

function createZip(files: ZipFile[]) {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;

  files.forEach((file) => {
    const name = new TextEncoder().encode(file.path.replace(/\\/g, "/"));
    const crc = crc32(file.data);
    const localHeader = new Uint8Array(30 + name.length);
    const local = new DataView(localHeader.buffer);
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime(), true);
    local.setUint16(12, dosDate(), true);
    local.setUint32(14, crc, true);
    local.setUint32(18, file.data.length, true);
    local.setUint32(22, file.data.length, true);
    local.setUint16(26, name.length, true);
    localHeader.set(name, 30);
    localParts.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + name.length);
    const central = new DataView(centralHeader.buffer);
    central.setUint32(0, 0x02014b50, true);
    central.setUint16(4, 20, true);
    central.setUint16(6, 20, true);
    central.setUint16(8, 0x0800, true);
    central.setUint16(10, 0, true);
    central.setUint16(12, dosTime(), true);
    central.setUint16(14, dosDate(), true);
    central.setUint32(16, crc, true);
    central.setUint32(20, file.data.length, true);
    central.setUint32(24, file.data.length, true);
    central.setUint16(28, name.length, true);
    central.setUint32(42, offset, true);
    centralHeader.set(name, 46);
    centralParts.push(centralHeader);
    offset += localHeader.length + file.data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true);
  endView.setUint16(8, files.length, true);
  endView.setUint16(10, files.length, true);
  endView.setUint32(12, centralSize, true);
  endView.setUint32(16, offset, true);

  const parts = [...localParts, ...centralParts, end];
  const zipBytes = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  parts.forEach((part) => {
    zipBytes.set(part, cursor);
    cursor += part.length;
  });
  const zipBuffer = zipBytes.buffer.slice(zipBytes.byteOffset, zipBytes.byteOffset + zipBytes.byteLength) as ArrayBuffer;
  return new Blob([zipBuffer], { type: "application/zip" });
}

function dosTime(date = new Date()) {
  return (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2);
}

function dosDate(date = new Date()) {
  return ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
}

const CRC_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(data: Uint8Array) {
  let crc = 0xffffffff;
  for (let index = 0; index < data.length; index += 1) crc = CRC_TABLE[(crc ^ data[index]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
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
