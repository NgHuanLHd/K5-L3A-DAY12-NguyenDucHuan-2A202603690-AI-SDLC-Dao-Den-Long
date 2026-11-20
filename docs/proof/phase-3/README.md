# Bằng chứng Phase 3 (TICKET-03, Contract v1.2)

Tạo lại ở tag `phase-3`:

```bash
npm ci && npm run build && npm test && node scripts/proof.mjs --phase phase-3
```

`RESULTS.md` và các `*.jsonl` do script sinh, ghi đúng mã commit (không sửa tay). Kiểm tra lại sau khi commit: mã trong `RESULTS.md` phải trùng `git rev-parse --short HEAD` của commit mã.

## Truy vết yêu cầu → bằng chứng

| Yêu cầu (TICKET-03) | Cách kiểm | Bằng chứng | Kết quả |
|---|---|---|---|
| §1 Nhiên liệu: hao 1/s, châm 10/đom đóm, tắt khi về 0, thắp lại 5 | `fuel.test.ts`; `p3-refuel`, `p3-lantern-out`, `p3-relight` | RESULTS.md | Đạt |
| §1 Hiển thị: thanh dầu, nhấp nháy dưới 30 | Đọc code (`scene.ts`), ảnh HUD | `ui/` | Đạt một phần (xem AC-314) |
| §2 Bóng Mực hút dầu: wander tới đèn yếu, drain ≤ 2 m, rời drain | `fuel.test.ts`; `p3-drain`, `p3-drain-stun` | RESULTS.md | Đạt |
| §2 Vùng an toàn chỉ khi dầu ≥ 30; đẩy ra khi châm lên 30 | `fuel.test.ts` Safe zone, Refuel | `fuel.test.ts` | Đạt (xem ADR-001) |
| §3 Không thắng sớm; thắng lúc bình minh với ceil(0.6n) đèn | `fuel.test.ts` Dawn; `p3-dawn-win`, `p3-dawn-lose`, `p3-night2-dawn` | RESULTS.md | Đạt |
| §3 Hết lửa thua ngay, kể cả tick bình minh | `p3-no-flames` | RESULTS.md | Đạt |
| §4 Sức chứa 10 + 2×thắp thành công, tối đa 20 | `fuel.test.ts` Capacity; `p3-capacity` | RESULTS.md | Đạt |
| §5 Điểm mới (+5, +100/+40, +15 drain stun, bình minh +50+fuel, +50/lửa) | `fuel.test.ts`; `p3-drain-stun`, `p3-dawn-win` | RESULTS.md | Đạt |
| §6 Chế độ mù màu, lưu được | `client-pure.test.ts`; đọc code và CSS | — | Đạt cho dữ liệu; **chưa kiểm bằng mắt** |
| §7 Contract v1.2 (khóa, snapshot, scenario, sự kiện) | `headless.test.ts` | — | Đạt |
| DoD: ADR, changelog, test cũ có lý do, Phase 1–2 không đổi | [ADR-001](../../notes/adr-001-lantern-fuel.md), [changelog](../../notes/changelog-phase3.md) | — | Đạt |
| DoD: Phase 1–2 không bị thay thế vẫn đạt | `npm test` (150 test) và 23 scenario cũ đã cập nhật có lý do | — | Đạt, có ghi chú các luật bị thay |

## Chưa đạt hoặc chưa kiểm chứng
- Thanh dầu trên đèn khó nhìn từ xa; cần kiểm khi chơi thật.
- Mù màu chỉ kiểm dữ liệu cài đặt và màu, chưa kiểm bằng mắt người có khiếm thị màu.
- Chưa chơi tay một ván thật qua cả ba đêm với luật dầu.
- Câu hỏi P2 (đèn 100 vẫn nhận 1 đom đóm) chưa hỏi trợ giảng.
