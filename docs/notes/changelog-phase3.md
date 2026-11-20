# Changelog Phase 3 (TICKET-03, Contract v1.2)

Danh sách thay đổi **phá vỡ tương thích** so với Phase 2 (Contract v1.1). Mỗi dòng nêu luật cũ, luật mới, và test/scenario bị ảnh hưởng.

## Contract và đầu ra headless

| Thay đổi | Trước (v1.1) | Sau (v1.2) | Tác động |
|---|---|---|---|
| `contract_version` | "1.1" | "1.2" | Bất kỳ công cụ đọc contract nào kiểm version đều phải cập nhật |
| Thời lượng đêm | 300 / 330 / 360 s | 240 / 270 / 300 s | `time_left_s` và số tick kết thúc khác |
| `score` | `per_mote` 10, `per_second_left` 2, `per_flame_left` 50 | `per_mote` 5, `per_relight` 40, `per_drain_stun` 15, `per_lit_dawn` 50, `per_flame_left` 50; **bỏ** `per_second_left` | Điểm mọi scenario đổi |
| Tuning mới | — | `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max` | Thêm khóa |
| Snapshot đèn | `id, pos, lit, deposited` | + `fuel` (1 chữ số), `ever_lit`, `relit_count` | Thêm trường |
| Snapshot người chơi | — | + `capacity` | Thêm trường |
| Trạng thái Bóng Mực | `spawning, wander, chase, recoil, stunned` | + `drain` | Thêm trạng thái |
| Scenario đèn | `id, pos, lit, deposited` | + `fuel`, `ever_lit` | Thêm trường |
| Scenario người chơi | … | + `successful_lights` | Thêm trường |
| Scenario Bóng Mực | `id, pos, state, state_ticks_left` | + `target_lantern_id` | Thêm trường |
| Sự kiện mới | — | `refuel`, `lantern_out`, `fuel_drain` | Thêm sự kiện |
| `lantern_lit` | `lantern_id` | + `relight` | Thêm trường |
| `game_over.reason` | `no_flames`, `dawn`, `all_lit` | `no_flames`, `dawn`, **`dawn_survived`**; `all_lit` không còn được phát | Đổi giá trị |

## Luật (thay thế)

| Luật cũ | Luật mới | Test/scenario đã cập nhật |
|---|---|---|
| Thắp đủ tất cả đèn → thắng ngay (`all_lit`) | Không thắng sớm; thắng lúc bình minh nếu sống và đủ `ceil(0.6 × tổng)` đèn sáng | `items.test.ts` (khối "Scoring and ending" đã xóa, lý do ở file), `fuel.test.ts`; scenario `light-and-win` đổi kỳ vọng (không còn thắng ở tick 1) |
| Đèn sáng không nhận thêm đom đóm | Châm dầu: 10 dầu mỗi đom đóm, tối đa 100 | `fuel.test.ts` Refuel |
| Đèn không hao dầu | Đèn sáng hao 1 dầu/s | `fuel.test.ts` Fuel |
| Bóng Mực không bao giờ vào vùng an toàn | Đèn sáng dưới 30 dầu không còn vùng an toàn; trên 30 vẫn có | `enemies.test.ts` (test vùng an toàn của Phase 2 vẫn đúng ở đèn đầy); `fuel.test.ts` Safe zone |
| Bóng Mực lang thang về điểm ngẫu nhiên | Lang thang về đèn sáng dưới 30 gần nhất, không có thì về đèn tắt gần nhất | `fuel.test.ts` Drain; `enemies.test.ts` (tên trạng thái và tốc độ không đổi) |
| Điểm: +10 nhặt/nạp đom đóm, +100 thắp, thưởng thời gian ×2 | +5 mỗi đom đóm nạp, +100 thắp lần đầu, +40 thắp lại, không thưởng thời gian, thưởng bình minh | `items.test.ts` (test điểm nạp cũ), `headless.test.ts` (khóa score), `fuel.test.ts` Scoring |
| Đèn đầy là kết thúc trò chơi | Không phải kết thúc; đèn tắt được | `fuel.test.ts` Relight |
| Sức chứa cố định 10 | 10 + 2 × lần thắp thành công, tối đa 20 | `fuel.test.ts` Capacity |

## Client

| Thay đổi | Ghi chú |
|---|---|
| Thanh dầu trên đèn sáng; nhấp nháy 1 Hz khi dưới 30 | `scene.ts`; **chưa kiểm bằng mắt ở khoảng cách xa** |
| Đèn tắt xẹp 20% và có vết rách | `scene.ts` |
| HUD hiển thị `đang mang/sức chứa` | `ui.ts`, `style.css` |
| Cài đặt "Bảng màu dễ phân biệt" (lưu được) | Viền và mắt Bóng Mực #00B3FF; cảnh báo trắng có ⚠ |
| Âm thanh: đèn tắt (`out`), châm dầu (`pick`) | `audio.ts`, `main.ts` |
| Chữ kết quả đổi: "Qua một đêm!", "Mây giữ đảo sáng tới bình minh với X/Y đèn" | `ui.ts` |

## Không đổi
Số liệu Phase 2 khác (tốc độ, lướt, bục nhảy, Gió Lạc, Bùa Gió, tạm dừng), bản đồ ba đêm, thứ tự tick trừ phần bổ sung dầu, và đầu ra headless cho mọi sự kiện cũ.
