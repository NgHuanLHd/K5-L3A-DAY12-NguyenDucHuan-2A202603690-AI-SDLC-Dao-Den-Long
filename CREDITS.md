# Credits

## Thư viện
| Tên | Giấy phép | Dùng cho |
|---|---|---|
| [three.js](https://threejs.org) | MIT | Hiển thị 3D |
| [Vite](https://vite.dev) | MIT | Build bản web |
| [Vitest](https://vitest.dev) | MIT | Test |
| [TypeScript](https://www.typescriptlang.org) | Apache-2.0 | Ngôn ngữ |

## Asset
Không dùng asset ngoài. Mọi hình khối dựng bằng primitive của three.js trong code.

## Nhân vật và bối cảnh
Mây, Bóng Mực, Đảo Đèn Lồng là bản gốc của lab Day 12 AI SDLC.

## Công cụ AI
Mã nguồn, tài liệu và harness được viết cùng Claude Code (Anthropic). Chi tiết trong `docs/notes/ai-log.md`.

## Phase 2
- **Âm thanh:** nhạc nền và mọi hiệu ứng được tổng hợp trực tiếp bằng WebAudio trong `src/client/audio.ts` (do Claude Code viết cùng tôi). Không dùng file âm thanh hay mẫu có sẵn.
- **Hình khối:** vẫn chỉ là primitive của three.js; bảng màu theo TICKET-02.
- **Biểu tượng giao diện:** SVG vẽ tay trong `src/client/ui.ts`.
