# Thay đổi yêu cầu và thiết kế

Mỗi lần ticket đổi luật: luật cũ → luật mới, file/test bị ảnh hưởng, đã sửa hoặc bỏ test nào và vì sao.

## Phase 2 (TICKET-02, Contract v1.1)

Ticket yêu cầu **thay mọi giá trị tự chọn bằng số chuẩn** và đổi nhiều luật của Phase 1. Không có test nào bị tắt âm thầm: các test cũ được viết lại theo luật mới, lý do ở bảng dưới.

| # | Luật Phase 1 | Luật Phase 2 (ticket) | Ảnh hưởng | Xử lý test |
|---|---|---|---|---|
| 1 | Tuning tự chọn (speed 5, cost 3, 180 s…) | Số chuẩn: 6 m/s, cost 10, capacity 10, 300/330/360 s… | `game.contract.json`, mọi test dùng số cứng | Test đọc `T` từ contract; số cứng được viết lại theo ticket |
| 2 | Contract v1.0 | v1.1: thêm 5 khóa tuning, `--night 1..3`, snapshot/scenario/input/event mới | `parse.ts`, `run.ts`, `snapshot()` | `headless.test.ts` viết lại cho v1.1 |
| 3 | +10 điểm khi **nhặt** đom đóm | +10 mỗi đom đóm **nạp** | `world.ts` | Test `pickup` đổi: nhặt không có điểm (AC-07 cũ → mới); scenario `pickup`, `light-and-win` đổi kỳ vọng |
| 4 | Mây bị giữ trong đảo, `fall_enabled: false` | Rơi khỏi đảo (Y < −10): −1 lửa, mất hết đom đóm, chờ 60 tick rồi hồi sinh | `world.ts`, contract (`fall_enabled: true`) | Test "Island boundary" của Phase 1 **bỏ** (mâu thuẫn trực tiếp với luật mới), thay bằng nhóm test "Falling off the island" |
| 5 | Vận tốc tức thời, nhảy 6 m/s | Tăng tốc/dừng 6 tick, nhảy 7 m/s, g = 20, lướt, bục nhảy, gió | `movePlayer()` | Test di chuyển viết lại: quãng đường 60 tick là 5.75 m, không phải 6 m |
| 6 | Tỏa sáng: XZ ≤ 6, tốn 1, đẩy tức thời, choáng 2 s | 3D từ chân + 0.8 m, ≤ 5 m, tốn 3, hồi 3 s, đẩy 4 m trong 15 tick | `pulse()` | Test Pulse viết lại; scenario `pulse-stun` đổi (4.9 m, carried 3) |
| 7 | Bóng Mực: `chase`/`stunned`, đuổi luôn | 5 trạng thái, phát hiện 12 m, bỏ đuổi 18 m, recoil 2 m/60 tick, sinh theo điểm chuẩn | `moveEnemies()`, `spawns()` | Test Shades viết lại; thêm kiểm tra tên trạng thái |
| 8 | Vùng an toàn 3 m, bóng bị đẩy tức thời | 6 m; bóng trong vùng khi đèn vừa thắp bị đẩy ra ≤ 30 tick và không gây sát thương | `safeZones()`, `clampSafe()` | `safe-zone` đổi (z = 14); thêm scenario `safe-eviction` |
| 9 | Đom đóm rơi khi bị đánh: mất hẳn | Rơi ra vành 1.5–2.5 m, `kind: dropped`, TTL 480 tick, nhặt lại được | `dropMotes()` | Thêm test vành, TTL |
| 10 | Đom đóm ngẫu nhiên 3–38 m, sinh lại mỗi 3 s | 20 trên 20 điểm chuẩn khác nhau, trần 30, sinh tại tick 240k ở điểm trống | `createWorld()`, `spawns()` | Test mới theo bản đồ chuẩn |
| 11 | Thắng chỉ xét khi thắp đèn; thưởng ×1/giây | Xét sau mỗi tick: hết lửa > thắng > hết giờ; thưởng ×2/giây; thắng kể cả đúng tick hết giờ | `checkEnd()` | Scenario đặt sẵn đủ 5 đèn sáng giờ **thắng ở tick 1** (A10 cũ bị thay); test điểm viết lại |
| 12 | Thứ tự tick tự đặt (A7) | Thứ tự 12 bước bắt buộc của ticket | `step()` tách thành 10 hàm theo đúng thứ tự | Test thứ tự gián tiếp qua các scenario |
| 13 | Snapshot `shades[].state` ∈ {chase, stunned} | `spawning/wander/chase/recoil/stunned` | `types.ts` | Test tên trạng thái |
| 14 | Một đảo, 5 đèn | 3 Đêm (bản đồ chuẩn); `--night` | `maps.ts` mới | `maps.test.ts` |
| 15 | Giao diện đơn giản | Menu, chuỗi 3 Đêm, tạm dừng, cài đặt, âm thanh, HUD đầy đủ, bảng màu | `src/client/*` | Kiểm bằng ảnh + test thuần (`client-pure.test.ts`) |

### Thiết kế mới đáng ghi lại
- **Lõi theo bản đồ:** `NightDef` (maps.ts) mô tả đảo, đèn, điểm sinh, bục nhảy, bùa, `height(x,z)`. Client và headless dùng cùng một bản đồ.
- **Va chạm tối thiểu cho vách tầng:** bước sang cột đất cao hơn chân + 0.3 m thì bị chặn (trượt theo từng trục); biển mở thì Mây được đi vào (sẽ rơi), Bóng Mực thì không.
- **Phát hiện lỗi nhờ headless:** ở Đêm 3, Bóng Mực kẹt vào vách tầng vì chọn điểm lang thang không tới được (xem `ai-log.md`). Sửa: chọn điểm cùng tầng, đổi điểm mỗi 2 giây.
