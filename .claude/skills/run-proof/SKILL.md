---
name: run-proof
description: Build the game, run all headless scenarios twice (determinism) against expect.json, and save evidence to docs/proof/<phase>/. Use when verifying a requirement, before tagging a phase, or when asked for proof/evidence.
---

# run-proof

1. `npm run build` (must succeed).
2. `npm test` (must be green).
3. `node scripts/proof.mjs --phase phase-N` (N = current phase). It:
   - runs `headless_cmd` from `game.contract.json` for every `scenarios/<name>/` that has `expect.json`;
   - runs each twice and fails if outputs differ;
   - checks `end_state`, `end_ticks`, `end_score`, `events`, `absent_events`, `player_pos_at_end`, `exit_code`;
   - writes `<name>.jsonl` and `RESULTS.md` (with commit hash) into `docs/proof/phase-N/`.
4. Update the traceability table in `docs/proof/phase-N/README.md` (requirement -> scenario/test -> file -> PASS/FAIL).
   Write FAIL honestly with a reason. Never edit generated `.jsonl`/`RESULTS.md` by hand.

## Adding a scenario
Create `scenarios/<name>/` with `scenario.json` (Test Contract D), `inputs.json` (C), and:

```json
{ "description": "what requirement this proves", "seed": 1, "ticks": 300,
  "expect": { "end_state": "playing", "events": ["mote_picked"], "absent_events": ["player_hit"] } }
```
Set `"expect": { "exit_code": 2 }` for invalid-input scenarios.
Derive expected values from the spec and `game.contract.json`, not from running the code.
