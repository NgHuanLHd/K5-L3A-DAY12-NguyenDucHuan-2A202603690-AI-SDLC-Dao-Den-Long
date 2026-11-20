// Rendering + keyboard only. All rules live in src/core (same code as headless).
import * as THREE from "three";
import contract from "../../game.contract.json";
import { DT, ISLAND_RADIUS } from "../core/constants.js";
import type { Contract, InputState } from "../core/types.js";
import { createWorld, DEFAULT_INPUT, step, timeLeft, type World } from "../core/world.js";

const tuning = (contract as Contract).tuning;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1030);
scene.fog = new THREE.FogExp2(0x1f2a55, 0.018);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 400);

scene.add(new THREE.HemisphereLight(0x8a7bd8, 0x1a1030, 0.6));
const playerLight = new THREE.PointLight(0xffb347, 2, 12);
scene.add(playerLight);

const island = new THREE.Mesh(
  new THREE.CylinderGeometry(ISLAND_RADIUS, ISLAND_RADIUS * 0.8, 4, 64),
  new THREE.MeshStandardMaterial({ color: 0x2e3a2a }),
);
island.position.y = -2;
scene.add(island);

// Mây: body + conical hat (nón lá) + small lantern.
const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.8, 4, 8), new THREE.MeshStandardMaterial({ color: 0x6d8fd6 }));
body.position.y = 0.75;
const hat = new THREE.Mesh(new THREE.ConeGeometry(0.7, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0xd9c27a }));
hat.position.y = 1.55;
const miniLantern = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffb347 }));
miniLantern.position.set(0.55, 1.3, 0);
player.add(body, hat, miniLantern);
scene.add(player);

let world: World;
let lanternMeshes: THREE.Mesh[] = [];
let moteMeshes = new Map<string, THREE.Mesh>();
const moteGeo = new THREE.SphereGeometry(0.15, 8, 8);
const moteMat = new THREE.MeshBasicMaterial({ color: 0xfff1a0 });

function reset(): void {
  for (const m of lanternMeshes) scene.remove(m);
  for (const m of moteMeshes.values()) scene.remove(m);
  world = createWorld(tuning, (Date.now() & 0x7fffffff) >>> 0);
  lanternMeshes = world.lanterns.map((l) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 3, 0.6), new THREE.MeshStandardMaterial({ color: 0x3b2f4a }));
    mesh.position.set(l.pos[0], 1.5, l.pos[2]);
    scene.add(mesh);
    return mesh;
  });
  moteMeshes = new Map();
  input.jump = input.interact = input.pulse = input.dash = false;
}

const keys = new Set<string>();
const input: InputState = { ...DEFAULT_INPUT, move: [0, 0] };
let camYaw = 0;
addEventListener("keydown", (e) => {
  keys.add(e.code);
  if (e.code === "KeyR") reset();
});
addEventListener("keyup", (e) => keys.delete(e.code));

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

const hud = document.getElementById("hud")!;
const msg = document.getElementById("msg")!;

function syncScene(): void {
  const p = world.player.pos;
  player.position.set(p[0], p[1], p[2]);
  player.rotation.y = (camYaw * Math.PI) / 180;
  playerLight.position.set(p[0], p[1] + 1.5, p[2]);
  world.lanterns.forEach((l, i) => {
    const mat = lanternMeshes[i]!.material as THREE.MeshStandardMaterial;
    mat.color.set(l.lit ? 0xffb347 : 0x3b2f4a);
    mat.emissive.set(l.lit ? 0xff8c1a : 0x000000);
  });
  const alive = new Set(world.motes.map((m) => m.id));
  for (const [id, mesh] of moteMeshes) if (!alive.has(id)) { scene.remove(mesh); moteMeshes.delete(id); }
  for (const m of world.motes) {
    let mesh = moteMeshes.get(m.id);
    if (!mesh) { mesh = new THREE.Mesh(moteGeo, moteMat); scene.add(mesh); moteMeshes.set(m.id, mesh); }
    mesh.position.set(m.pos[0], 0.8 + Math.sin(performance.now() / 400 + m.pos[0]) * 0.15, m.pos[2]);
  }
  const t = (camYaw * Math.PI) / 180;
  camera.position.set(p[0] - Math.sin(t) * 8, p[1] + 5, p[2] - Math.cos(t) * 8);
  camera.lookAt(p[0], p[1] + 1, p[2]);

  const lit = world.lanterns.filter((l) => l.lit).length;
  hud.innerHTML =
    `Lửa: ${world.player.flames} · Đom đóm: ${world.player.carried}/${tuning.carry_capacity}<br>` +
    `Đèn: ${lit}/${world.lanterns.length} · Điểm: ${world.score}<br>` +
    `Còn: ${Math.ceil(timeLeft(world))} s`;
  msg.style.display = world.state === "playing" ? "none" : "flex";
  msg.textContent = world.state === "won" ? "Đảo sáng trở lại! (R để chơi lại)" : "Mây đã kiệt sức… (R để chơi lại)";
}

function resize(): void {
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
reset();

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
    step(world, input);
    acc -= DT;
  }
  syncScene();
  renderer.render(scene, camera);
});
