# Đảo Đèn Lồng: agent guide

3D game + headless Test Contract **v1.1** (Phase 2). Specs: `docs/lab/PRD-0.md` (phase 1, contract v1.0 base), `docs/lab/TICKET-02.md` (phase 2: standard numbers, 3 nights, v1.1 changes; overrides PRD-0).
Plan + acceptance criteria: `docs/notes/phase-2-plan.md` (work task by task, T1..T12). Assumptions: `docs/notes/assumptions.md` + plan section 6.

## Commands
- Install + build: `npm ci && npm run build`  (tsc core/headless -> `dist/`, vite web -> `dist-web/`)
- Test (unit + contract): `npm test`
- Headless: `node dist/headless/cli.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl [--scenario f] [--inputs f]`
- Evidence: `npm run build && node scripts/proof.mjs --phase phase-N` (skill `run-proof`)
- Play: `npm start` (after build) or `npm run dev`

## Architecture rules
- `src/core/` = all game rules. NO imports of three/DOM/node. Client and headless both call `step()`.
- `src/headless/` = CLI, parsing, JSONL. `src/client/` = rendering + keyboard only.
- Fixed 60 ticks/s. Step k reads input of tick k, produces state k+1; events carry tick k+1.
- `step()` must follow TICKET-02's 12-step tick order exactly (pause, timers, player move + fall, pickups, interact, safe zone, pulse, shades/drifters move, contacts, spawns, win/lose, snapshot). While paused: tick advances, sim_tick/time/cooldowns/spawns/TTL frozen.
- Maps live in `src/core/maps.ts` (one `NightDef` per night). Angle θ -> `(r*cos θ, y, r*sin θ)`. Standard numbers are fixed by the ticket: never "tune" them.
- Timers are integer ticks (`Math.round(s*60)`); output seconds as `*_s`.
- Shade states exactly: spawning, wander, chase, recoil, stunned. Drifter states: idle, chase, flee, removed.
- Only seeded RNG (`createRng`). Never `Math.random`/`Date.now` in core. Iterate entities in stable order.
- All tuning numbers come from `game.contract.json`. Never hard-code them. Change contract + assumptions together.
- Distances are XZ only; "within r" means `<= r`. Round coordinates to 3 decimals in output.
- Only contract event names: mote_picked, deposit, lantern_lit, pulse, player_hit, shade_spawned, game_over, dash, charm_picked, drifter_steal, drifter_drop, night_start, paused, resumed.
- Phase 1 tests broken by a Phase 2 rule: fix or remove WITH a reason row in `docs/notes/changes.md`. Never silently delete.
- Extras (creative features) must not change headless output; disable them in headless.

## Phase 2 layout and checks
- `src/core/{constants,maps,lighting,types,world}.ts` rules; `src/headless/` CLI; `src/client/{scene,ui,audio,settings,palette,main}.ts` + `style.css` view only.
- Tests: `maps`, `movement`, `items`, `enemies`, `features`, `headless`, `client-pure` (`npm test`, ~120 tests, < 2 s). Scenarios in `scenarios/*/expect.json` support `snapshots: [{tick, path, equals|approx|min|max}]` and `max_seconds`.
- Expected values come from TICKET-02, never from running the code and copying the output.
- UI work: use skill `verify-client` (dev-only `window.__ddl`; the preview pane throttles animation frames).
- Pause: only the `pause` input edge toggles it (client sends one edge per press). While paused `tick` grows, `sim_tick` stays.

## Working rules
- Do not invent requirements. Ambiguity -> add an assumption line in `docs/notes/assumptions.md` and say so.
- Every new rule gets a test in `tests/` and, if behavioural, a scenario in `scenarios/<name>/` with `expect.json`.
- Never finish with red tests (Stop hook enforces). Never write tests that always pass. Never hand-edit `docs/proof/`.
- Small commits, one change each. Do not commit or push unless the user says so.
- Record AI mistakes + token estimate in `docs/notes/ai-log.md`.
