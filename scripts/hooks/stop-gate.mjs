#!/usr/bin/env node
// Claude Code Stop hook: block the agent from finishing while tests are red.
// - Runs only when code/contract/tests changed vs HEAD (cheap on pure chat turns).
// - Exit 2 + stderr => Claude must keep working and sees the failure.
// - If already re-prompted once (stop_hook_active), let it stop to avoid loops, but warn.
import { execSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..", "..");
let payload = {};
try {
  payload = JSON.parse(await new Promise((r) => {
    let s = "";
    process.stdin.on("data", (d) => (s += d));
    process.stdin.on("end", () => r(s || "{}"));
  }));
} catch {}

let changed = true;
try {
  const out = execSync("git status --porcelain -- src tests scenarios game.contract.json", { cwd: root, encoding: "utf8" });
  changed = out.trim().length > 0;
} catch {}
if (!changed) process.exit(0);

const r = spawnSync("npm", ["test", "--silent"], { cwd: root, encoding: "utf8", shell: true });
if (r.status === 0) process.exit(0);

const tail = `${r.stdout}\n${r.stderr}`.trim().split("\n").slice(-40).join("\n");
if (payload.stop_hook_active) {
  process.stderr.write(`WARNING: tests still failing after one retry. Tell the user honestly.\n${tail}\n`);
  process.exit(0);
}
process.stderr.write(`Tests are failing. Fix them (do not weaken tests) before finishing.\n${tail}\n`);
process.exit(2);
