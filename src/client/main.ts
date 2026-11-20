// Rendering + keyboard only. All rules live in src/core (same code as headless).
import * as THREE from "three";
import contract from "../../game.contract.json";
import { DT, ISLAND_RADIUS, TICK_RATE } from "../core/constants.js";
import type { Contract, GameEvent, InputState } from "../core/types.js";
import { createWorld, DEFAULT_INPUT, distXZ, step, timeLeft, type World } from "../core/world.js";

const tuning = (contract as Contract).tuning;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1030);
const fog = new THREE.FogExp2(0x1f2a55, 0.03);
scene.fog = fog;
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

// Night light that grows warmer as lanterns are lit ("đảo sáng dần lên").
const hemi = new THREE.HemisphereLight(0x8a7bd8, 0x1a1030, 0.5);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0x9fb0ff, 0.35);
moon.position.set(-20, 40, -10);
scene.add(moon);
const playerLight = new THREE.PointLight(0xffb347, 3, 10, 1.5);
scene.add(playerLight);

const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.8, 4, 64),
  new THREE.MeshStandardMaterial({ color: 0x3a4a34 }),
);
island.position.y = -2;
scene.add(island);

// Mây: body + conical hat (nón lá) + small lantern.
const player = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0x6d8fd6 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 8), bodyMat);
body.position.y = 0.75;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xd9c27a }));
hat.position.y = 1.55;
const miniLantern = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
miniLantern.position.set(0.55, 1.3, 0);
player.add(body, hat, miniLantern);
scene.add(player);

// Pulse ring effect.
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.9, 1, 48),
  new THREE.MeshBasicMaterial({ color: 0xffd27a, transparent: true, opacity: 0, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2;
scene.add(ring);
let ringAge = Infinity;

interface LanternView { post: THREE.Mesh; lamp: THREE.Mesh; light: THREE.PointLight; zone: THREE.Mesh }
let world: World;
let lanternViews: LanternView[] = [];
let moteMeshes = new Map<string, THREE.Mesh>();
let shadeMeshes = new Map<string, THREE.Mesh>();
const moteGeo = new THREE.SphereGeometry(0.15, 8, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0 });
const shadeGeo = new THREE.SphereGeometry(0.8, 16, 12);
const shadeMat = new THREE.MeshStandardMaterial({ color: 0x1a0a2a, emissive: 0x4b1a7a, emissiveIntensity: 0.6 });
const shadeStunMat = new THREE.MeshStandardMaterial({ color: 0x8a86b8, emissive: 0x6a6aa0, emissiveIntensity: 0.4, transparent: true, opacity: 0.6 });

function clearMap(m: Map<string, THREE.Mesh>): void {
  for (const mesh of m.values()) scene.remove(mesh);
  m.clear();
}

function reset(): void {
  for (const v of lanternViews) scene.remove(v.post, v.lamp, v.light, v.zone);
  clearMap(moteMeshes);
  clearMap(shadeMeshes);
  world = createWorld(tuning, (Date.now() & 0x7fffffff) >>> 0);
  lanternViews = world.lanterns.map((l) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 3, 8), new THREE.MeshStandardMaterial({ color: 0x3b2f4a }));
    post.position.set(l.pos[0], 1.5, l.pos[2]);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.9, 0.7), new THREE.MeshStandardMaterial({ color: 0x2a2236 }));
    lamp.position.set(l.pos[0], 3.3, l.pos[2]);
    const light = new THREE.PointLight(0xff9a3c, 0, 18, 1.2);
    light.position.set(l.pos[0], 3.3, l.pos[2]);
    const zone = new THREE.Mesh(
      new THREE.RingGeometry(tuning.safe_radius - 0.08, tuning.safe_radius, 48),
      new THREE.MeshBasicMaterial({ color: 0xffb347, transparent: true, opacity: 0, side: THREE.DoubleSide }),
    );
    zone.rotation.x = -Math.PI / 2;
    zone.position.set(l.pos[0], 0.02, l.pos[2]);
    scene.add(post, lamp, light, zone);
    return { post, lamp, light, zone };
  });
  for (const k of keys) keys.delete(k);
  ringAge = Infinity;
}

const keys = new Set<string>();
const input: InputState = { ...DEFAULT_INPUT, move: [0, 0] };
let camYaw = 0;
addEventListener("keydown", (e) => {
  if (e.code === "Space" || e.code.startsWith("Arrow")) e.preventDefault();
  keys.add(e.code);
  if (e.code === "KeyR") reset();
});
addEventListener("keyup", (e) => keys.delete(e.code));
addEventListener("blur", () => keys.clear());

function readInput(): void {
  // Camera looks along +Z at yaw 0, so screen-right is -X: D => x = -1.
  const x = (keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0);
  const z = (keys.has("KeyW") ? 1 : 0) - (keys.has("KeyS") ? 1 : 0);
  input.move = [x, z];
  input.cam_yaw_deg = camYaw;
  input.jump = keys.has("Space");
  input.interact = keys.has("KeyE");
  input.pulse = keys.has("KeyF");
}

function onEvents(evs: GameEvent[]): void {
  for (const e of evs) if (e.name === "pulse") ringAge = 0;
}

const $ = (id: string) => document.getElementById(id)!;
const hud = $("hud");
const endEl = $("end");
const replayBtn = $("endReplay") as HTMLButtonElement;
replayBtn.addEventListener("click", () => {
  replayBtn.blur();
  reset();
});

function syncScene(frameDt: number): void {
  const p = world.player.pos;
  const now = performance.now();
  player.position.set(p[0], p[1], p[2]);
  player.rotation.y = (camYaw * Math.PI) / 180;
  // Blink while invulnerable after a hit.
  const invuln = world.tick < world.invulnUntil;
  player.visible = !invuln || Math.floor(now / 100) % 2 === 0;
  playerLight.position.set(p[0], p[1] + 1.5, p[2]);
  playerLight.intensity = 1.5 + world.player.carried * 0.5;

  let lit = 0;
  world.lanterns.forEach((l, i) => {
    const v = lanternViews[i]!;
    const mat = v.lamp.material as THREE.MeshStandardMaterial;
    if (l.lit) lit++;
    const fill = l.lit ? 1 : l.deposited / tuning.lantern_cost;
    mat.color.set(l.lit ? 0xffc069 : 0x2a2236);
    mat.emissive.set(0xff8c1a);
    mat.emissiveIntensity = l.lit ? 1.2 : fill * 0.4;
    v.light.intensity = l.lit ? 6 : fill * 1.5;
    (v.zone.material as THREE.MeshBasicMaterial).opacity = l.lit ? 0.35 : 0;
  });
  hemi.intensity = 0.5 + lit * 0.18;
  hemi.color.setHSL(0.72 - lit * 0.1, 0.5, 0.6);
  fog.density = 0.03 - lit * 0.004;

  const motesAlive = new Set(world.motes.map((m) => m.id));
  for (const [id, mesh] of moteMeshes) if (!motesAlive.has(id)) { scene.remove(mesh); moteMeshes.delete(id); }
  for (const m of world.motes) {
    let mesh = moteMeshes.get(m.id);
    if (!mesh) { mesh = new THREE.Mesh(moteGeo, moteMat); scene.add(mesh); moteMeshes.set(m.id, mesh); }
    mesh.position.set(m.pos[0], 0.8 + Math.sin(now / 400 + m.pos[0]) * 0.15, m.pos[2]);
  }

  const shadesAlive = new Set(world.shades.map((s) => s.id));
  for (const [id, mesh] of shadeMeshes) if (!shadesAlive.has(id)) { scene.remove(mesh); shadeMeshes.delete(id); }
  for (const s of world.shades) {
    let mesh = shadeMeshes.get(s.id);
    if (!mesh) { mesh = new THREE.Mesh(shadeGeo, shadeMat); scene.add(mesh); shadeMeshes.set(s.id, mesh); }
    mesh.material = s.state === "stunned" ? shadeStunMat : shadeMat;
    mesh.position.set(s.pos[0], Math.max(s.pos[1], 0.8) + Math.sin(now / 300 + s.pos[2]) * 0.1, s.pos[2]);
  }

  ringAge += frameDt;
  const rm = ring.material as THREE.MeshBasicMaterial;
  if (ringAge < 0.4) {
    const r = tuning.pulse_radius * (ringAge / 0.4);
    ring.scale.setScalar(Math.max(r, 0.01));
    ring.position.set(p[0], 0.05, p[2]);
    rm.opacity = 0.8 * (1 - ringAge / 0.4);
  } else rm.opacity = 0;

  const t = (camYaw * Math.PI) / 180;
  camera.position.set(p[0] - Math.sin(t) * 8, p[1] + 5, p[2] - Math.cos(t) * 8);
  camera.lookAt(p[0], p[1] + 1, p[2]);

  // HUD
  const near = world.lanterns.find((l) => !l.lit && distXZ(l.pos, p) <= tuning.interact_radius);
  const cd = Math.max(0, (world.pulseReadyAt - world.tick) / TICK_RATE);
  const pulseTxt = world.player.carried < tuning.pulse_cost ? "thiếu ánh sáng" : cd > 0 ? `hồi ${cd.toFixed(1)} s` : "sẵn sàng";
  hud.innerHTML =
    `Lửa: ${"♥".repeat(world.player.flames)}${"·".repeat(Math.max(0, tuning.flames - world.player.flames))}<br>` +
    `Đom đóm: ${world.player.carried}/${tuning.carry_capacity}<br>` +
    `Đèn: ${lit}/${world.lanterns.length} · Điểm: ${world.score}<br>` +
    `Còn: ${Math.ceil(timeLeft(world))} s · Tỏa sáng (F): ${pulseTxt}` +
    (near ? `<br><b>E: nạp đèn ${near.id} (${near.deposited}/${tuning.lantern_cost})</b>` : "");

  syncEndScreen(lit);
}

// Inline SVG (no emoji fonts needed): a glowing lantern on a win, a dark lantern in fog on a loss.
const lantern = (body: string, flame: string, glow: string) =>
  `<svg width="56" height="56" viewBox="0 0 56 56" fill="none">${glow}
  <path d="M28 4v6" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
  <rect x="17" y="10" width="22" height="5" rx="2.5" fill="currentColor"/>
  <path d="M15 18h26c2 9 2 17 0 24H15c-2-7-2-15 0-24z" fill="${body}" stroke="currentColor" stroke-width="3" stroke-linejoin="round"/>
  <rect x="17" y="42" width="22" height="5" rx="2.5" fill="currentColor"/>${flame}</svg>`;
const ICON_LIT = lantern(
  "rgba(255,179,71,0.35)",
  `<path d="M28 21c4 5 5 8 3 11-1 2-5 2-6 0-2-3-1-6 3-11z" fill="#fff1c9"/>`,
  `<circle cx="28" cy="31" r="22" fill="rgba(255,179,71,0.18)"/>`,
);
const ICON_DARK = lantern(
  "rgba(60,40,90,0.5)",
  `<path d="M23 34h10" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.6"/>`,
  `<path d="M6 50c3-4 8-4 11-1 3-5 11-5 14 0 3-3 8-3 11 1z" fill="rgba(155,107,214,0.35)"/>`,
);

let endShown = false;
function syncEndScreen(lit: number): void {
  if (world.state === "playing") {
    if (endShown) {
      endEl.classList.remove("show", "won", "lost");
      endShown = false;
    }
    return;
  }
  if (endShown) return; // fill once per game, so the card is not re-animated every frame
  endShown = true;
  const won = world.state === "won";
  endEl.classList.add("show", won ? "won" : "lost");
  $("endIcon").innerHTML = won ? ICON_LIT : ICON_DARK;
  $("endTitle").textContent = won ? "Đảo sáng trở lại!" : world.endReason === "dawn" ? "Trời đã sáng" : "Mây hết lửa";
  $("endReason").textContent = won
    ? "Mây đã thắp lại cả năm Đèn Lồng Lớn."
    : world.endReason === "dawn"
      ? "Đêm đã hết mà chưa thắp kịp hết các đèn."
      : "Bóng Mực đã dập tắt ngọn lửa cuối cùng của Mây.";
  $("endScore").textContent = String(world.score);
  $("endLanterns").textContent = `${lit}/${world.lanterns.length}`;
  $("endFlames").textContent = String(world.player.flames);
  $("endTime").textContent = `${Math.ceil(timeLeft(world))} s`;
  replayBtn.focus({ preventScroll: true });
}

function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
reset();

// Dev-only hook so an agent/tester can inspect state in the browser. Not in production builds.
if (import.meta.env?.DEV) (window as unknown as { __ddl: unknown }).__ddl = {
    get world() { return world; },
    /** Redraw once (the animation loop is paused while the preview pane is hidden). */
    sync() { syncScene(0); renderer.render(scene, camera); },
  };

// Fixed 60 Hz simulation, render every frame.
let acc = 0;
let last = performance.now();
renderer.setAnimationLoop(() => {
  const now = performance.now();
  const frameDt = Math.min((now - last) / 1000, 0.25);
  last = now;
  acc += frameDt;
  if (keys.has("ArrowLeft")) camYaw += 90 * frameDt;
  if (keys.has("ArrowRight")) camYaw -= 90 * frameDt;
  readInput();
  while (acc >= DT) {
    onEvents(step(world, input));
    acc -= DT;
  }
  syncScene(frameDt);
  renderer.render(scene, camera);
});
