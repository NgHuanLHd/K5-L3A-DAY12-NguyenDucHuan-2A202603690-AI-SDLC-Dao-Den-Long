// Internal constants that are NOT part of the contract tuning.
// Keep contract numbers in game.contract.json only.

export const TICK_RATE = 60;
export const DT = 1 / TICK_RATE;

/** Island "Đảo Bến": round, centred at origin. */
export const ISLAND_RADIUS = 40;
/** Default lanterns L1..L5 on a ring, L1 at +Z. */
export const LANTERN_RING_RADIUS = 25;
/** Random motes spawned at start when scenario does not disable them. */
export const INITIAL_MOTES = 20;

export const JUMP_SPEED = 6;
export const GRAVITY = 20;
