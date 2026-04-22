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
  x: number;
  y: number;
  width: number;
  height: number;
  opacity: number;
};

const PROJECTION_PUBLISH_INTERVAL_MS = 96;

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
              x: 80 + index * 32,
              y: 60 + index * 24,
              width: Math.min(320, image.width),
              height: Math.min(180, image.height),
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
              <label className="file-button">
                Add PNG
                <input type="file" accept="image/png,image/jpeg,image/webp" multiple onChange={onPngChange} />
              </label>
            </div>
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
  const dragRef = useRef<{ layerId: string; offsetX: number; offsetY: number } | null>(null);
  const layersRef = useRef(layers);
  const pendingLayersRef = useRef<ProjectionLayer[] | null>(null);
  const layerFrameRef = useRef(0);
  const pendingProjectionLayersRef = useRef<ProjectionLayer[] | null>(null);
  const projectionPublishTimerRef = useRef<number | null>(null);
  const lastProjectionPublishRef = useRef(0);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);

  useEffect(() => {
    return () => {
      if (layerFrameRef.current) cancelAnimationFrame(layerFrameRef.current);
      if (projectionPublishTimerRef.current !== null) window.clearTimeout(projectionPublishTimerRef.current);
    };
  }, []);

  function scheduleLayersChange(nextLayers: ProjectionLayer[]) {
    pendingLayersRef.current = nextLayers;
    if (layerFrameRef.current) return;
    layerFrameRef.current = requestAnimationFrame(() => {
      layerFrameRef.current = 0;
      const pending = pendingLayersRef.current;
      pendingLayersRef.current = null;
      if (pending) onLayersChange(pending);
    });
  }

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
    projection.width = Math.max(1, Math.ceil(layoutW * projectionScale));
    projection.height = Math.max(1, Math.ceil(layoutH * projectionScale));
    const projectionCtx = projection.getContext("2d");
    projectionCtx?.clearRect(0, 0, projection.width, projection.height);

    const drawLayer = (targetCtx: CanvasRenderingContext2D, layer: ProjectionLayer, x: number, y: number, width: number, height: number) => {
      targetCtx.globalAlpha = layer.opacity;
      targetCtx.drawImage(layer.image, x, y, width, height);
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

    if (publish) {
      pendingProjectionLayersRef.current = null;
      lastProjectionPublishRef.current = performance.now();
      onProjectionCanvas(projection, layersToRender.length > 0);
    }
  }, [keys, selectedKeys, frame, onProjectionCanvas]);

  function cancelScheduledProjectionPublish() {
    if (projectionPublishTimerRef.current === null) return;
    window.clearTimeout(projectionPublishTimerRef.current);
    projectionPublishTimerRef.current = null;
  }

  function scheduleProjectionPublish(nextLayers: ProjectionLayer[]) {
    pendingProjectionLayersRef.current = nextLayers;
    if (projectionPublishTimerRef.current !== null) return;

    const elapsed = performance.now() - lastProjectionPublishRef.current;
    const delay = Math.max(0, PROJECTION_PUBLISH_INTERVAL_MS - elapsed);
    projectionPublishTimerRef.current = window.setTimeout(() => {
      projectionPublishTimerRef.current = null;
      const pending = pendingProjectionLayersRef.current;
      if (pending) renderProjectionCanvas(pending, { publish: true });
    }, delay);
  }

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
    return { x: point.x - layer.x, y: point.y - layer.y };
  }

  function hitLayer(layer: ProjectionLayer, point: { x: number; y: number }) {
    return point.x >= layer.x && point.x <= layer.x + layer.width && point.y >= layer.y && point.y <= layer.y + layer.height;
  }

  function onPointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const point = canvasPoint(event);
    const layer = [...layers]
      .reverse()
      .find((item) => hitLayer(item, point));
    if (layer) {
      setSelectedLayerId(layer.id);
      const local = localLayerPoint(layer, point);
      dragRef.current = { layerId: layer.id, offsetX: local.x, offsetY: local.y };
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
      return { ...layer, x: point.x - drag.offsetX, y: point.y - drag.offsetY };
    });
    layersRef.current = nextLayers;
    renderProjectionCanvas(nextLayers, { publish: false });
    scheduleProjectionPublish(nextLayers);
    scheduleLayersChange(nextLayers);
  }

  function onPointerUp(event: PointerEvent<HTMLCanvasElement>) {
    cancelScheduledProjectionPublish();
    renderProjectionCanvas(layersRef.current, { publish: true });
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
