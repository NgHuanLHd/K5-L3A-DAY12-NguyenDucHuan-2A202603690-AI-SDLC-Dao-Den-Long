// Player settings, kept between sessions (localStorage; must work when storage is unavailable).

/** Rebindable actions (TICKET-04 accessibility). Left/right camera arrows and Esc stay fixed. */
export const ACTIONS = ["up", "down", "left", "right", "jump", "dash", "interact", "pulse", "pause"] as const;
export type Action = (typeof ACTIONS)[number];
export type KeyMap = Record<Action, string>;

export const ACTION_LABEL: Record<Action, string> = {
  up: "Đi lên (tiến)", down: "Đi xuống (lùi)", left: "Đi trái", right: "Đi phải",
  jump: "Nhảy", dash: "Lướt", interact: "Nạp đèn", pulse: "Tỏa sáng", pause: "Tạm dừng",
};

export const DEFAULT_KEYS: KeyMap = {
  up: "KeyW", down: "KeyS", left: "KeyA", right: "KeyD",
  jump: "Space", dash: "ShiftLeft", interact: "KeyE", pulse: "KeyF", pause: "KeyP",
};

/** Keys that can never be bound: Escape is the fixed back/pause key, Arrow keys drive the camera. */
const RESERVED = /^(Escape|Arrow(Up|Down|Left|Right))$/;
const CODE = /^[A-Za-z0-9]{2,20}$/;

export interface Settings {
  /** 0..1 master volume. */
  volume: number;
  /** 0.2..3 mouse look sensitivity multiplier. */
  sensitivity: number;
  /** Ticket-03 colour-blind palette: shade rim and eyes #00B3FF, warnings white with a ⚠ mark. */
  colorblind: boolean;
  /** Rebindable keys, one code per action. Duplicates are rejected by keyConflict(). */
  keys: KeyMap;
  /** Turns off camera shake and the pulse flash (TICKET-04). */
  reduceMotion: boolean;
  /** UI zoom ×1.25 (TICKET-04). */
  largeText: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  volume: 0.7, sensitivity: 1, colorblind: false,
  keys: { ...DEFAULT_KEYS }, reduceMotion: false, largeText: false,
};
const KEY = "dao-den-long.settings";

const clamp = (v: unknown, lo: number, hi: number, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback;

/** Returns the action already bound to `code` (other than `action`), or null. Pure. */
export function keyConflict(keys: KeyMap, action: Action, code: string): Action | null {
  for (const a of ACTIONS) if (a !== action && keys[a] === code) return a;
  return null;
}

/** Keys valid for binding. Pure. */
export function isBindable(code: string): boolean {
  return CODE.test(code) && !RESERVED.test(code);
}

/** Pure: a stored key map, with bad or duplicate entries replaced by defaults. */
function parseKeys(v: unknown): KeyMap {
  const out: KeyMap = { ...DEFAULT_KEYS };
  if (typeof v !== "object" || v === null) return out;
  const src = v as Record<string, unknown>;
  for (const a of ACTIONS) {
    const code = src[a];
    if (typeof code === "string" && isBindable(code)) out[a] = code;
  }
  // A map with duplicates would make two actions share one key: fall back to defaults.
  const values = new Set(ACTIONS.map((a) => out[a]));
  return values.size === ACTIONS.length ? out : { ...DEFAULT_KEYS };
}

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
    keys: parseKeys(j.keys),
    reduceMotion: typeof j.reduceMotion === "boolean" ? j.reduceMotion : DEFAULT_SETTINGS.reduceMotion,
    largeText: typeof j.largeText === "boolean" ? j.largeText : DEFAULT_SETTINGS.largeText,
  };
}

export function loadSettings(): Settings {
  try {
    return parseSettings(localStorage.getItem(KEY));
  } catch {
    return { ...DEFAULT_SETTINGS, keys: { ...DEFAULT_KEYS } };
  }
}

export function saveSettings(s: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(parseSettings(JSON.stringify(s))));
  } catch {
    /* private mode / blocked storage: settings just do not persist */
  }
}
