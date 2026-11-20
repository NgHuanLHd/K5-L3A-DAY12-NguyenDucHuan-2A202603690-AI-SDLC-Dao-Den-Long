# Đảo Đèn Lồng

> **Video demo:** _(link sẽ thêm ở Phase 4)_
> Day 12 AI SDLC · Nguyễn Đức Huân · 2A202603690. Đề bài: [lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW) · spec: [PRD-0](docs/lab/PRD-0.md), [TICKET-02](docs/lab/TICKET-02.md).

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi, gom đom đóm để thắp lại các Đèn Lồng Lớn trên **ba hòn đảo** (Đảo Bến, Đảo Cau, Đảo Chuông), né Bóng Mực và Gió Lạc trong sương đen. Phase 2: số liệu chuẩn, 3 Đêm, lướt, bục nhảy, gió, Bùa Gió, tạm dừng, cài đặt, âm thanh, HUD đầy đủ.

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
| Space | Nhảy (chỉ khi chạm đất) |
| Shift | Lướt (14 m/s trong 0.2 s, hồi 1.5 s) |
| E | Nạp ánh sáng vào đèn gần nhất chưa sáng (trong 2 m) |
| F | Tỏa Sáng (tốn 3 đom đóm, hồi 3 s) |
| ← / → hoặc kéo chuột | Xoay camera (độ nhạy chuột chỉnh trong Cài đặt) |
| Esc hoặc P | Tạm dừng (Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu) |
| F3 | Hiện/ẩn FPS |

## Luật chơi
- **Ba Đêm:** Đêm 1 Đảo Bến (240 s, 5 đèn), Đêm 2 Đảo Cau (270 s, 6 đèn, hai đảo nối bằng cầu tre và hai bục nhảy), Đêm 3 Đảo Chuông (300 s, 7 đèn, ba tầng, dốc, tháp chuông, gió mạnh). Mỗi Đêm Mây có 3 Ngọn Lửa.
- **Đom đóm:** nhặt tự động trong 1 m (chênh cao ≤ 1.5 m). Sức chứa là 10 + 2 × số lần thắp thành công, tối đa 20.
- **Đèn và dầu (Phase 3):** đèn thắp lần đầu cần 10 đom đóm, thắp lại cần 5. Đèn sáng hao 1 dầu/s; châm 10 dầu cho mỗi đom đóm (tối đa 100). Về 0 dầu thì đèn tắt, và phải thắp lại. Đèn dưới 30 dầu nhấp nháy và mất vùng an toàn.
- **Bóng Mực:** đuổi khi Mây trong 12 m, bỏ đuổi sau 18 m, tốc độ 4 m/s (Đêm 3: 4,5). Bóng lang thang tới đèn sáng dưới 30 dầu gần nhất; trong 2 m thì đứng yên và hút 5 dầu/s. Chạm Mây: −1 Ngọn Lửa, rơi một nửa số đom đóm đang mang, bất tử 1,5 s.
- **Tỏa Sáng:** bóng trong 5 m (tính 3D) choáng 2 s và bị đẩy lùi 4 m.
- **Rơi khỏi đảo** (Y < −10): −1 Ngọn Lửa, mất hết đom đóm, chờ 1 giây rồi hồi sinh ở điểm xuất phát (bất tử 1.5 s).
- **Gió Lạc** (Đêm 2, 3): dải lụa xám xanh, thấy Mây mang ≥ 5 đom đóm trong 15 m thì lao tới cướp 3 đom đóm rồi bỏ chạy; Tỏa Sáng làm nó bỏ chạy hoặc thả đồ lại.
- **Bùa Gió:** nhặt để chạy 7.2 m/s và lướt không hồi chiêu trong 10 giây; bùa xuất hiện lại sau 45 giây.
- **Bục nhảy:** đứng lên bục để bị bắn lên và qua đảo/tầng khác (Đêm 2, 3).
- **Gió mạnh** (Đêm 3): mỗi 30 giây một cơn gió 5 giây đẩy Mây 2 m/s, báo trước 2 giây bằng lá bay.
- **Thắng/thua (Phase 3):** không còn thắng sớm. Hết lửa là thua ngay. Khi hết giờ (bình minh), thắng nếu còn ít nhất ceil(0,6 × tổng đèn) đèn sáng (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7); ngược lại thua. Thua thì chơi lại Đêm đó.

## Cách tính điểm (Phase 3)
| Sự kiện | Điểm |
|---|---|
| Nạp hoặc châm 1 đom đóm vào đèn | +5 |
| Thắp lần đầu | +100 |
| Thắp lại | +40 |
| Bóng Mực trúng Tỏa Sáng | +5 mỗi con; +15 nếu con đó đang hút |
| Bình minh (chỉ khi thắng): mỗi đèn đang sáng | +50 + dầu còn lại (làm tròn xuống) |
| Bình minh (chỉ khi thắng): mỗi Ngọn Lửa còn lại | +50 |

Không còn thưởng theo thời gian. Tổng điểm game = tổng điểm các Đêm đã thắng. Số lấy từ `game.contract.json` → `tuning.score`.

## Headless (Test Contract v1.1)
```bash
node dist/headless/cli.js --seed 1 --night 2 --ticks 600 --out out/run.jsonl \
  [--scenario scenarios/pad-n2/scenario.json] [--inputs scenarios/pad-n2/inputs.json] [--snapshot-every 10]
```
- `--night` nhận 1, 2, 3. Mã thoát: 0 thành công · 2 file inputs/scenario sai định dạng · 1 sai tham số.
- Input có `dash` và `pause`; scenario có `drifters`, `charms`, `random_drifters`, `wind_enabled`, `player.{invuln_ticks, dash_cd_ticks, pulse_cd_ticks, charm_ticks}`, `shades[].{state, state_ticks_left}`.
- Output có `night_start` ngay sau snapshot tick 0; trong lúc tạm dừng `tick` vẫn tăng còn `sim_tick` đứng yên.
- Một Đêm đầy đủ (21 600 tick) chạy khoảng 0.3 giây.
- Giả định cho chỗ ticket không nói: [docs/notes/assumptions.md](docs/notes/assumptions.md) (mục Phase 2). Đáng chú ý: Đêm 3 xuất phát ở (0,0,−30) vì (0,0,0) nằm trong tháp chuông.

`game.contract.json` khớp số chuẩn của TICKET-02; `fall_enabled` là `true` (rơi khỏi đảo bị phạt) và `dash_*` là các khóa mới của v1.1.

## Kiểm chứng
```bash
npm test                                  # ~120 test: bản đồ, di chuyển, đồ vật, kẻ địch, tính năng mới, contract
node scripts/proof.mjs --phase phase-2    # 23 scenario, mỗi cái chạy 2 lần, lưu docs/proof/phase-2/
```
CI chạy build, test và proof trên Ubuntu và macOS mỗi lần push (`.github/workflows/ci.yml`). Bảng truy vết và số đo: [docs/proof/phase-2/](docs/proof/phase-2/README.md).

## Cấu trúc
| Đường dẫn | Nội dung |
|---|---|
| `src/core/` | Toàn bộ luật game và bản đồ, thuần TypeScript, dùng chung cho game và headless |
| `src/headless/` | CLI theo Test Contract |
| `src/client/` | Hiển thị Three.js, giao diện, âm thanh, cài đặt, bảng màu |
| `tests/`, `scenarios/` | Test và scenario headless |
| `docs/notes/` | Giả định, kế hoạch Phase 2, tiêu chí nghiệm thu, nhật ký AI, thay đổi yêu cầu, retro |
| `docs/proof/` | Bằng chứng từng phase |
| `AGENTS.md`, `CLAUDE.md`, `.claude/` | Harness AI: hướng dẫn agent, skill `run-proof` và `verify-client`, hook Stop chặn khi test đỏ |

## Quyết định thiết kế và thay đổi
- Phase 3 đổi luật thắng và mô hình đèn: xem [ADR-001](docs/notes/adr-001-lantern-fuel.md) và [changelog](docs/notes/changelog-phase3.md) (danh sách phá vỡ tương thích).

## Chưa đạt hoặc chưa kiểm chứng (Phase 2–3)
- Âm thanh chưa được nghe thử (môi trường kiểm tra không có loa); màu pixel chưa đo; chưa chơi tay một ván thật qua cả ba Đêm. Chi tiết trong [bằng chứng Phase 2](docs/proof/phase-2/README.md).

## Sáng tạo của tôi
_(chưa có)_
