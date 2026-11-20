// Game flow: menu -> night intro -> play (pause) -> result -> next night -> dawn.
// Rules come from src/core (the same code the headless CLI runs); this file only wires input, audio, scene and UI.
import "./style.css";
import contractJson from "../../game.contract.json";
import { DT, WIND_EVERY, WIND_WARN_TICKS } from "../core/constants.js";
import { getNight } from "../core/maps.js";
import type { Contract, GameEvent, InputState } from "../core/types.js";
import { createWorld, DEFAULT_INPUT, step, timeLeftSeconds, winNeed, type World } from "../core/world.js";
import { GameAudio, type Sfx } from "./audio.js";
import { GameScene } from "./scene.js";
import { loadSettings, saveSettings, type Settings } from "./settings.js";
import { Ui } from "./ui.js";

const tuning = (contractJson as Contract).tuning;
type Phase = "menu" | "intro" | "play" | "paused" | "result";

let settings: Settings = loadSettings();
const audio = new GameAudio();
audio.setVolume(settings.volume);
const scene = new GameScene(document.getElementById("stage")!);
scene.setColorBlind(settings.colorblind);

let phase: Phase = "menu";
let night = 1;
let total = 0;
const wins: number[] = [];
let world: World;
let pauseReq = false;
let showFps = new URLSearchParams(location.search).has("fps");

const seed = () => (Math.random() * 0x7fffffff) >>> 0;

/** A static world behind the menu screens, so the island is visible. */
function backdrop(n: number): void {
  world = createWorld(tuning, seed(), n);
  scene.loadNight(world.map);
  scene.camYaw = 25;
}
function startNight(n: number): void {
  night = n;
  world = createWorld(tuning, seed(), n);
  scene.loadNight(world.map);
  scene.camYaw = 0;
  for (const k of keys) keys.delete(k);
  Object.assign(input, DEFAULT_INPUT, { move: [0, 0] });
  pauseReq = false;
  phase = "play";
  ui.showScreen(null);
  audio.startMusic();
}
function showIntro(n: number): void {
  night = n;
  backdrop(n);
  ui.setIntro(getNight(n));
  phase = "intro";
  ui.showScreen("intro");
}

const ui = new Ui(
  {
    start() { wins.length = 0; total = 0; showIntro(1); },
    enterNight() { startNight(night); },
    resume() { pauseReq = true; },
    restartNight() { startNight(night); },
    toMenu() { audio.stopMusic(); backdrop(1); phase = "menu"; ui.showScreen("menu"); },
    nextNight() {
      if (night < 3) showIntro(night + 1);
      else { ui.setDawn(total, wins); phase = "menu"; ui.showScreen("dawn"); audio.stopMusic(); }
    },
    restartAll() { wins.length = 0; total = 0; showIntro(1); },
    settingsChanged(s) { settings = s; audio.setVolume(s.volume); saveSettings(s); scene.setColorBlind(s.colorblind); },
    click() { audio.play("ui"); },
  },
  settings,
);

// ------------------------------------------------------------------ input
const keys = new Set<string>();
const input: InputState = { ...DEFAULT_INPUT, move: [0, 0] };
let dragging = false;

addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  if (e.code === "F3") { showFps = !showFps; e.preventDefault(); }
  if (e.code === "Escape" || e.code === "KeyP") {
    if (phase === "play") pauseReq = true;
    else if (ui.screen === "pause") pauseReq = true;
    else if (ui.screen === "settings") document.querySelector<HTMLElement>('#settings [data-act="back"]')?.click();
    return;
  }
  if (e.code === "Enter" && ui.screen && ui.screen !== "settings" && ui.screen !== "pause") {
    document.querySelector<HTMLElement>(`#${ui.screen} button.primary`)?.click();
  }
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());
const stage = document.getElementById("stage")!;
stage.addEventListener("pointerdown", (e) => { dragging = true; stage.setPointerCapture(e.pointerId); });
stage.addEventListener("pointerup", () => { dragging = false; });
stage.addEventListener("pointermove", (e) => { if (dragging && (phase === "play" || phase === "menu" || phase === "intro")) scene.camYaw -= e.movementX * 0.3 * settings.sensitivity; });
stage.addEventListener("contextmenu", (e) => e.preventDefault());

function readInput(): void {
  // Camera looks along +Z at yaw 0, so screen-right is -X: D => x = -1.
  const x = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
  const z = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  input.move = [x, z];
  input.cam_yaw_deg = scene.camYaw;
  input.jump = keys.has("Space");
  input.interact = keys.has("KeyE");
  input.pulse = keys.has("KeyF");
  input.dash = keys.has("ShiftLeft") || keys.has("ShiftRight");
}

// ------------------------------------------------------------------ events -> audio / effects
function handleEvents(evs: GameEvent[]): void {
  const sfx: Partial<Record<GameEvent["name"], Sfx>> = {
    mote_picked: "pick", deposit: "pick", refuel: "pick", lantern_lit: "light", lantern_out: "out", player_hit: "hit", dash: "dash", charm_picked: "charm",
    drifter_steal: "steal", shade_spawned: "spawn",
  };
  for (const e of evs) {
    if (e.name === "pulse") { scene.triggerPulse(); audio.play("pulse"); }
    else if (e.name === "game_over") audio.play(e.data.result === "won" ? "win" : "lose");
    else {
      const s = sfx[e.name];
      if (s) audio.play(s);
    }
  }
}

/** The ticket warns of a gust 2 s ahead with flying leaves (scene) and a sound (here), once per gust. */
function windWarning(): void {
  if (world.state !== "playing" || !world.windEnabled) return;
  if (WIND_EVERY - (world.simTick % WIND_EVERY) === WIND_WARN_TICKS) audio.play("wind");
}

function afterStep(): void {
  if (phase === "play" && world.state === "paused") { phase = "paused"; ui.showScreen("pause"); }
  else if (phase === "paused" && world.state === "playing") { phase = "play"; ui.showScreen(null); }
  else if (phase === "play" && (world.state === "won" || world.state === "lost")) {
    phase = "result";
    const won = world.state === "won";
    if (won) { total += world.score; wins[night - 1] = world.score; }
    ui.setResult({
      won, reason: world.endReason ?? "", night, score: world.score, total, lit: world.lanterns.filter((l) => l.lit).length,
      lanterns: world.lanterns.length, flames: world.player.flames, timeLeft: timeLeftSeconds(world), isLast: night === 3,
      need: winNeed(world),
    });
    ui.showScreen("result");
  }
}

// ------------------------------------------------------------------ loop
function resize(): void {
  scene.resize(innerWidth, innerHeight);
}
addEventListener("resize", resize);
resize();
backdrop(1);
ui.showScreen("menu");

let acc = 0;
let last = performance.now();
let frames = 0;
let fpsStart = last;
let fps = 60;

function frame(now: number): void {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  frames++;
  if (now - fpsStart >= 500) {
    fps = (frames * 1000) / (now - fpsStart);
    frames = 0;
    fpsStart = now;
    (window as unknown as { __ddlFps: number }).__ddlFps = fps;
  }
  if (keys.has("ArrowLeft")) scene.camYaw += 90 * settings.sensitivity * dt;
  if (keys.has("ArrowRight")) scene.camYaw -= 90 * settings.sensitivity * dt;
  if (phase === "play" || phase === "paused") {
    acc += dt;
    readInput();
    while (acc >= DT) {
      const p = world.player;
      const wasGrounded = p.grounded;
      input.pause = pauseReq;
      pauseReq = false;
      const simBefore = world.simTick;
      handleEvents(step(world, input));
      if (world.simTick !== simBefore) windWarning(); // not while paused (sim_tick frozen)
      if (wasGrounded && !p.grounded && p.vel[1] > 3 && !p.launched) audio.play("jump");
      acc -= DT;
      afterStep();
      if (phase !== "play" && phase !== "paused") break;
    }
  } else acc = 0;
  scene.update(world, dt, now);
  if (phase !== "menu" && phase !== "intro") {
    ui.updateHud(world, scene, now, fps, showFps);
    if (ui.countdownTick && phase === "play") audio.play("countdown");
  }
  scene.render();
}
scene.renderer.setAnimationLoop((t) => frame(t));

// Dev-only hook for automated browser checks (the animation loop pauses while the preview pane is hidden).
if (import.meta.env?.DEV) {
  (window as unknown as { __ddl: unknown }).__ddl = {
    get world() { return world; },
    get phase() { return phase; },
    ui,
    scene,
    startNight,
    /** Redraw once. */
    sync() { scene.update(world, 0.016, performance.now()); if (phase !== "menu" && phase !== "intro") ui.updateHud(world, scene, performance.now(), fps, showFps); afterStep(); scene.render(); },
    /** Advance the simulation by n steps without waiting for animation frames. */
    advance(n: number) { for (let i = 0; i < n; i++) { handleEvents(step(world, input)); afterStep(); } },
  };
}
