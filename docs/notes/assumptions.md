# Giả định

Mỗi dòng: giả định, lý do ngắn, phase. Khi ticket làm rõ hoặc đổi, sửa dòng và ghi vào `changes.md`.

## Phase 1

### Số tuning (khớp `game.contract.json`)
| Tham số | Giá trị | Lý do |
|---|---|---|
| player_speed | 5.0 m/s | Đi hết bán kính đèn (25 m) trong 5 s |
| carry_capacity | 5 | Đủ thắp 1 đèn và còn dư để tỏa sáng |
| lantern_cost | 3 | 5 đèn × 3 = 15 đom đóm, ít hơn 20 đom đóm ban đầu |
| lantern_count_night1 | 5 | Contract |
| pickup_radius | 1.0 m | |
| interact_radius | 2.0 m | |
| pulse_cost | 1 | Tốn 1 đom đóm đang mang |
| pulse_radius | 6.0 m | |
| night1_duration_s | 180 | |
| flames | 3 | Máu |
| invuln_s | 1.5 | |
| hit_drop_ratio | 0.5 | Rơi floor(carried × 0.5) |
| pulse_stun_s | 2.0 | |
| pulse_push_m | 3.0 | |
| pulse_cooldown_s | 1.0 | |
| safe_radius | 3.0 | Áp dụng cho đèn đã thắp (cần xác nhận) |
| shade_speed | 3.0 m/s | Chậm hơn player |
| shade_hit_radius | 0.8 m | |
| fall_enabled | false | Không phạt rơi khỏi đảo; player bị giữ trong đảo |
| score.* | 10 / 100 / 5 / 1 / 50 | mote / lantern / stun / giây còn lại / flame còn lại |

### Luật
- A1. Đảo tròn bán kính 40 m, tâm (0,0,0). Đèn L1…L5 trên vòng 25 m, L1 tại (0,0,25), cách đều 72°.
- A2. 20 đom đóm ngẫu nhiên (theo seed) khi `random_motes` không phải false.
- A3. Hết giờ (`time_left_s` về 0) → `game_over {result: lost, reason: dawn}`.
- A4. Nhảy: vận tốc 6 m/s, trọng lực 20 m/s². Chỉ đổi Y, không ảnh hưởng khoảng cách XZ.
- A5. Mã thoát: 0 ok; 2 inputs/scenario sai định dạng hoặc không đọc được; 1 sai tham số CLI.
- A6. Frame có `tick` vượt `--ticks` bị bỏ qua.
- TODO trước khi code luật: deposit bao nhiêu mỗi lần `interact`; điểm cuối trận tính khi nào; shade spawn ở đâu, bao nhiêu; pulse khi `carried < pulse_cost`.
