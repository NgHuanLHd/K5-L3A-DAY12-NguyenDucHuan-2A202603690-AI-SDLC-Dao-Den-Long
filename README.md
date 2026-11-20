# Đảo Đèn Lồng

> **Video demo:** _(link sẽ thêm ở Phase 4)_
> Day 12 AI SDLC · Nguyễn Đức Huân · 2A202603690. Đề bài: [lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW), spec Phase 1: [docs/lab/PRD-0.md](docs/lab/PRD-0.md).

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại 5 Đèn Lồng Lớn và né Bóng Mực trong sương đen.

## Cài và chạy (macOS / Linux, Node ≥ 20)
```bash
npm ci
npm run build
npm start          # mở http://localhost:5173
```

## Điều khiển
| Phím | Hành động |
|---|---|
| W A S D | Đi |
| Space | Nhảy |
| E | Nạp ánh sáng vào đèn |
| F | Tỏa sáng xua Bóng Mực |
| ← / → | Xoay camera |
| R | Chơi lại |

## Cách tính điểm
_(Phase 1: điền sau khi làm luật.)_ Theo `game.contract.json` → `tuning.score`: mỗi đom đóm `per_mote`, mỗi đèn thắp `per_lantern`, mỗi Bóng Mực bị choáng `per_stun`, cuối trận cộng `per_second_left` × giây còn lại và `per_flame_left` × lửa còn lại.

## Headless (Test Contract v1.0)
```bash
node dist/headless/cli.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl \
  [--scenario scenarios/smoke/scenario.json] [--inputs scenarios/smoke/inputs.json] [--snapshot-every 10]
```
Mã thoát: 0 thành công · 2 file inputs/scenario sai định dạng · 1 sai tham số.

Các trường tuning không dùng:
- `fall_enabled: false`: đảo không có rơi khỏi mép, nên không có `player_hit` với `by: "fall"`.

## Kiểm chứng
```bash
npm test                                  # unit + contract tests
node scripts/proof.mjs --phase phase-1    # chạy scenarios 2 lần, lưu docs/proof/phase-1/
```
CI chạy build, test và proof trên Ubuntu và macOS mỗi lần push (`.github/workflows/ci.yml`).

## Cấu trúc
| Đường dẫn | Nội dung |
|---|---|
| `src/core/` | Toàn bộ luật game, thuần TypeScript, dùng chung cho game và headless |
| `src/headless/` | CLI theo Test Contract |
| `src/client/` | Hiển thị Three.js, bàn phím, HUD |
| `tests/`, `scenarios/` | Test và scenario headless |
| `docs/notes/` | Giả định, tiêu chí nghiệm thu, nhật ký AI, thay đổi, retro |
| `docs/proof/` | Bằng chứng từng phase |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Harness AI: hướng dẫn agent, skill `run-proof`, hook Stop chặn khi test đỏ |

## Sáng tạo của tôi
_(chưa có)_
