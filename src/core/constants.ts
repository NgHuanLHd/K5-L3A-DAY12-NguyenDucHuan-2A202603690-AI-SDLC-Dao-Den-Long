// Internal constants that are NOT part of the contract tuning.
// Keep contract numbers in game.contract.json only. See docs/notes/assumptions.md.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Tolerance so that "within r" (<= r) is robust to float error. */
export const EPS = 1e-9;

/** Island "Đảo Bến": round, centred at origin. Player is kept inside (fall_enabled = false). */
export const ISLAND_RADIUS = 40;
/** Default lanterns L1..L5 on a ring, L1 at +Z. */
export const LANTERN_RING_RADIUS = 25;

/** Random motes: initial count, also the cap kept by respawning. */
export const INITIAL_MOTES = 20;
export const MOTE_RESPAWN_EVERY_S = 3;
export const MOTE_MIN_R = 3;

/** Random shades: first spawn, interval, max alive, spawn ring, centre height. */
export const SHADE_FIRST_SPAWN_S = 10;
export const SHADE_SPAWN_EVERY_S = 20;
export const SHADE_MAX = 4;
export const SHADE_SPAWN_R = 37;
export const SHADE_Y = 1;

/** Shades stop this far outside safe_radius so they are never "within" it. */
export const SAFE_MARGIN = 0.001;

export const JUMP_SPEED = 6;
export const GRAVITY = 20;
