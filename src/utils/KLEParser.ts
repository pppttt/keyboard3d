import * as kle from "@ijprest/kle-serial";

type KleKey = {
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  w2?: number;
  h2?: number;
  width2?: number;
  height2?: number;
  rotation_angle?: number;
  rotation_x?: number;
  rotation_y?: number;
  color?: string;
  default?: {
    textColor?: string;
    textSize?: number;
  };
  labels?: string[];
  textColor?: Array<string | undefined>;
  textSize?: Array<number | undefined>;
};

export type ProfileRow = "R1" | "R2" | "R3" | "R4" | "SB";
export type EnterType = "iso" | "ansi" | "custom";

export interface ParsedKey {
  x: number;
  y: number;
  w: number;
  h: number;
  x2?: number;
  y2?: number;
  w2?: number;
  h2?: number;
  r: number;
  rx: number;
  ry: number;
  row: number;
  profileRow: ProfileRow;
  label: string;
  labels: string[];
  textColors: string[];
  textSizes: number[];
  color: string;
  textColor: string;
  textSize: number;
  isEnter: boolean;
  enterType?: EnterType;
}

const PROFILE_ROWS: ProfileRow[] = ["R1", "R2", "R3", "R4", "SB"];

function groupByRow(keys: KleKey[]) {
  const rows: number[] = [];

  keys.forEach((key) => {
    if (!rows.some((y) => Math.abs(y - key.y) < 0.01)) {
      rows.push(key.y);
    }
  });

  return rows.sort((a, b) => a - b);
}

function detectEnterType(key: KleKey): EnterType | undefined {
  const labels = key.labels ?? [];
  const isEnter = labels.includes("Enter");
  if (!isEnter) return undefined;

  const width = key.width ?? 1;
  const height = key.height ?? 1;
  const w2 = key.width2 ?? key.w2 ?? width;
  const h2 = key.height2 ?? key.h2 ?? height;

  if (height > 1 || w2 !== width || h2 !== height || key.x2 || key.y2) return "iso";
  if (width >= 2) return "ansi";
  return "custom";
}

export function parseKLE(layout: unknown[]): { keys: ParsedKey[] } {
  const keyboard = kle.Serial.deserialize(layout);
  const kleKeys = keyboard.keys as KleKey[];
  const rowYs = groupByRow(kleKeys);

  const keys = kleKeys.map((key) => {
    const rowIndex = rowYs.findIndex((y) => Math.abs(y - key.y) < 0.01);
    const labels = key.labels ?? [];
    const textColor = key.default?.textColor ?? "#000000";
    const textSize = key.default?.textSize ?? 3;
    const enterType = detectEnterType(key);

    return {
      x: key.x,
      y: key.y,
      w: key.width ?? 1,
      h: key.height ?? 1,
      x2: key.x2,
      y2: key.y2,
      w2: key.width2 ?? key.w2,
      h2: key.height2 ?? key.h2,
      r: key.rotation_angle ?? 0,
      rx: key.rotation_x ?? 0,
      ry: key.rotation_y ?? 0,
      color: key.color ?? "#ececec",
      textColor,
      textSize,
      row: rowIndex,
      profileRow: PROFILE_ROWS[rowIndex] ?? "R4",
      label: labels.find(Boolean) ?? "",
      labels,
      textColors: Array.from({ length: 12 }, (_, index) => key.textColor?.[index] ?? textColor),
      textSizes: Array.from({ length: 12 }, (_, index) => key.textSize?.[index] ?? textSize),
      isEnter: labels.includes("Enter"),
      enterType,
    };
  });

  return { keys };
}
