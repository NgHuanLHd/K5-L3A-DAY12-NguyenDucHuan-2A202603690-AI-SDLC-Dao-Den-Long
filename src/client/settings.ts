// Player settings, kept between sessions (localStorage; must work when storage is unavailable).
export interface Settings {
  /** 0..1 master volume. */
  volume: number;
  /** 0.2..3 mouse look sensitivity multiplier. */
  sensitivity: number;
  /** Ticket-03 colour-blind palette: shade rim and eyes #00B3FF, warnings white with a ⚠ mark. */
  colorblind: boolean;
}
export const DEFAULT_SETTINGS: Settings = { volume: 0.7, sensitivity: 1, colorblind: false };
const KEY = "dao-den-long.settings";

const clamp = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** Pure: raw JSON text (or null) -> valid settings. Bad data falls back to defaults field by field. */
export function parseSettings(raw: string | null): Settings {
  let j: Record<string, unknown> = {};
  try {
    const p = raw ? JSON.parse(raw) : {};
    if (p && typeof p === "object") j = p as Record<string, unknown>;
  } catch {
    /* corrupt value: use defaults */
  }
  return {
    volume: clamp(j.volume, 0, 1, DEFAULT_SETTINGS.volume),
    sensitivity: clamp(j.sensitivity, 0.2, 3, DEFAULT_SETTINGS.sensitivity),
    colorblind: typeof j.colorblind === "boolean" ? j.colorblind : DEFAULT_SETTINGS.colorblind,
  };
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(parseSettings(JSON.stringify(s))));
  } catch {
    /* private mode / blocked storage: settings just do not persist */
  }
}
