# PRD-0 · Đảo Đèn Lồng (Phase 1, tag `phase-1`, Contract v1.0)

> Chép lại từ tab Phase 1 trên [lab board](https://claude.ai/artifact/Q1RYyv1dxjUczzCbd2ZnoW) để agent đọc offline. Nếu khác lab board thì **lab board đúng**.

## 1. Chúng tôi muốn gì
Game 3D **Đảo Đèn Lồng**. Người chơi điều khiển **Mây**, người giữ đèn nhỏ tuổi của một hòn đảo giữa biển mây. Sương đen đã nuốt ánh sáng của đảo. Mây chạy khắp đảo thu thập đom đóm rồi mang về thắp lại các **Đèn Lồng Lớn**.
**Bóng Mực** sống trong sương, đuổi theo Mây; chạm vào thì mất máu. Mây có thể tỏa sáng để xua chúng, nhưng tốn ánh sáng. Bóng Mực sợ đèn.
Thắp hết đèn thì thắng. Mất hết máu thì thua. Có điểm số.

## 2. Phạm vi Phase 1
- Một màn: **Đêm 1 – Đảo Bến**, đảo tròn, **5** Đèn Lồng Lớn.
- Nhân vật đi lại, nhảy, camera 3D.
- Đom đóm xuất hiện rải rác, nhặt được.
- Nạp ánh sáng vào đèn để thắp đèn.
- Bóng Mực xuất hiện và đuổi người chơi.
- Tỏa sáng để xua Bóng Mực.
- Thắng, thua, điểm số, HUD.
- Chơi lại sau khi thắng hoặc thua.

## 3. Cảm giác và phong cách
Đêm, ấm, cổ tích. Đảo sáng dần khi thắp đèn. Vàng cam ấm là tốt, tím đen là nguy hiểm. Đồ họa đơn giản nhưng đẹp. Mây đội nón lá treo đèn lồng nhỏ. Không bạo lực, không máu me.

**Tự do sáng tạo:** được thêm, nhưng không phá PRD-0 và Test Contract; phần thêm không được đổi đầu ra headless (tắt khi headless). Ghi mục "Sáng tạo của tôi" trong README kèm bằng chứng phần cũ vẫn đúng.

## 4. Công nghệ
Tự chọn. Chạy được trên macOS hoặc Linux (Windows thì cần Docker hoặc bản web).

## 5. Bàn giao Phase 1 (tag `phase-1`, repo public)
- Game chơi được Đêm 1 từ đầu tới thắng/thua.
- README: cài và chạy (≤ 3 lệnh), điều khiển, cách tính điểm.
- `game.contract.json` + headless theo Test Contract v1.0.
- Bằng chứng + ghi chép ngắn (giả định, nhật ký AI).
- Harness AI đã dùng.

## 6. Lưu ý
Đúng yêu cầu > phức tạp. Cân nhắc token. Không bằng chứng thì chưa xong. Chỗ mơ hồ tự giả định và ghi lại.

---

# Test Contract v1.0 (bắt buộc, chính xác)

## A. `game.contract.json` ở gốc repo
Trường: `contract_version` ("1.0"), `team`, `build_cmd`, `run_cmd`, `headless_cmd` (sẽ được nối thêm tham số), `tuning`:
`player_speed, carry_capacity, lantern_cost, lantern_count_night1 (=5), pickup_radius, interact_radius, pulse_cost, pulse_radius, night1_duration_s, flames, invuln_s, hit_drop_ratio, pulse_stun_s, pulse_push_m, pulse_cooldown_s, safe_radius, shade_speed, shade_hit_radius, fall_enabled, score{per_mote, per_lantern, per_stun, per_second_left, per_flame_left}`.

- Điền **đúng số game đang dùng**. Không có khái niệm thì `null` (hoặc `false`) và giải thích trong README. Test Phase 1 sinh tình huống từ các số này; khai sai sẽ trượt test.
- `hit_drop_ratio`: tỉ lệ đom đóm đánh rơi khi bị chạm (0 nếu không rơi). `safe_radius`: bán kính quanh đèn mà Bóng Mực không vào được. `fall_enabled`: rơi khỏi đảo có bị phạt không. `score.*`: điểm mỗi sự kiện.
- Lệnh chạy được trên macOS/Linux sau `build_cmd`. Docker được phép.

## B. Tham số headless
```
<headless_cmd> --seed <int> --night 1 [--scenario <file.json>] [--inputs <file.json>]
               --ticks <int> --out <file.jsonl> [--snapshot-every <int, mặc định 10>]
```
- 60 tick/giây cố định, không cửa sổ, không GPU, nhanh nhất có thể.
- Dừng khi đủ `--ticks` hoặc game kết thúc. Thoát mã 0.
- Lỗi → mã khác 0, thông báo ra stderr. Inputs/scenario sai định dạng → **mã 2**.
- Mét; Y hướng lên; mặt đất Y = 0; người chơi xuất phát (0, 0, 0).
- **Mô hình tick:** snapshot tick 0 = trạng thái sau khi dựng scenario, trước khi áp input. Bước k (k = 0…N−1) đọc input tick k, tạo trạng thái k+1; sự kiện trong bước đó có `tick = k+1`. `--ticks N` chạy đúng N bước. `time_left_s = thời lượng Đêm − số bước / 60`.
- **Vị trí:** `player.pos` là chân nhân vật; `shade.pos` là tâm Bóng Mực; `lantern.pos` là chân cột đèn; đom đóm là điểm trên mặt đất. Khoảng cách đo trên **XZ**, không cộng kích thước. "Trong bán kính r" là **≤ r**.

## C. File inputs
```json
{ "frames": [
  { "tick": 0,   "move": [0, 1], "cam_yaw_deg": 0 },
  { "tick": 120, "move": [0, 0], "interact": true },
  { "tick": 121, "interact": false },
  { "tick": 200, "pulse": true },
  { "tick": 201, "pulse": false } ] }
```
- Mặc định trước frame đầu: `move [0,0]`, `cam_yaw_deg 0`, mọi nút false.
- Frame chỉ đổi trường có mặt; trường vắng giữ giá trị cũ. `tick` tăng nghiêm ngặt.
- `move [x,z]`, mỗi thành phần trong [−1, 1]. θ = cam_yaw_deg (radian): `x' = x·cosθ + z·sinθ`, `z' = −x·sinθ + z·cosθ`. Dài hơn 1 thì chuẩn hóa về 1.
- `jump`, `interact`, `pulse` (và `dash` nếu có): kích hoạt khi false → true.
- Không có file inputs = đứng yên.

## D. File scenario
```json
{ "player": { "pos": [0, 0, 0], "carried": 0, "flames": 3 },
  "random_motes": false, "random_shades": false,
  "motes": [[0, 0, 5]],
  "shades": [{ "pos": [10, 0, 0] }],
  "lanterns": [{ "id": "L1", "pos": [0, 0, 25], "deposited": 0 }],
  "time_left_s": 300 }
```
- `random_motes: false` / `random_shades: false`: không tự sinh, chỉ có con được liệt kê (shade hoạt động bình thường ngay).
- `lanterns`: cập nhật theo id (L1…L5); không nhắc thì giữ nguyên; có `pos` thì đổi vị trí; có thể đặt `lit: true`.
- `motes`, `shades`: thay thế danh sách ban đầu; mảng rỗng = không có. `shades[]` có thể kèm `id`.
- Trường vắng thì dùng mặc định của game.
- Dựng scenario **không phát sự kiện, không cộng điểm**.

## E. Output JSONL
Snapshot mỗi `--snapshot-every` tick, từ tick 0:
```json
{"type":"snapshot","tick":120,"sim_tick":120,"state":"playing","time_left_s":298.0,"score":20,
 "player":{"pos":[0.0,0.0,12.0],"flames":3,"carried":2},
 "lanterns":[{"id":"L1","pos":[0,0,25],"lit":false,"deposited":0}],
 "shades":[{"id":"S1","pos":[30.1,1.0,2.0],"state":"chase"}],
 "motes_active":19}
```
Event, ghi ngay khi xảy ra: `{"type":"event","tick":131,"name":"mote_picked","data":{"carried":3}}`

| name | data |
|---|---|
| mote_picked | `{"carried": n}` |
| deposit | `{"lantern_id": "L1", "amount": n, "deposited": n}` |
| lantern_lit | `{"lantern_id": "L1"}` |
| pulse | `{"stunned_ids": ["S1"]}` |
| player_hit | `{"by": "shade" \| "fall", "flames": n, "dropped": n}` |
| shade_spawned | `{"id": "S3"}` |
| game_over | `{"result": "won" \| "lost", "reason": "all_lit" \| "dawn" \| "no_flames"}` |

End, dòng cuối bắt buộc: `{"type":"end","ticks":4800,"state":"won","score":1730}`

- `state` ∈ `playing`, `won`, `lost`. Trạng thái Bóng Mực tối thiểu phải có `stunned`; tên khác tự đặt.
- Tọa độ làm tròn 3 chữ số thập phân.
- Tất định: cùng seed + scenario + inputs → output giống hệt, kể cả id tự sinh.
- `sim_tick` = số bước gameplay (Phase 1 bằng `tick`).
- Mảng `motes` (`id`, `pos`) trong snapshot là khuyến nghị.
- Sự kiện không có trong game thì không ghi.
