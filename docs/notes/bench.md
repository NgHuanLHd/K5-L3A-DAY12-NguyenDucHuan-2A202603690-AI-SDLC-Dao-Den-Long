# Ghi chú benchmark và soak (TICKET-04)

## Cảnh benchmark
- Trang: `index.html?bench=1&seed=42&duration=30`. Mã: `startBench()`, `benchScenario()`, `benchStep()`, `benchCamera()` trong `src/client/main.ts`.
- Luật bench: `World.bench` (`src/core/world.ts`). Khi bật, `step()` chỉ chạy `moveEnemies()`: không đếm timer, không hao dầu, không nhặt, không sát thương, không spawn, không kết thúc, và không chuyển sang đuổi. Bóng Mực vẫn wander như luật thường. Test: `tests/bench.test.ts`.
- Cảnh: Đêm 1; 200 Bóng Mực wander và 100 đom đóm đặt ở điểm trên đảo, lấy từ `seed 42` (mẫu hóa đều trong hình vuông 80 m, chỉ giữ điểm có đất); đèn L1–L3 sáng với fuel 100; Mây ở (0, h, 0), không input.
- Camera: bán kính 30 m, cao 15 m, nhìn (0,0,0), 15 s một vòng, ngược chiều kim đồng hồ khi nhìn từ trên xuống, bắt đầu ở (30, 15, 0).
- Thời gian: 3 s khởi động không đo; sau đó đo đúng `--duration` giây.

## Công thức (đúng ticket)
- `frames` = số dt đo được (N). `avg_fps` = 1000 × N / Σdt.
- `p1_low_fps`: k = max(1, ceil(0,01 × N)); lấy k dt lớn nhất; `p1_low_fps` = 1000 / trung bình của k giá trị đó.
- `frame_ms_p95`: dt xếp tăng dần, lấy phần tử thứ ceil(0,95 × N) (phương pháp nearest-rank).
- `load_ms`: từ lúc `scripts/bench.mjs` bắt đầu tới khung bench đầu tiên.
- `peak_mem_mb`: working set (Windows) hoặc RSS (macOS/Linux) của cây tiến trình trình duyệt, lấy mẫu mỗi giây.

## Giới hạn đã biết
- `vsync_off` ghi `false`: cờ `--disable-gpu-vsync --disable-frame-rate-limit` được truyền nhưng không kiểm chứng được là đã có hiệu lực. Kết quả 221 FPS cho thấy rAF không bị giới hạn 60 Hz, nhưng đó không đủ để kết luận vsync đã tắt.
- Lấy mẫu bộ nhớ mỗi giây và chính việc lấy mẫu có thể làm chậm khung hình một chút.
- Số đo chỉ có ý nghĩa trên cùng một máy; máy chấm của giảng viên khác.

## Soak test
- `src/headless/soak.ts`. Đêm i dùng seed `7 + i`. Input theo seed: đổi hướng mỗi 30 tick; mỗi tick nhảy 5%, lướt 3%, tỏa sáng 2%, tương tác 10%. Không dừng.
- `mem_start_mb`: RSS ngay sau khi tải xong Đêm đầu. `mem_end_mb`: RSS sau khi GC (chạy qua `v8.setFlagsFromString('--expose_gc')`) khi xong Đêm cuối.
- Ngưỡng: `crashes = 0` và `mem_end_mb ≤ 1.2 × mem_start_mb`. Script trả mã 1 khi không đạt.
- Lần chạy chính thức: 0 crash, 37.2 → 49.1 MB (1.32×): **không đạt**. Heap JS sau GC ổn định ở khoảng 5.5 MB qua nhiều vòng (xem `docs/proof/phase-4/README.md`), phần tăng là RSS khởi động của V8.
- Quan sát: cả 10 Đêm trong lần chạy đều thua, nên đường bình minh chưa được soak trong chính lần chạy này. Các đường bình minh được kiểm bằng test riêng (`tests/fuel.test.ts`).
