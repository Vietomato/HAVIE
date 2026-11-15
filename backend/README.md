# HAVIE Backend Service

Backend API cho cửa hàng cầu lông HAVIE, tuân thủ đặc tả tại `API_CONTRACT_HAVIE_v1.md`.

## Cài đặt và cấu hình

```bash
cd backend
npm install
cp .env.example .env
```

Điền `DATABASE_URL` tới PostgreSQL và thay `JWT_SECRET` cùng `OTP_HASH_SECRET` bằng hai secret riêng biệt, ngẫu nhiên, tối thiểu 32 byte. Có thể tạo mỗi secret bằng PowerShell:

```powershell
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

Chỉ lưu secret trong `backend/.env`; không gửi qua chat hay commit lên Git.

Để gửi OTP, bật xác minh 2 bước trên tài khoản Gmail gửi thư, tạo **Google App Password**, rồi cấu hình:

- `SMTP_USER`: địa chỉ Gmail gửi thư.
- `SMTP_PASS`: Google App Password (không phải mật khẩu Gmail thông thường).
- `SMTP_FROM`: tùy chọn; mặc định dùng `SMTP_USER`.
- `ADMIN_EMAIL_ALLOWLIST`: email được cấp role Admin sau khi xác minh, phân cách bằng dấu phẩy. Email ngoài danh sách chỉ được tạo tài khoản Customer.
- `CLOUDINARY_URL`: tùy chọn, dạng `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`. Có giá trị thì ảnh sản phẩm do Admin tải lên được lưu trên Cloudinary; để trống thì lưu trong `backend/uploads` và phục vụ qua `/uploads`. Thư mục này không được đưa lên Git nên ảnh chỉ tồn tại trên máy đó; khi deploy hoặc làm nhóm hãy dùng Cloudinary.

### Tài khoản Admin thử nghiệm (chỉ development)

Để thử giao diện quản trị mà không cần đăng ký OTP, cấu hình các biến sau trong `backend/.env`:

```env
NODE_ENV=development
MOCK_ADMIN_ENABLED=true
MOCK_ADMIN_EMAIL=admin.test@example.com
MOCK_ADMIN_PASSWORD=your-local-test-password
```

Khởi động lại backend. Trên trang đăng nhập ở frontend development, nhập email/mật khẩu đã cấu hình và chọn **ĐĂNG NHẬP ADMIN THỬ NGHIỆM**. Backend sẽ tạo tài khoản Admin local lần đầu nếu email chưa tồn tại. Không dùng chung email với tài khoản Customer hoặc tài khoản khác. Tính năng bị từ chối ngoài `NODE_ENV=development` và khi chưa bật rõ ràng bằng `MOCK_ADMIN_ENABLED=true`; không đưa thông tin mock vào Git.

## Database

Migration `prisma/migrations/20261021160000_email_otp_registration/migration.sql` chỉ thêm cột `emailVerifiedAt` vào users và bảng OTP. Với database cũ chưa được Prisma Migrate quản lý, hãy sao lưu database và chạy migration này đúng một lần từ thư mục `backend`:

```bash
npx prisma db execute --file prisma/migrations/20261021160000_email_otp_registration/migration.sql
npx prisma generate
```

Migration `20261031200000_product_visibility` thêm cột `isActive` để Admin có thể ẩn sản phẩm mà không xóa dữ liệu đơn hàng. Với database đã được Prisma Migrate quản lý, dùng `npx prisma migrate deploy`. Với database cũ chưa quản lý migration, hãy sao lưu trước, chạy file migration này đúng một lần bằng `npx prisma db execute --file prisma/migrations/20261031200000_product_visibility/migration.sql`, rồi chạy `npx prisma generate`.

Không chạy `prisma migrate reset` trên database có dữ liệu.

Để nạp danh mục, thương hiệu, sản phẩm và biến thể trong `prisma/productsData.json`, cấu hình `DATABASE_URL` trong `backend/.env`, sau đó chạy từ thư mục `backend`:

```bash
npm run prisma:generate
npm run prisma:seed
```

Seed có thể chạy lại để cập nhật sản phẩm theo slug và biến thể theo SKU.

## Khởi chạy và kiểm thử

```bash
npm run dev
npm test
```

Backend mặc định chạy tại `http://localhost:3000`; kiểm tra `http://localhost:3000/api/health`. Frontend Vite proxy `/api` qua backend.

## API

- `POST /api/auth/register/request-otp`: gửi mã 6 chữ số qua Gmail.
- `POST /api/auth/register/verify-otp`: xác minh mã, tạo tài khoản và đặt cookie phiên HttpOnly.
- `POST /api/auth/register`: trả `410 EMAIL_VERIFICATION_REQUIRED`; không thể bỏ qua xác minh email.
- `POST /api/auth/login`
- `GET /api/auth/me`, `GET /api/me`
- `POST /api/auth/logout`
- `POST /api/auth/activity`: gia hạn phiên còn hiệu lực khi người dùng có hoạt động thực.
- `GET /api/auth/providers`, `POST /api/auth/social/:provider/start`, `GET /api/auth/social/:provider/callback`: Google/Facebook và liên kết tài khoản.

Web dùng cookie HttpOnly, hết hạn sau 30 phút không hoạt động; Redis khi có cấu hình, PostgreSQL khi chạy local không có Redis. Hướng dẫn cấu hình, thay đổi API đăng nhập và kiểm thử tải: [deployment/README.md](../deployment/README.md).
- `GET /api/categories`, `GET /api/brands`, `GET /api/products`, `GET /api/products/:slug`
- `GET /api/products/:slug/reviews`
- `GET /api/cart`, `POST /api/cart/items`, `PATCH /api/cart/items/:id`, `DELETE /api/cart/items/:id`
- `POST /api/orders`, `GET /api/orders/my`, `POST /api/orders/:id/cancel`
- Admin (yêu cầu role `ADMIN`): `GET /api/admin/products`, `POST /api/admin/products`, `PATCH /api/admin/products/:id`, `GET /api/admin/orders`, `PATCH /api/admin/orders/:id/status`
- Tư vấn (yêu cầu đăng nhập): `GET/POST /api/chat/conversations`, `GET/PATCH/DELETE /api/chat/conversations/:id`, `POST /api/chat/conversations/:id/messages`

OTP hết hạn sau 10 phút, gửi lại sau 60 giây và tối đa 5 lần nhập sai. Các route sản phẩm hỗ trợ bộ lọc và phân trang theo `API_CONTRACT_HAVIE_v1.md`.

Lịch sử tư vấn được lưu theo tài khoản trong PostgreSQL; mỗi tài khoản chỉ xem được hội thoại của mình. Tên ban đầu lấy từ tin nhắn đầu tiên, khách có thể đổi tên tối đa 60 ký tự; hội thoại đang xử lý chưa thể xóa. Chat mới tạo một cuộc trò chuyện riêng, nên lượt tư vấn đang xử lý không khóa các cuộc trò chuyện khác. Trước khi sử dụng, sao lưu database. Với database đã được Prisma Migrate quản lý, chạy `npx prisma migrate deploy` để áp dụng các migration còn thiếu; với database cũ chưa quản lý migration, cần sao lưu và chạy lần lượt các migration chưa áp dụng bằng `npx prisma db execute --file <đường-dẫn-migration.sql>`. Sau đó chạy `npm run prisma:generate`. Không chạy `prisma migrate reset` trên database có dữ liệu.

Chat tư vấn gọi model qua `src/services/aiProvider.js`. Đặt `AI_PROVIDER=groq` kèm `GROQ_API_KEY` (và tùy chọn `GROQ_MODEL`, mặc định `qwen/qwen3.8-27b`; `GROQ_EXTRACT_MODEL` đặt model riêng cho bước đọc nhu cầu, ví dụ `openai/gpt-oss-20b`, vì Groq tính hạn mức token theo từng model nên chia việc giúp ít bị giới hạn hơn) để dùng Groq Cloud; `AI_PROVIDER=ollama` (mặc định) dùng Ollama local. Khóa API chỉ nằm ở backend. Groq gói free giới hạn token mỗi phút: khi gặp 429 với thời gian chờ ngắn (≤ 10 giây) backend tự chờ rồi thử lại tối đa 2 lần, nếu không thì extractor báo "trợ lý tạm gián đoạn" và writer dùng bản nháp. Với Ollama, model mặc định (khi không đặt `OLLAMA_MODEL`) là `qwen2.5:3b` và được xử lý trên phần cứng máy backend. Có thể đặt `OLLAMA_MODEL` sang model đã cài để thử tốc độ/chất lượng khác, và `OLLAMA_KEEP_ALIVE` (mặc định `15m`) để giữ model đã nạp, tránh nạp lại giữa các lượt chat. Bộ trích xuất dùng context 2048 và giới hạn tối đa 192 token đầu ra. Model nhỏ hơn không đảm bảo nhanh hơn hoặc giữ nguyên chất lượng trên CPU; muốn giảm đáng kể thời gian cần GPU phù hợp hoặc máy chạy model mạnh hơn.

Số tiền khách nêu không kèm "tầm" hoặc "khoảng" được xem là mức tối đa. Khi không có mẫu đúng điều kiện, bot nới hãng rồi đến giá và nói rõ phần đã nới, không vượt mức tối đa khách nêu. Để chấm bot bằng Ollama và database đã nhập `data/shared-catalog.json`, chạy `node scripts/eval-advisor.mjs`.

Nội dung câu trả lời do code quyết định (sản phẩm, giá, câu hỏi tiếp theo); model chỉ viết lại cho tự nhiên. Câu model viết phải qua bước kiểm tra: không thêm số, hãng, thông số, lời hứa hay khẳng định có hàng mà bản nháp không có, không đổi nghĩa ngân sách và không nhầm vai khách. Câu không đạt được viết lại một lần, nếu vẫn không đạt thì dùng bản nháp. Câu hỏi về voucher, khuyến mãi, giao hàng, đổi trả hay bảo hành được trả lời bằng câu soạn sẵn, không để model tự nói. Đặt `ADVISOR_NATURAL_REPLIES=false` để luôn dùng bản nháp; `ADVISOR_REPLY_TIMEOUT_MS` (mặc định 30000) giới hạn thời gian chờ model viết. Chạy `EVAL_SHOW_REPLIES=true node scripts/eval-advisor.mjs` để xem từng câu trả lời khi chấm.

Admin có thể thêm/cập nhật sản phẩm, biến thể, giá, tồn kho và ẩn sản phẩm khỏi catalog mà không xóa dữ liệu đơn cũ. Thay đổi tồn kho qua màn hình sản phẩm được ghi vào lịch sử kho.

Vòng đời đơn do Admin xử lý theo thứ tự `PENDING_CONFIRMATION → CONFIRMED → SHIPPING → COMPLETED`. Chỉ được hủy khi đơn còn `PENDING_CONFIRMATION` hoặc `CONFIRMED`; hủy bắt buộc có lý do và hoàn kho trong cùng transaction. Đơn đã giao/hoàn thành không thể hủy. Hoàn tất đơn COD đồng thời ghi nhận đã thu tiền.

Giỏ hàng, đặt hàng và xem/hủy đơn cá nhân yêu cầu tài khoản Customer; Admin không thể tạo đơn hoặc dùng lịch sử đơn hàng của khách qua API khách hàng. Khách xem tiến trình đơn tại tab “Đơn hàng của tôi”; trạng thái tự tải lại mỗi 30 giây khi đang mở tab và có nút cập nhật thủ công. API đặt hàng hiện chỉ hỗ trợ COD; thanh toán QR chưa được tích hợp.

### Kho kiến thức và tư vấn cước

Ngày 15/11/2026 đã nhập thông số theo SKU cho 163 sản phẩm / 228 biến thể từ gói `racket-basic-specs`; 10 sản phẩm SKU nội bộ còn cần xác nhận định danh. Chạy `node scripts/import-racket-basic-specs.mjs` để kiểm tra và xem trước, thêm `--apply` để nhập. Script giữ nguyên thương mại, ảnh, ID, SKU và trạng thái duyệt; có backup, transaction và báo cáo tại `data/racket-basic-specs-import-report.md`. Các nguồn/thiếu sót chi tiết ở file JSON cùng tên.

`ProductVariant.attributes.manufacturerSpecs` giữ thông số có nguồn theo từng SKU. Chatbot dùng độ cứng, cân bằng và hạng cân ngay khi từng trường đủ rõ, không đòi mọi SKU phải đủ cả dải căng hoặc tự bật advisor. Thiếu/mâu thuẫn hoặc thang hãng chưa có ánh xạ thì không đoán. Chỉ có trần căng thì chặn vượt trần nhưng không xác nhận mức phù hợp hoặc tự tạo giới hạn dưới. Trang chi tiết hiển thị thông số theo biến thể đang chọn.

Sở thích nhẹ/nặng đầu được ưu tiên trước điểm phù hợp chung và giá; có mẫu khớp thì không lấp danh sách bằng mẫu ngược sở thích. Tên vợt không thêm nhãn đã/chưa căng dây; giá catalog là giá cây vợt, không tự cộng cước. Seed, importer và bước chuẩn bị catalog đã dùng cùng quy tắc làm sạch tên để không thêm lại nhãn đó.

Bản cập nhật tư vấn ngày 14/11/2026 bổ sung 12 chủ đề trong chính kho kiến thức hiện có cho vợt, cước và giày, cùng tra giá theo tên model từ catalog. Xem `data/consultation-knowledge-review.md` để biết các nhận định đã hiệu chỉnh, nguồn hãng, giới hạn dữ liệu và câu hỏi thử nghiệm. Nanogy 98 được thêm dưới dạng kiến thức có cảnh báo nguồn mâu thuẫn, không tạo sản phẩm bán hàng hay giá mới.

Đã nhập 7 sản phẩm cước Yonex từ `data/catalog-source/yonex-strings/` vào danh mục riêng **Cước** (`strings`) theo giá cửa hàng cung cấp ngày 14/11/2026, mỗi loại ban đầu 30 bộ. SKU nội bộ dùng tiền tố `HAVIE-YONEX-`; giá chỉ gồm bộ dây, chưa gồm công căng. Ảnh lần nhập này lưu trong `uploads/yonex-strings/`, được phục vụ qua `/uploads/`. Chưa xác nhận màu tồn kho từ ảnh minh họa. Kết quả nhập nằm trong `data/yonex-strings-import-result.json`.

`node scripts/import-yonex-strings.mjs` kiểm tra trước và xem kế hoạch, không ghi database. Thêm `--apply` để nhập qua image storage đã cấu hình, hoặc `--apply --local-images` để dùng ảnh local. Script kiểm tra hash ảnh, gauge theo kho kiến thức, sản phẩm/SKU trùng và ghi biến động kho trong transaction. Chạy lại cùng batch giữ giá và tồn kho hiện tại, không đặt lại 30 sau khi có bán hàng. Không tự duyệt nhận xét tư vấn hay thêm giới hạn căng cho cước.

`data/havie_badminton_knowledge.json` là dữ liệu tham khảo (không phải model đã huấn luyện): phân hạng U, điểm cân bằng, độ cứng thân, các cước Yonex (cỡ mm, nhóm công dụng, nhận xét) và dải căng gợi ý theo trình độ. `src/services/knowledgeBase.js` kiểm tra file khi nạp và truy xuất theo từ khóa: chỉ khi khách **hỏi** (so sánh, "là gì", "được không"...) mới lấy tối đa 3 mục liên quan, không đưa cả kho cho model. Mục truy xuất được đổi thành câu văn do backend dựng và đưa vào bản nháp, nên bước kiểm tra câu viết lại coi đó là dữ liệu tin cậy.

- Gợi ý của cửa hàng được gắn nhãn tham khảo; không trình bày như thông số hãng. Nguồn cộng đồng trong file chỉ để tra cứu, không được trích vào câu trả lời.
- Câu hỏi về đặc tính hoặc so sánh cước được trả lời riêng bằng kiến thức liên quan, không chuyển sang hỏi chọn vợt, không tự thêm giá hoặc thông tin kho. Câu “tôi muốn biết về cước BG65” được nhận diện cả khi không có dấu hỏi. AI chỉ diễn đạt lại dữ kiện đã kiểm tra; lịch sử nhu cầu và câu hỏi đang chờ vẫn được giữ để tiếp tục sau.
- Chỉ khi khách hỏi giá, backend mới tra giá từ ProductVariant qua `searchYonexStrings`, sau đó ghép giá nguyên văn ngoài phần AI viết lại. Hỏi giá đơn thuần không kèm bài giới thiệu sản phẩm hoặc bảng giá công căng. Giá thiếu hoặc truy vấn lỗi được báo rõ, không bịa giá.
- Chatbot không cung cấp thông tin tồn kho. Số lượng kho và các trường nội bộ/bảo mật bị loại khỏi dữ liệu chat, kể cả candidate payload trong lịch sử được đọc lại; dữ liệu kho vẫn dùng nội bộ để lọc hàng bán được. Yêu cầu lấy dữ liệu nội bộ công ty, tài khoản, thông tin cá nhân, mật khẩu, OTP, khóa API và chỉ thị hệ thống được từ chối trước khi gọi AI hay tra dữ liệu. Bộ kiểm tra câu viết lại chặn thông tin liên hệ cá nhân, khóa bí mật và số lượng kho phát sinh. Các biện pháp này áp dụng cho chatbot; API catalog/admin hiện có vẫn theo phân quyền và chức năng riêng.
- `src/services/tensionAdvisor.js`: khung căng theo trình độ trong kho kiến thức là **gợi ý giáo dục, không phải mức của Yonex**: mới chơi 18-22 lbs, phong trào 22-24, trung bình 24-26, khá 26-28, thi đấu 28-30+ (bậc cuối không tự gợi ý). Hồ sơ khách chỉ có 3 mức nên ghép: beginner = 18-22, intermediate = 22-26, advanced = 26-28. Khung này luôn được **giao** với khoảng hãng khuyến nghị (`stringingMinLbf`–`stringingMaxLbf` của đúng biến thể vợt đã duyệt): không giao thì không đề xuất, không kéo về mép. Mức khách hỏi nằm ngoài khoảng hãng (cao hay thấp) không được chốt. Chưa có giới hạn đã xác minh hoặc chưa biết mẫu vợt thì chỉ nói khoảng tham khảo chung và không xác nhận mức nào an toàn. `11 kg`/`11 ký` khi bàn về căng được quy đổi kgf sang lbs (hệ số 2.20462); `căng 24` không kèm đơn vị thì bot hỏi lại lbs hay kg; đường kính cước (mm) không bao giờ bị đọc thành lực căng.
- Hồ sơ nhu cầu có thêm `balancePreference` (nặng đầu/cân bằng/nhẹ đầu) và `shaftFlexPreference`, đọc bằng quy tắc (câu phủ định như "không thích nặng đầu" không được ghi). Hai trường chỉ xếp hạng mềm, không loại mẫu nào, và chỉ tính khi vợt có thông số tương ứng. Hồ sơ lưu trước đây vẫn nạp được.
- - Kho kiến thức cũng có quy tắc chỉnh căng theo cảm giác (hay lệch tâm thì cân nhắc giảm 1-2 lbs, đau cổ tay thì không tăng căng, không có quy luật căng cố định theo đơn/đôi hay nặng/nhẹ đầu), gắn nhãn tham khảo. `data/havie_badminton_knowledge.json` được kiểm tra khi nạp: mã độ cứng (flexible, medium, stiff, extra_stiff), cân bằng, hạng 2U-6U và 7 cước bắt buộc phải khớp với catalog.
- Câu trả lời ngắn "đơn", "đôi", "cả hai", "chưa", "rồi" được hiểu theo câu hỏi ngay trước, không gọi model.
- `data/advisor-specs-todo.json` (tạo bằng `node scripts/build-advisor-specs-sheet.mjs`) là danh sách vợt cần nhập thông số chính hãng (độ cứng, cân bằng, khối lượng, dải căng, `sourceUrl`). Vợt chưa có đủ thông số được duyệt thì bot chưa tư vấn cước cho vợt đó.

### Chọn vợt phù hợp theo kho kiến thức

Khách nêu "3tr", "ngân sách 3 triệu" hoặc "tầm 3 triệu" được hiểu là giá mục tiêu: từ 1 triệu trở lên dùng khoảng ±200.000 VNĐ (3 triệu → 2.800.000–3.200.000); dưới 1 triệu dùng ±100.000 VNĐ (500k → 400.000–600.000). Khi khách nói "tối đa", "không quá", "chỉ có" hay "có X thôi", số tiền là trần cứng, không được vượt. Giá do backend lọc từ catalog trước khi xếp hạng BM25/semantic; LLM không tự chọn khoảng giá.
Khi không có kết quả, bot có thể gợi ý hãng khác trong cùng khoảng giá hoặc hỏi khách đổi ngân sách; không tự mở rộng giá để lấy sản phẩm xa mức khách hỏi.

Bot không chỉ lấy vài vợt gần ngân sách nhất. `racquet.suitability_rules` trong `data/havie_badminton_knowledge.json` định nghĩa luật hợp/không hợp (theo trình độ, đánh đơn/đôi, ưu tiên, sở thích trọng lượng/cân bằng/độ cứng) và được kiểm tra khi nạp. `src/services/racketSuitability.js` áp luật đó lên từng vợt đang bán trước khi cắt còn 5 mẫu:
- Chỉ dùng thông tin cây vợt thật sự có: hạng U của biến thể, độ cứng và điểm cân bằng từ thông số đã duyệt hoặc từ mô tả sản phẩm của shop (câu trả lời ghi rõ "theo mô tả của shop"). Thiếu thông tin nào thì không đoán, vợt đó ở mức "chưa đủ dữ liệu".
- Loại hẳn vợt trái hướng dẫn (ví dụ thân rất cứng với người mới); vợt "cần lưu ý" (ví dụ 3U với người mới) chỉ được bổ sung khi có ít hơn 3 vợt hợp. Số mẫu đã loại được nói rõ trong câu trả lời.
- Cùng một sản phẩm có nhiều biến thể thì chọn biến thể hợp nhất (ví dụ 4U thay vì 3U cho người mới). Thứ tự hiển thị: hợp nhất trước, rồi gần ngân sách.
- Giày chưa có luật nên không bị lọc.

### BM25 và semantic retrieval trên máy

Luồng tư vấn hiện có dùng chung bộ xếp hạng trong `src/services/hybridRetrieval.js`. Kho JSON được chia thành đoạn theo từng mục, có đường dẫn nguồn; không tạo kho kiến thức hay API tư vấn thứ hai. Chỉ kiến thức cho khách được lập chỉ mục, không đưa chỉ thị nội bộ vào câu trả lời. BM25 chuẩn hóa tiếng Việt có/không dấu; semantic dùng embedding BGE-M3 qua Ollama và cosine similarity; hai danh sách được gộp bằng reciprocal rank fusion. Luật trả lời đúng model, quy đổi đơn vị và kiểm tra mức căng vẫn có ưu tiên.

Với vợt, hệ thống xếp hạng theo mô tả công khai và thông số đã xác minh **sau** khi lọc ngân sách, hãng, tình trạng bán và độ hợp, **trước** khi lấy tối đa 5 mẫu. Vợt trái yêu cầu nhẹ/nặng đầu hoặc bị loại vì trình độ không được semantic đưa trở lại. Điểm tìm kiếm không phải chứng cứ xác nhận thông số; lý do tư vấn vẫn lấy từ dữ liệu đã duyệt.

Chạy `ollama pull bge-m3` một lần, để Ollama hoạt động trên máy rồi khởi động backend. Không cần khóa embedding hoặc sửa `.env`. Mặc định dùng `http://127.0.0.1:11434`, model `bge-m3`; chỉ chấp nhận endpoint loopback. Có thể đặt biến tiến trình `HAVIE_EMBEDDING_URL`, `HAVIE_EMBEDDING_MODEL`; đặt `HAVIE_SEMANTIC_SEARCH=false` để chỉ dùng BM25. Vectors được cache trong RAM theo model/endpoint/nội dung, tự thay khi nội dung đổi, giới hạn 2048 mục. Backend làm nóng embedding kiến thức khi khởi động; lần lập chỉ mục đầu có thể mất vài chục giây. Ollama lỗi thì tự dùng BM25, không làm hỏng chat. Groq cho trích xuất nhu cầu/viết câu trả lời vẫn giữ nguyên.

Kết quả BM25 đứng đầu được giữ trong ba kết quả đầu của bước tìm kiến thức để các đoạn liên quan rộng về ngữ nghĩa không đẩy mất đoạn khớp từ khóa cụ thể. Bộ lọc và thứ tự độ hợp vẫn quyết định danh sách vợt; điểm hybrid chỉ xếp hạng tiếp trong cùng mức độ hợp.

Thử nghiệm thực với model local: `node scripts/evaluate-hybrid-retrieval.mjs`. Báo cáo so sánh BM25/hybrid nằm ở `data/hybrid-retrieval-evaluation.json`; bộ câu hỏi nhỏ chỉ là kiểm tra ban đầu, chưa chứng minh độ chính xác cho mọi câu hỏi. API embedding dựa trên [tài liệu Ollama](https://docs.ollama.com/api/embed), model theo [BGE-M3](https://ollama.com/library/bge-m3).
