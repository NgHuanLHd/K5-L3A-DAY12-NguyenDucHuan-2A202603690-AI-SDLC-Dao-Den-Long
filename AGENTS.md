# Đảo Đèn Lồng: agent guide

3D game + headless Test Contract v1.0. Spec: `docs/lab/PRD-0.md` (phase 1). Assumptions: `docs/notes/assumptions.md`.

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
- Only seeded RNG (`createRng`). Never `Math.random`/`Date.now` in core. Iterate entities in stable order.
- All tuning numbers come from `game.contract.json`. Never hard-code them. Change contract + assumptions together.
- Distances are XZ only; "within r" means `<= r`. Round coordinates to 3 decimals in output.
- Only contract event names: mote_picked, deposit, lantern_lit, pulse, player_hit, shade_spawned, game_over.
- Extras (creative features) must not change headless output; disable them in headless.

## Working rules
- Do not invent requirements. Ambiguity -> add an assumption line in `docs/notes/assumptions.md` and say so.
- Every new rule gets a test in `tests/` and, if behavioural, a scenario in `scenarios/<name>/` with `expect.json`.
- Never finish with red tests (Stop hook enforces). Never write tests that always pass. Never hand-edit `docs/proof/`.
- Small commits, one change each. Do not commit or push unless the user says so.
- Record AI mistakes + token estimate in `docs/notes/ai-log.md`.
