# Bằng chứng Phase 4 (TICKET-04, Contract v1.3)

Tạo lại:

```powershell
npm ci
npm run build
npm test
node scripts/proof.mjs --check
node scripts/bench.mjs --seed 42 --duration 30 --out docs/proof/phase-4/bench.json
node dist/headless/soak.js --seed 7 --nights 10 --out docs/proof/phase-4/soak.json
```

`bench.json`, `soak.json` và `bench-scene.png` do script sinh; không sửa tay.

## Truy vết yêu cầu → bằng chứng

| Yêu cầu (TICKET-04) | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|
| §1 Bench: cảnh cố định, camera, không input, đo đúng `--duration` | `bench.test.ts`; `scripts/bench.mjs` | `bench.json`, `bench-scene.png` | Đạt (chạy thật, 30 s) |
| §1 avg_fps ≥ 60 (máy phát triển) | `bench.json` | 222.3 | Đạt trên máy phát triển; máy chấm chưa đo |
| §1 p1_low_fps ≥ 30 | `bench.json` | 128.6 | Đạt trên máy phát triển |
| §1 load_ms ≤ 10000 | `bench.json` | 1390 | Đạt trên máy phát triển |
| §1 vsync tắt (ghi trong README nếu không tắt được) | — | `vsync_off: false` | Không xác minh được; ghi rõ trong README và `docs/notes/bench.md` |
| §2 Soak: 10 Đêm, không crash | `src/headless/soak.ts`, chạy trực tiếp | `soak.json` (crashes 0) | Đạt |
| §2 mem_end ≤ 1.2 × mem_start | `soak.json` | 37.2 → 49.1 MB (1.32×) | **Không đạt**; xem ghi chú bên dưới |
| §3 Bảng xếp hạng: top 10, sắp xếp, bằng điểm thì ai trước đứng trên | `leaderboard.test.ts` | — | Đạt (test) |
| §3 Tên 3–12 ký tự `[A-Za-z0-9_]` | `leaderboard.test.ts`; kiểm trên API | — | Đạt |
| §3 Lưu trên đĩa, còn sau khi tắt và mở lại | Kiểm bằng API: POST rồi GET, rồi xuất bằng `--export-leaderboard` | — | Đạt một phần: đã ghi và đọc lại file; **chưa thử khởi động lại server** |
| §3 `--export-leaderboard out.json` | Chạy thật, `out.json` có `entries` đúng thứ tự | — | Đạt |
| §4 Đổi phím, phát hiện trùng, khôi phục mặc định, lưu | `access.test.ts`; code `ui.ts` | — | Đạt (test); **chưa kiểm bằng mắt** |
| §4 Chỉ báo Bóng Mực, gió, 10 s cuối, đèn dưới 30 dầu | Đọc code `ui.ts`; cue và mũi tên | — | Đạt (code); **chưa kiểm bằng mắt** |
| §4 Giảm chuyển động, chữ lớn ×1.25 | `access.test.ts`; `access.css` | — | Đạt (code); **chưa kiểm bằng mắt** |
| §4 Chữ giao diện tối thiểu 18 px | `grep font-size` trong `style.css`: không còn cỡ dưới 18 px | — | Đạt (kiểm trên CSS, chưa đo layout) |
| §6 Contract v1.3, bench_cmd, soak_cmd | `headless.test.ts` | `game.contract.json` | Đạt |
| §6 Các yêu cầu v1.0–v1.2 vẫn giữ | `proof.mjs --check` (33 scenario) | `out/proof` | Đạt (33/33) |
| DoD: mọi test Phase 1–3 vẫn đạt | `npm test`: 171 test | — | Đạt |

## Ghi chú về soak và bộ nhớ

Soak không đạt ngưỡng `mem_end ≤ 1.2 × mem_start` (1.32×). Đã kiểm tra:
- Heap JS sau GC qua 4 vòng soak (40 đêm) ổn định ở khoảng 5.5 MB, không tăng theo vòng.
- RSS tăng khoảng 10 MB trong đêm đầu (JIT, cấp phát khởi động) rồi phẳng ở 48–50 MB.
- `mem_start` được đo ngay sau khi tải Đêm đầu, trước khi V8 khởi động xong; đây là định nghĩa của ticket và không được đổi để qua ngưỡng.

Lựa chọn còn lại (cần quyết định): giữ FAIL và ghi nhận, hoặc đo `mem_start` sau khi Đêm đầu chạy xong (đổi định nghĩa, phải ghi rõ trong README).

## Chưa đạt hoặc chưa kiểm chứng
- Bench và soak chỉ chạy trên máy phát triển (Windows 11, i7-13700H, Iris Xe, 16 GB, Chrome 157).
- Các mục "chưa kiểm bằng mắt": đổi phím, chỉ báo, giảm chuyển động, chữ lớn.
- `vsync_off` không xác minh được.
- Video demo và ảnh GIF chưa có; `bench-scene.png` là ảnh cảnh bench (HUD ẩn).
