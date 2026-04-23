import "../styles.css";
import "./configEditor.css";

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
type JsonObject = { [key: string]: JsonValue };
type PanelConfig = JsonObject & {
  brand?: { title?: string; subtitle?: string };
  keyboardModels?: Array<JsonObject>;
  layouts?: Array<JsonObject>;
  themes?: Array<JsonObject>;
  defaults?: JsonObject;
};

const PANEL_CONFIG_STORAGE_KEY = "keyboard3d.panelConfig";
const rootElement = document.getElementById("config-editor-root");
if (!rootElement) throw new Error("Missing #config-editor-root");
const root = rootElement;

let config: PanelConfig = {};
let jsonText = "";
let errorText = "";

function valueAt(path: string) {
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc === undefined || acc === null) return undefined;
    return (acc as Record<string, unknown>)[key];
  }, config);
}

function setValue(path: string, value: JsonValue) {
  const parts = path.split(".");
  let target: Record<string, JsonValue> = config;
  parts.slice(0, -1).forEach((part) => {
    if (typeof target[part] !== "object" || target[part] === null) target[part] = {};
    target = target[part] as Record<string, JsonValue>;
  });
  target[parts[parts.length - 1]] = value;
  syncJson();
}

function field(path: string, label: string, type: "text" | "number" | "color" = "text") {
  const value = valueAt(path);
  return `
    <label>
      ${label}
      <input data-path="${path}" data-type="${type}" type="${type}" value="${escapeAttr(String(value ?? ""))}" />
    </label>
  `;
}

function selectField(path: string, label: string, options: string[]) {
  const value = String(valueAt(path) ?? "");
  return `
    <label>
      ${label}
      <select data-path="${path}">
        ${options.map((option) => `<option value="${escapeAttr(option)}" ${option === value ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function boolField(path: string, label: string) {
  return `
    <label>
      ${label}
      <select data-path="${path}" data-type="boolean">
        <option value="true" ${valueAt(path) === true ? "selected" : ""}>true</option>
        <option value="false" ${valueAt(path) === false ? "selected" : ""}>false</option>
      </select>
    </label>
  `;
}

function render() {
  syncJson(false);
  root.innerHTML = `
    <main class="config-editor-shell">
      <header class="config-editor-toolbar">
        <div>
          <h1>Config Editor</h1>
          <p class="hint">Visual editor for public/config/panel.json</p>
        </div>
        <div class="config-editor-actions">
          <button class="secondary-button" data-action="reload">Reload</button>
          <button class="secondary-button" data-action="clear-local">Clear local override</button>
          <button class="secondary-button" data-action="download">Download JSON</button>
        </div>
      </header>
      <section class="config-editor-main">
        <form class="config-editor-form">
          ${brandSection()}
          ${modelsSection()}
          ${layoutsSection()}
          ${themesSection()}
          ${defaultsSection()}
        </form>
        <aside class="config-editor-json">
          <div>
            <h2>JSON Preview</h2>
            <p class="hint">Edit JSON directly, then apply it to refresh the visual form.</p>
          </div>
          <textarea class="config-json-textarea" spellcheck="false">${escapeHtml(jsonText)}</textarea>
          <div>
            <p class="config-editor-error">${escapeHtml(errorText)}</p>
            <div class="config-button-row">
              <button class="secondary-button" data-action="copy" type="button">Copy JSON</button>
              <button class="secondary-button" data-action="apply-json" type="button">Apply JSON</button>
            </div>
          </div>
        </aside>
      </section>
    </main>
  `;
}

function brandSection() {
  return `
    <section class="config-section">
      <h2>Brand</h2>
      <div class="config-row">
        ${field("brand.title", "Title")}
        ${field("brand.subtitle", "Subtitle")}
      </div>
    </section>
  `;
}

function modelsSection() {
  const models = (config.keyboardModels ?? []) as Array<JsonObject>;
  return `
    <section class="config-section">
      <div class="section-heading">
        <h2>Keyboard Models</h2>
        <button class="secondary-button" data-action="add-model" type="button">Add model</button>
      </div>
      ${models
        .map(
          (_model, index) => `
            <article class="config-card">
              <div class="section-heading">
                <h2>${escapeHtml(String(valueAt(`keyboardModels.${index}.name`) ?? `Model ${index + 1}`))}</h2>
                <button class="secondary-button" data-action="remove-model" data-index="${index}" type="button">Remove</button>
              </div>
              <div class="config-row three">
                ${field(`keyboardModels.${index}.id`, "ID")}
                ${field(`keyboardModels.${index}.name`, "Name")}
                ${field(`keyboardModels.${index}.layoutPath`, "Layout path")}
              </div>
              <div class="config-row">
                ${field(`keyboardModels.${index}.description`, "Description")}
                ${field(`keyboardModels.${index}.defaultConfig.caseModelPath`, "Case GLB path")}
              </div>
              <div class="config-row three">
                ${selectField(`keyboardModels.${index}.defaultConfig.keycapType`, "Keycap type", ["cherry", "oem", "xda", "dsa"])}
                ${selectField(`keyboardModels.${index}.defaultConfig.caseMaterial`, "Case material", ["aluminum", "polycarbonate", "wood", "acrylic"])}
                ${selectField(`keyboardModels.${index}.defaultConfig.keycapMaterial`, "Keycap material", ["pbt", "abs", "resin", "metal"])}
              </div>
              <div class="config-row">
                ${field(`keyboardModels.${index}.defaultConfig.caseColor`, "Case color", "color")}
                ${field(`keyboardModels.${index}.defaultConfig.keycapColor`, "Keycap color", "color")}
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function layoutsSection() {
  return listSection("Layouts", "layouts", "add-layout", "remove-layout", [
    ["label", "Label"],
    ["value", "Path"],
  ]);
}

function themesSection() {
  return listSection("Preset Themes", "themes", "add-theme", "remove-theme", [
    ["id", "ID"],
    ["name", "Name"],
    ["layoutPath", "Layout path"],
    ["path", "Theme JSON path"],
    ["description", "Description"],
  ]);
}

function listSection(title: string, key: "layouts" | "themes", addAction: string, removeAction: string, fields: Array<[string, string]>) {
  const items = (config[key] ?? []) as Array<JsonObject>;
  return `
    <section class="config-section">
      <div class="section-heading">
        <h2>${title}</h2>
        <button class="secondary-button" data-action="${addAction}" type="button">Add</button>
      </div>
      ${items
        .map(
          (_item, index) => `
            <article class="config-card">
              <div class="config-row">
                ${fields.map(([fieldKey, label]) => field(`${key}.${index}.${fieldKey}`, label)).join("")}
              </div>
              <div class="config-button-row">
                <button class="secondary-button" data-action="${removeAction}" data-index="${index}" type="button">Remove</button>
              </div>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function defaultsSection() {
  return `
    <section class="config-section">
      <h2>Defaults</h2>
      <div class="config-row three">
        ${selectField("defaults.profileId", "Profile", ["cherry", "oem", "xda", "dsa"])}
        ${field("defaults.rowId", "Row")}
        ${field("defaults.dishDepth", "Dish depth", "number")}
      </div>
      <div class="config-row three">
        ${field("defaults.legendScale", "Legend scale", "number")}
        ${field("defaults.frontLegendHeight", "Side legend height", "number")}
        ${field("defaults.projectionOpacity", "Projection opacity", "number")}
      </div>
      <div class="config-row">
        ${field("defaults.legendFont", "Legend font")}
        ${field("defaults.legendColor", "Legend color", "color")}
      </div>
      <div class="config-row three">
        ${selectField("defaults.keycapMaterial", "Keycap material", ["pbt", "abs", "resin", "metal"])}
        ${field("defaults.keycapColor", "Keycap color", "color")}
        ${field("defaults.spotLightDistance", "Light distance", "number")}
      </div>
      <div class="config-row">
        ${selectField("defaults.caseConfig.material", "Case material", ["aluminum", "polycarbonate", "wood", "acrylic"])}
        ${field("defaults.caseConfig.color", "Case color", "color")}
      </div>
      <div class="config-row three">
        ${boolField("defaults.showProjection", "Show projection")}
        ${boolField("defaults.showWire", "Show wire")}
        ${boolField("defaults.showGhost", "Show guides")}
      </div>
    </section>
  `;
}

root.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement || target instanceof HTMLSelectElement)) return;
  const path = target.dataset.path;
  if (!path) return;
  setValue(path, coerceValue(target.value, target.dataset.type));
});

root.addEventListener("change", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLSelectElement)) return;
  const path = target.dataset.path;
  if (!path) return;
  setValue(path, coerceValue(target.value, target.dataset.type));
});

root.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-action]");
  if (!button) return;
  event.preventDefault();
  handleAction(button.dataset.action ?? "", Number(button.dataset.index));
});

function handleAction(action: string, index: number) {
  if (action === "reload") void loadConfig();
  if (action === "clear-local") clearLocalConfig();
  if (action === "download") downloadJson();
  if (action === "copy") void navigator.clipboard?.writeText(jsonText);
  if (action === "apply-json") applyJsonFromTextarea();
  if (action === "add-model") pushItem("keyboardModels", newModel());
  if (action === "remove-model") removeItem("keyboardModels", index);
  if (action === "add-layout") pushItem("layouts", { label: "New layout", value: "/layouts/new-layout.json" });
  if (action === "remove-layout") removeItem("layouts", index);
  if (action === "add-theme") pushItem("themes", { id: "new-theme", name: "New Theme", layoutPath: "", path: "/themes/new-theme/theme.json", description: "" });
  if (action === "remove-theme") removeItem("themes", index);
}

function pushItem(key: "keyboardModels" | "layouts" | "themes", item: JsonObject) {
  const list = (config[key] ?? []) as JsonObject[];
  config[key] = [...list, item];
  syncJson();
  render();
}

function removeItem(key: "keyboardModels" | "layouts" | "themes", index: number) {
  const list = (config[key] ?? []) as JsonObject[];
  config[key] = list.filter((_item, itemIndex) => itemIndex !== index);
  syncJson();
  render();
}

function newModel(): JsonObject {
  return {
    id: "new-model",
    name: "New Model",
    layoutPath: "/layouts/60_ansi_layout.json",
    defaultConfig: {
      keycapType: "cherry",
      caseMaterial: "aluminum",
      caseColor: "#6f7780",
      caseModelPath: "",
      keycapMaterial: "pbt",
      keycapColor: "#ececec",
    },
    description: "",
  };
}

function applyJsonFromTextarea() {
  const textarea = root.querySelector<HTMLTextAreaElement>(".config-json-textarea");
  if (!textarea) return;
  try {
    config = JSON.parse(textarea.value) as PanelConfig;
    errorText = "";
    syncJson();
    persistLocalConfig();
    render();
  } catch (error) {
    errorText = error instanceof Error ? error.message : String(error);
    render();
  }
}

function persistLocalConfig() {
  localStorage.setItem(PANEL_CONFIG_STORAGE_KEY, JSON.stringify(config));
}

function clearLocalConfig() {
  localStorage.removeItem(PANEL_CONFIG_STORAGE_KEY);
  errorText = "Local override cleared. Reload the main app to use public/config/panel.json again.";
  render();
}

function downloadJson() {
  const blob = new Blob([jsonText], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "panel.json";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function syncJson(updateTextarea = true) {
  jsonText = JSON.stringify(config, null, 2);
  if (updateTextarea) {
    const textarea = root.querySelector<HTMLTextAreaElement>(".config-json-textarea");
    if (textarea) textarea.value = jsonText;
  }
}

function coerceValue(value: string, type?: string): JsonValue {
  if (type === "number") return Number(value);
  if (type === "boolean") return value === "true";
  return value;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char);
}

function escapeAttr(value: string) {
  return escapeHtml(value);
}

async function loadConfig() {
  errorText = "";
  try {
    const localConfig = localStorage.getItem(PANEL_CONFIG_STORAGE_KEY);
    if (localConfig) {
      config = JSON.parse(localConfig) as PanelConfig;
      errorText = "Loaded local override.";
    } else {
      const response = await fetch("/config/panel.json");
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      config = (await response.json()) as PanelConfig;
    }
  } catch (error) {
    errorText = error instanceof Error ? error.message : String(error);
    config = {};
  }
  syncJson();
  render();
}

void loadConfig();
