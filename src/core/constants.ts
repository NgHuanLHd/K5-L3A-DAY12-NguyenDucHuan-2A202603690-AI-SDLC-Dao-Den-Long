// Standard numbers from docs/lab/TICKET-02.md that are NOT part of contract tuning.
// Contract numbers live in game.contract.json only. Do not "tune" any of these.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;
/** Tolerance so "within r" (<= r) is robust to float error. */
export const EPS = 1e-9;
export const toTicks = (s: number): number => Math.round(s * TICK_RATE);

// Movement
export const ACCEL_TIME_S = 0.1; // reach/leave full speed in 0.1 s (6 ticks)
export const JUMP_SPEED = 7;
export const GRAVITY = 20;
export const STEP_UP = 0.3; // max ledge the player/shade walks onto
export const STEP_DOWN = 0.3; // stays glued to ground when walking down slopes
export const FALL_Y = -10;
export const RESPAWN_WAIT_TICKS = 60;
export const INVULN_AFTER_RESPAWN_TICKS = 90;

// Pickups
export const PICK_DY = 1.5; // max height difference for pickups and contacts
export const MOTE_START = 20;
export const MOTE_MAX = 30;
export const MOTE_SPAWN_EVERY = 240;
export const DROPPED_TTL = 480;
export const DROP_RING_MIN = 1.5;
export const DROP_RING_MAX = 2.5;

// Pulse
export const PULSE_CENTER_UP = 0.8;
export const PULSE_PUSH_TICKS = 15;

// Shades
export const SHADE_DETECT = 12;
export const SHADE_LOSE = 18;
export const SHADE_CENTER_UP = 1.0; // shade centre = foot height + 1
export const SHADE_RECOIL_M = 2;
export const SHADE_RECOIL_TICKS = 60;
export const SHADE_FIRST_SPAWN_TICK = 300;
export const SHADE_FIRST_SPAWN_COUNT = 2;
export const SHADE_SPAWN_MIN_PLAYER_DIST = 15;
export const SHADE_WANDER_FACTOR = 0.5;
export const SAFE_EVICT_TICKS = 30;
export const SAFE_EPS = 1e-6;

// Drifters (Gió Lạc)
export const DRIFTER_SPEED = 7;
export const DRIFTER_IDLE_SPEED = 2;
export const DRIFTER_MAX = 2;
export const DRIFTER_SPAWN_EVERY = 1200;
export const DRIFTER_CHASE_CARRIED = 5;
export const DRIFTER_CHASE_DIST = 15;
export const DRIFTER_STEAL_DIST = 1.2;
export const DRIFTER_STEAL_AMOUNT = 3;
export const DRIFTER_FLEE_TICKS = 240;
export const DRIFTER_DROP_VANISH_TICKS = 120;
export const DRIFTER_HEIGHT = 1.5;

// Charm (Bùa Gió)
export const CHARM_TICKS = 600;
export const CHARM_RESPAWN_TICKS = 2700;
export const CHARM_SPEED = 7.2;

// Wind (Night 3)
export const WIND_EVERY = 1800; // 30 s
export const WIND_TICKS = 300; // 5 s
export const WIND_WARN_TICKS = 120; // 2 s (client warning only)
export const WIND_SPEED = 2;
