# Bằng chứng Phase 2 (TICKET-02, Contract v1.1)

Tạo lại ở tag `phase-2`:

```bash
npm ci && npm run build && npm test && node scripts/proof.mjs --phase phase-2
```

- Kết quả scenario do script tự sinh: [RESULTS.md](RESULTS.md) và các file `*.jsonl` (không sửa tay). Mỗi scenario chạy 2 lần và phải giống hệt nhau từng byte.
- Kỳ vọng trong `scenarios/*/expect.json` được **tính từ ticket**, không chép từ output (ví dụ điểm thắng 468 = 100 + 100 + 59 × 2 + 3 × 50).
- Test: `npm test` → 121 test ở 7 file (`maps`, `movement`, `items`, `enemies`, `features`, `headless`, `client-pure`).

## Truy vết yêu cầu → bằng chứng

| Yêu cầu (TICKET-02) | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|
| Phần 1: số liệu chuẩn (chạy, nhảy, lướt, đom đóm, đèn, Tỏa Sáng, Bóng Mực, bị đánh, rơi, máu, thời gian, thắng/thua, điểm) | test từng hằng số + scenario | `movement/items/enemies.test.ts`, `headless.test.ts`; scenarios `smoke`, `dash`, `pickup`, `light-and-win`, `pulse-stun`, `safe-zone`, `safe-eviction`, `shade-hit-lose`, `fall`, `dawn` | Đạt |
| Thứ tự 12 bước mỗi tick | viết `step()` theo đúng thứ tự; kiểm gián tiếp bằng các luật phụ thuộc thứ tự (thực thể mới chỉ tương tác từ tick sau, hết lửa thắng thua ưu tiên) | `world.ts`, `enemies.test.ts`, `items.test.ts` | Đạt (không có test riêng cho từng cặp thứ tự) |
| Phần 2: bản đồ Đêm 1, 2, 3 | test hình học: độ cao, vách, dốc, điểm sinh, đèn | `maps.test.ts`, scenarios `pad-n2`, `pad-n3`, `ramp-n3`, `wall-n3`, `night2-start`, `night3-start` | Đạt |
| Bục nhảy | bay đúng vận tốc, đáp đúng đảo/tầng | scenarios `pad-n2`, `pad-n3`; `movement.test.ts` | Đạt |
| Gió mạnh (Đêm 3) | gió 5 s mỗi 30 s, 2 m/s | scenario `wind-n3`; `movement.test.ts` | Đạt |
| Gió Lạc | sinh, đuổi, cướp, flee, Tỏa Sáng, thả đồ | scenarios `drifter-steal`, `drifter-drop`; `features.test.ts` | Đạt |
| Bùa Gió | nhặt, 600 tick, 7.2 m/s, lướt, xuất hiện lại | scenario `charm`; `features.test.ts` | Đạt |
| Tạm dừng | headless + giao diện | scenario `pause`; `features.test.ts`; ảnh `ui/06-pause.jpg` | Đạt |
| Chuỗi 3 Đêm, menu, giới thiệu, kết quả, Bình Minh | chạy trên trình duyệt, chụp ảnh | `ui/01-menu` … `ui/10-result-lost` | Đạt |
| Cài đặt lưu giữa các lần mở | đặt 35% và ×1.80, tải lại, đọc lại | `ui/07-settings.jpg`; `client-pure.test.ts` | Đạt |
| Âm thanh (nhạc + 10 hiệu ứng) | đọc mã | `src/client/audio.ts`, `main.ts` | **Chưa kiểm chứng bằng tai** |
| HUD đầy đủ | ảnh | `ui/03-night1-hud.jpg`, `ui/04-night2.jpg`, `ui/05-night3-wind.jpg` | Đạt |
| Bảng màu chuẩn | test giá trị hex | `client-pure.test.ts` | Đạt cho giá trị; **chưa đo màu pixel** |
| Ánh sáng môi trường 0.15 + 0.55 × tiến độ | test hàm thuần | `client-pure.test.ts` | Đạt |
| Contract v1.1 | test trường, tên, mã thoát | `headless.test.ts` | Đạt |
| Headless 1 Đêm đầy đủ ≤ 30 s | đo thời gian, 3 Đêm | `perf-night3` + `headless.test.ts` | Đạt (xem số đo) |
| ≥ 30 FPS ở 1280×720 | đo thời gian mỗi khung | xem bên dưới | Đạt (cách đo có giới hạn) |
| Regression Phase 1 với số chuẩn | `changes.md` liệt kê luật đổi; scenario Phase 1 được cập nhật | [changes.md](../../notes/changes.md) | Đạt, kèm các thay đổi theo ticket |
| Harness cập nhật cho phạm vi mới | git | `AGENTS.md`, skill `run-proof`, skill `verify-client`, `proof.mjs` | Đạt |

## Số đo hiệu năng

**Headless** (máy phát triển: Windows 11, Node 24, Intel Core + Iris Xe): một Đêm 3 đầy đủ 21 600 tick (có Bóng Mực, Gió Lạc, gió) trong khoảng **0.3 giây** (giới hạn 30 s). Scenario `perf-night3` kiểm `max_seconds: 30`.

**Game ở 1280×720** (đo ngày 2026-11-20): vòng lặp mô phỏng + vẽ mỗi khung, ép GPU hoàn tất từng khung bằng `gl.finish()`, 240 khung mỗi Đêm, sau khi mô phỏng 2400 tick để có đủ Bóng Mực và Gió Lạc. GPU: ANGLE (Intel Iris Xe, Direct3D11), `devicePixelRatio` bị giới hạn 1.5.

| Đêm | Trung bình mỗi khung | p95 | Thực thể | Tương đương |
|---|---|---|---|---|
| 1 | 4.23 ms | 5.2 ms | 6 bóng, 24 đom đóm | ~236 khung/giây |
| 2 | 4.91 ms | 6.6 ms | 7 bóng, 2 Gió Lạc, 24 đom đóm | ~204 khung/giây |
| 3 | 2.92 ms | 6.3 ms | 8 bóng, 2 Gió Lạc, 30 đom đóm | ~343 khung/giây |

Giới hạn của cách đo: khung xem trước của app bị ẩn nên vòng `requestAnimationFrame` bị giảm tốc (khoảng 2 khung/giây), vì vậy đây là **chi phí mỗi khung**, không phải FPS thực có vsync. Với mốc ≥ 30 FPS (≤ 33 ms mỗi khung), còn dư rất nhiều. Máy chấm khác sẽ cho số khác; chưa đo trên máy yếu hơn.

## Ảnh giao diện

Các ảnh trong [ui/](ui) chụp từ bản `npm run dev` của đúng mã ở commit này. Để chụp được các màn thắng/thua/Bình Minh và cảnh có đủ thực thể, tôi đặt trạng thái bằng cầu nối thử nghiệm `window.__ddl` (chỉ có ở bản dev, không có trong bản build) rồi để game vẽ lại; tạm dừng, cài đặt và chuỗi 3 Đêm thì đi qua nút bấm thật.

| Ảnh | Nội dung |
|---|---|
| `01-menu.jpg` | Menu chính |
| `02-intro.jpg` | Giới thiệu Đêm 1 (tên đảo, lời Ông Đăng) |
| `03-night1-hud.jpg` | HUD Đêm 1: Lửa, đồng hồ, đèn/điểm, 10 ô đom đóm, hồi chiêu |
| `04-night2.jpg` | Đêm 2: cầu tre, Bóng Mực, Gió Lạc, bục nhảy, huy hiệu Bùa Gió, mũi tên chỉ đèn |
| `05-night3-wind.jpg` | Đêm 3: gió, lá bay, banner cảnh báo |
| `06-pause.jpg` | Menu tạm dừng |
| `07-settings.jpg` | Cài đặt |
| `08-result-win.jpg` | Kết quả thắng Đêm 1 |
| `09-dawn.jpg` | Bình Minh, tổng điểm 698 + 808 + 868 = 2374 |
| `10-result-lost.jpg` | Kết quả thua (hết lửa) |
| `11-map-night1.jpg` | Bản đồ Đêm 1 nhìn từ trên cao: đảo tròn r = 40, 5 cột đèn, đom đóm trên hai vòng r = 12 và 33 |
| `12-map-night2.jpg` | Bản đồ Đêm 2: hai đảo r = 28, cầu tre x ∈ [26, 44], hai bục nhảy vàng ở (20,0,18) và (50,0,−18) |
| `13-map-night3.jpg` | Bản đồ Đêm 3: đảo r = 45, tầng 1 ở nửa z > 0, hai dốc ở 30° và 150°, tầng 2 và tháp chuông ở tâm |

Ba ảnh bản đồ chụp từ trên cao bằng cách đặt camera thủ công qua `window.__ddl` (bản dev). Chúng cho thấy hình dạng và vị trí; kích thước và độ cao được kiểm bằng số trong `maps.test.ts` (16 test) chứ không đo trên ảnh.

## Chưa đạt hoặc chưa kiểm chứng

- **Âm thanh** (AC-209): đã viết nhạc nền và 10 hiệu ứng bằng WebAudio, nhưng môi trường kiểm tra không có loa nên chưa nghe thử.
- **Màu pixel** (AC-211): giá trị trong mã đúng bảng chuẩn, nhưng ánh sáng, sương và ánh trăng làm màu hiển thị lệch; chưa đo sai lệch ±10% trên ảnh.
- **Ánh sáng môi trường** (AC-212): `AmbientLight` đúng công thức 0.15 + 0.55 × tiến độ, nhưng tôi thêm ánh trăng và ánh bầu trời cố định cho dễ nhìn địa hình; cảnh tổng thể vì vậy sáng lên ít rõ rệt hơn so với chỉ dùng đèn môi trường. Chưa chỉnh lại theo cảm nhận của người chơi.
- **Chưa chơi tay một ván thật** bằng bàn phím và chuột ở Đêm 2 và 3 (bục nhảy, vách, gió): các cơ chế này được kiểm bằng headless và test, không phải bằng tay.
- **22 giả định** cho chỗ ticket không nói (Q1 đến Q22 trong `assumptions.md`) chưa hỏi trợ giảng; Q1, Q2, Q3, Q10 ảnh hưởng nhiều nhất tới test ẩn.
