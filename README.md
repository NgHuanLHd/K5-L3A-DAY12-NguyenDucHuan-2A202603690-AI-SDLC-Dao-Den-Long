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

## Luật chơi (Đêm 1 – Đảo Bến)
- Đảo tròn bán kính 40 m, 5 Đèn Lồng Lớn L1…L5 trên vòng 25 m. Mây không thể ra khỏi đảo.
- **Đom đóm:** 20 con rải ngẫu nhiên, cứ 3 giây sinh lại 1 con nếu ít hơn 20. Đi tới gần (≤ 1 m) là nhặt; mang tối đa 5.
- **Thắp đèn (E):** đứng gần đèn chưa sáng (≤ 2 m), bấm E để nạp đom đóm đang mang vào đèn gần nhất. Đèn cần 3 đom đóm; nạp nhiều lần được.
- **Bóng Mực:** con đầu xuất hiện ở mép đảo sau 10 giây, sau đó cứ 20 giây thêm một con (tối đa 4). Chúng đuổi Mây (3 m/s) và không vào được vùng 3 m quanh đèn **đã thắp**.
- **Bị chạm:** mất 1 lửa, đánh rơi một nửa số đom đóm đang mang (làm tròn xuống, mất luôn), bất tử 1,5 giây.
- **Tỏa sáng (F):** tốn 1 đom đóm, hồi 1 giây. Bóng Mực trong 6 m bị choáng 2 giây và bị đẩy lùi 3 m.
- **Thắng:** thắp đủ 5 đèn. **Thua:** hết 3 lửa, hoặc hết 180 giây (trời sáng).

## Cách tính điểm
| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng bởi một lần tỏa sáng | +5 |
| Khi thắng: mỗi giây còn lại (làm tròn xuống) | +1 |
| Khi thắng: mỗi lửa còn lại | +50 |

Thua thì không có điểm thưởng cuối trận. Các số lấy từ `game.contract.json` → `tuning.score`.

## Headless (Test Contract v1.0)
```bash
node dist/headless/cli.js --seed 1 --night 1 --ticks 600 --out out/run.jsonl \
  [--scenario scenarios/smoke/scenario.json] [--inputs scenarios/smoke/inputs.json] [--snapshot-every 10]
```
Mã thoát: 0 thành công · 2 file inputs/scenario sai định dạng · 1 sai tham số.

Mọi trường `tuning` đều được game dùng, trừ:
- `fall_enabled: false`: Mây bị giữ trong đảo, không rơi khỏi mép, nên không bao giờ có `player_hit` với `by: "fall"`.
- `dash` trong inputs được chấp nhận nhưng không có tác dụng (không có lướt ở Phase 1).

Thứ tự xử lý mỗi tick: di chuyển/nhảy → nhặt đom đóm → nạp đèn → tỏa sáng → Bóng Mực di chuyển → Bóng Mực chạm → sinh thêm → hết giờ. Game kết thúc thì bỏ qua phần còn lại của tick đó.

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
