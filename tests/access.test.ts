// TICKET-04 accessibility: rebindable keys (conflict detection, reserved keys, reset) and saved flags.
import { describe, expect, it } from "vitest";
import { ACTIONS, DEFAULT_KEYS, DEFAULT_SETTINGS, isBindable, keyConflict, parseSettings } from "../src/client/settings.js";

describe("key bindings", () => {
  it("defaults cover every action with distinct keys", () => {
    expect(Object.keys(DEFAULT_KEYS).sort()).toEqual([...ACTIONS].sort());
    expect(new Set(Object.values(DEFAULT_KEYS)).size).toBe(ACTIONS.length);
  });

  it("reports the action already using a key (conflict), but not the action itself", () => {
    expect(keyConflict(DEFAULT_KEYS, "jump", "KeyW")).toBe("up");
    expect(keyConflict(DEFAULT_KEYS, "up", "KeyW")).toBeNull();
    expect(keyConflict(DEFAULT_KEYS, "dash", "KeyZ")).toBeNull();
  });

  it("Escape and the arrow keys cannot be bound; letters and Shift can", () => {
    expect(isBindable("Escape")).toBe(false);
    expect(isBindable("ArrowLeft")).toBe(false);
    expect(isBindable("KeyJ")).toBe(true);
    expect(isBindable("ShiftLeft")).toBe(true);
    expect(isBindable("Space")).toBe(true);
    expect(isBindable("bad code!")).toBe(false);
  });

  it("saved bindings survive a round trip", () => {
    const keys = { ...DEFAULT_KEYS, jump: "KeyQ" };
    const parsed = parseSettings(JSON.stringify({ keys }));
    expect(parsed.keys.jump).toBe("KeyQ");
    expect(parsed.keys.up).toBe("KeyW");
  });

  it("an invalid binding falls back to that action's default", () => {
    const parsed = parseSettings(JSON.stringify({ keys: { jump: "Escape", up: 7 } }));
    expect(parsed.keys.jump).toBe(DEFAULT_KEYS.jump);
    expect(parsed.keys.up).toBe(DEFAULT_KEYS.up);
  });

  it("a stored map with two actions on one key is replaced by the defaults", () => {
    const parsed = parseSettings(JSON.stringify({ keys: { ...DEFAULT_KEYS, jump: "KeyW" } }));
    expect(parsed.keys).toEqual(DEFAULT_KEYS);
  });
});

describe("accessibility flags", () => {
  it("default off, and saved when set", () => {
    expect(DEFAULT_SETTINGS.reduceMotion).toBe(false);
    expect(DEFAULT_SETTINGS.largeText).toBe(false);
    expect(parseSettings(JSON.stringify({ reduceMotion: true })).reduceMotion).toBe(true);
    expect(parseSettings(JSON.stringify({ largeText: "yes" })).largeText).toBe(false);
  });
});
