# Changelog

Mỗi phase là một tag: `phase-1`, `phase-2`, `phase-3`, `phase-4`. Bản phát hành: `v1.0.0` (phase-4). Các thay đổi phá vỡ tương thích được liệt kê chi tiết trong `docs/notes/changelog-phase3.md`.

## v1.0.0 — Phase 4 (TICKET-04, Contract v1.3)
- **Bench:** `scripts/bench.mjs` mở bản web trong Chrome hoặc Edge ở 1280×720 với cảnh cố định (`?bench=1`), ghi `bench.json` đúng các trường ticket. Cảnh bench tắt sinh thực thể, sát thương, nhặt đom đóm, hao dầu và kết thúc Đêm; Bóng Mực vẫn wander.
- **Soak test:** `src/headless/soak.ts` (`dist/headless/soak.js`) chạy 10 Đêm liên tiếp trong một tiến trình, ghi `soak.json`.
- **Bảng xếp hạng:** top 10 lưu trên đĩa (`data/leaderboard.json`), nhập tên sau khi thua hoặc thắng Đêm 3, màn hình từ menu. `--export-leaderboard out.json` xuất `{"entries": [...]}`.
- **Máy chủ cục bộ:** `npm start` chạy `scripts/serve.mjs`, phục vụ `dist-web` và `/api/leaderboard` trên cùng cổng. Thay cho `vite preview`.
- **Trợ năng:** đổi phím 9 hành động có kiểm tra trùng phím và nút khôi phục mặc định; chỉ báo Bóng Mực xuất hiện (chữ và mũi tên mép màn hình), đèn sắp tắt, 10 giây cuối; giảm chuyển động (tắt rung và chớp); chữ lớn ×1.25; chữ giao diện tối thiểu 18 px.
- **Contract v1.3:** `contract_version` "1.3"; thêm `bench_cmd` và `soak_cmd`. Các mục v1.0–v1.2 giữ nguyên.
- **Core:** `World.bench` (cờ cảnh bench, tắt timer, fuel, nhặt, sát thương, spawn, kết thúc và đuổi). Đầu ra headless của scenario cũ không đổi (33/33).
- **Tài liệu:** README, CHANGELOG, ghi chú bench, bằng chứng phase 4 (`docs/proof/phase-4/`), retro.

## Phase 3 — Đèn cạn dầu (TICKET-03, Contract v1.2)
- Đèn có dầu (100 tối đa), hao 1/s, châm 10 dầu mỗi đom đóm, tắt khi về 0, thắp lại 5 đom đóm.
- Không còn thắng sớm: thắng lúc bình minh nếu còn ceil(0,6 × tổng) đèn sáng.
- Bóng Mực trạng thái `drain` hút dầu từ đèn yếu; vùng an toàn chỉ khi dầu ≥ 30.
- Sức chứa 10 + 2 × thắp thành công, tối đa 20. Điểm mới (+5 nạp, +100 / +40 thắp, +15 khi hút, bình minh).
- Thời lượng Đêm 240 / 270 / 300 s. Thanh dầu, mù màu, chữ kết quả mới.
- Chi tiết: [ADR-001](docs/notes/adr-001-lantern-fuel.md), [changelog Phase 3](docs/notes/changelog-phase3.md).

## Phase 2 — Ba hòn đảo (TICKET-02, Contract v1.1)
- Ba Đêm với bản đồ riêng: Đảo Bến, Đảo Cau (cầu tre, bục nhảy), Đảo Chuông (ba tầng, tháp chuông, gió mạnh).
- Lướt (Shift), Gió Lạc (cướp đom đóm), Bùa Gió, gió mạnh (Đêm 3), tạm dừng, cài đặt, âm thanh WebAudio, HUD đầy đủ.
- Rơi khỏi đảo bị phạt; `fall_enabled` là `true`.

## Phase 1 — Bản mẫu (PRD-0, Contract v1.0)
- Game 3D một đảo, Mây di chuyển, nhặt đom đóm, thắp đèn, Bóng Mực đuổi và Tỏa Sáng.
- Test Contract headless (`node dist/headless/cli.js`) với mã thoát 0/1/2 và đầu ra JSONL.
- Harness AI: `AGENTS.md`, skill `run-proof` và `verify-client`, hook Stop chặn khi test đỏ.
