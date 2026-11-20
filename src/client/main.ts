// Game flow: menu -> night intro -> play (pause) -> result -> next night -> dawn.
// Rules come from src/core (the same code the headless CLI runs); this file only wires input, audio, scene and UI.
import "./style.css";
import contractJson from "../../game.contract.json";
import { DT, WIND_EVERY, WIND_WARN_TICKS } from "../core/constants.js";
import { getNight } from "../core/maps.js";
import type { Contract, GameEvent, InputState, Scenario, Vec3 } from "../core/types.js";
import { createRng } from "../core/rng.js";
import { REVISION } from "three";
import { createWorld, DEFAULT_INPUT, step, timeLeftSeconds, winNeed, type World } from "../core/world.js";
import { GameAudio, type Sfx } from "./audio.js";
import { GameScene } from "./scene.js";
import { loadSettings, saveSettings, type Settings } from "./settings.js";
import { Ui } from "./ui.js";
import { loadBoard, postScore } from "./leaderboard.js";
import "./leaderboard.css";
import "./access.css";

const tuning = (contractJson as Contract).tuning;
type Phase = "menu" | "intro" | "play" | "paused" | "result" | "bench";

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
/** Seed of the current run (new on Start / Restart all). Night n uses runSeed + n. */
let runSeed = seed();

/** A static world behind the menu screens, so the island is visible. */
function backdrop(n: number): void {
  world = createWorld(tuning, seed(), n);
  scene.loadNight(world.map);
  scene.camYaw = 25;
}
function startNight(n: number): void {
  night = n;
  world = createWorld(tuning, (runSeed + n) >>> 0, n);
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
    start() { wins.length = 0; total = 0; runSeed = seed(); showIntro(1); },
    enterNight() { startNight(night); },
    resume() { pauseReq = true; },
    restartNight() { startNight(night); },
    toMenu() { audio.stopMusic(); backdrop(1); phase = "menu"; ui.showScreen("menu"); },
    nextNight() {
      if (night < 3) showIntro(night + 1);
      else { ui.setDawn(total, wins); phase = "menu"; ui.showScreen("dawn"); audio.stopMusic(); }
    },
    restartAll() { wins.length = 0; total = 0; runSeed = seed(); showIntro(1); },
    pickNight(n) { wins.length = 0; total = 0; runSeed = seed(); showIntro(n); },
    loadBoard() { return loadBoard(); },
    submitScore(name) {
      // Saves the run so far: total of won nights, number of won nights, the run's seed.
      // Count only nights actually won (a run started at Night 2 or 3 has holes in wins).
      const nightsWon = wins.filter((x) => x !== undefined).length;
      return postScore({ name, score: total, nights_won: nightsWon, achieved_at: new Date().toISOString(), seed: runSeed });
    },
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
  // Typing in a text box (name entry, sliders) must not move the player or trigger menu shortcuts.
  if (e.target instanceof HTMLInputElement && e.code !== "Escape") return;
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  if (e.repeat) { keys.add(e.code); return; }
  keys.add(e.code);
  if (e.code === "F3") { showFps = !showFps; e.preventDefault(); }
  if (e.code === "Escape" || e.code === settings.keys.pause) {
    if (phase === "play") pauseReq = true;
    else if (ui.screen === "pause") pauseReq = true;
    else if (ui.screen === "settings") document.querySelector<HTMLElement>('#settings [data-act="back"]')?.click();
    else if (ui.screen === "board") document.querySelector<HTMLElement>('#board [data-act="back"]')?.click();
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
  const k = settings.keys; // rebindable (Settings -> Phím điều khiển)
  const x = (keys.has(k.left) ? 1 : 0) - (keys.has(k.right) ? 1 : 0);
  const z = (keys.has(k.up) ? 1 : 0) - (keys.has(k.down) ? 1 : 0);
  input.move = [x, z];
  input.cam_yaw_deg = scene.camYaw;
  input.jump = keys.has(k.jump);
  input.interact = keys.has(k.interact);
  input.pulse = keys.has(k.pulse);
  input.dash = keys.has(k.dash);
}

// ------------------------------------------------------------------ motion effects (off with "Giảm chuyển động")
const fxFlash = document.createElement("div");
fxFlash.id = "fxFlash";
document.body.appendChild(fxFlash);
function restartClass(el: HTMLElement, cls: string): void {
  el.classList.remove(cls);
  void el.offsetWidth; // restart the CSS animation
  el.classList.add(cls);
}
function flashPulse(): void {
  if (!settings.reduceMotion) restartClass(fxFlash, "on");
}
function shake(): void {
  if (!settings.reduceMotion) restartClass(document.getElementById("stage")!, "shake");
}

// ------------------------------------------------------------------ events -> audio / effects
function handleEvents(evs: GameEvent[]): void {
  const sfx: Partial<Record<GameEvent["name"], Sfx>> = {
    mote_picked: "pick", deposit: "pick", refuel: "pick", lantern_lit: "light", lantern_out: "out", player_hit: "hit", dash: "dash", charm_picked: "charm",
    drifter_steal: "steal", shade_spawned: "spawn",
  };
  for (const e of evs) {
    if (e.name === "pulse") { scene.triggerPulse(); audio.play("pulse"); flashPulse(); }
    else if (e.name === "player_hit") { shake(); audio.play("hit"); }
    else if (e.name === "shade_spawned") { ui.cue("Bóng Mực xuất hiện!", 2500); audio.play("spawn"); }
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
  if (phase === "bench" && bench) benchStep(now, dt);
  else if (phase === "play" || phase === "paused") {
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
  if (phase === "bench" && bench) benchCamera(now);
  if (phase !== "menu" && phase !== "intro" && phase !== "bench") {
    ui.updateHud(world, scene, now, fps, showFps);
    if (ui.countdownTick && phase === "play") audio.play("countdown");
  }
  scene.render();
}
// ------------------------------------------------------------------ benchmark (TICKET-04)
// `?bench=1&seed=42&duration=30` shows the fixed bench scene; scripts/bench.mjs opens it and reads window.__ddlBench.
// The scene and the rules it turns off are described in src/core/world.ts (World.bench) and docs/notes/bench.md.
const benchParams = new URLSearchParams(location.search);
const BENCH_WARMUP_MS = 3000;
const BENCH_ORBIT_S = 15;
const BENCH_CAM_R = 30;
const BENCH_CAM_Y = 15;

interface BenchRun {
  t0: number;
  prev: number;
  dts: number[];
  measureFrom: number;
  endAt: number;
  firstFrameEpochMs: number;
  renderer: string;
  seed: number;
  durationS: number;
  done: boolean;
}
let bench: BenchRun | null = null;

/** 200 Shades wandering and 100 motes on land, plus lanterns L1–L3 lit with fuel 100 (seed-based, same for every run). */
function benchScenario(seed: number): Scenario {
  const map = getNight(1);
  const rng = createRng(seed);
  const land: Vec3[] = [];
  while (land.length < 300) {
    const x = (rng() * 2 - 1) * 40;
    const z = (rng() * 2 - 1) * 40;
    const h = map.height(x, z);
    if (h !== null) land.push([Math.round(x * 1000) / 1000, Math.round(h * 1000) / 1000, Math.round(z * 1000) / 1000]);
  }
  return {
    bench: true, random_motes: false, random_shades: false, random_drifters: false, wind_enabled: false,
    player: { pos: [0, map.height(0, 0) ?? 0, 0] },
    motes: land.slice(0, 100).map((pos) => ({ pos })),
    shades: land.slice(100, 300).map((pos) => ({ pos, state: "wander" as const })),
    lanterns: map.lanterns.slice(0, 3).map((l) => ({ id: l.id, lit: true, fuel: 100, ever_lit: true })),
  };
}

function rendererName(): string {
  const gl = scene.renderer.getContext();
  const ext = gl.getExtension("WEBGL_debug_renderer_info");
  const gpu = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : String(gl.getParameter(gl.RENDERER));
  const v = gl instanceof WebGL2RenderingContext ? "WebGL2" : "WebGL1";
  return `three.js ${REVISION} · ${v} · ${gpu}`;
}

function startBench(): void {
  const seed = Number(benchParams.get("seed") ?? 42);
  const durationS = Number(benchParams.get("duration") ?? 30);
  world = createWorld(tuning, seed, 1, benchScenario(seed));
  scene.loadNight(world.map);
  phase = "bench";
  ui.showScreen(null);
  document.getElementById("hud")!.classList.add("hidden");
  bench = { t0: -1, prev: -1, dts: [], measureFrom: 0, endAt: 0, firstFrameEpochMs: 0, renderer: rendererName(), seed, durationS, done: false };
  (window as unknown as { __ddlBench: unknown }).__ddlBench = { done: false };
}

/** Fixed-step simulation (bench rules: only Shades move) and frame-time recording after the warm-up. */
function benchStep(now: number, dt: number): void {
  const b = bench!;
  if (b.t0 < 0) {
    b.t0 = now;
    b.firstFrameEpochMs = performance.timeOrigin + now;
    b.measureFrom = now + BENCH_WARMUP_MS;
    b.endAt = b.measureFrom + b.durationS * 1000;
    b.prev = now;
  }
  acc += dt;
  while (acc >= DT) {
    step(world, { ...DEFAULT_INPUT, move: [0, 0] });
    acc -= DT;
  }
  if (now > b.measureFrom && now <= b.endAt && b.prev >= 0) b.dts.push(now - b.prev);
  b.prev = now;
  if (!b.done && now >= b.endAt) {
    b.done = true;
    (window as unknown as { __ddlBench: unknown }).__ddlBench = {
      done: true, seed: b.seed, duration_s: b.durationS, renderer: b.renderer,
      first_frame_epoch_ms: b.firstFrameEpochMs, dts: b.dts,
    };
  }
}

/** Camera orbit: radius 30 m, height 15 m, looking at (0,0,0), one turn every 15 s, counter-clockwise seen from above, starting at (30,15,0). */
function benchCamera(now: number): void {
  const b = bench!;
  const phi = (2 * Math.PI * ((now - b.t0) / 1000)) / BENCH_ORBIT_S;
  scene.camera.position.set(BENCH_CAM_R * Math.cos(phi), BENCH_CAM_Y, -BENCH_CAM_R * Math.sin(phi));
  scene.camera.lookAt(0, 0, 0);
}

if (benchParams.has("bench")) startBench();

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
