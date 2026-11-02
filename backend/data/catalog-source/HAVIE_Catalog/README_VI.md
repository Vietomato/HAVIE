> BẢN CẬP NHẬT GIÁ VND 01/11/2026: đọc README_GIA_VND.md trước. Giá havie_price_vnd hiện là đề xuất NHÁP theo shop VN, chưa duyệt bán.

> BẢN CẬP NHẬT GIÁ VND 01/11/2026: đọc README_GIA_VND.md trước. Giá havie_price_vnd hiện là đề xuất NHÁP theo shop VN, chưa duyệt bán.

> BẢN CẬP NHẬT GIÁ VND 01/11/2026: đọc README_GIA_VND.md trước. Giá havie_price_vnd hiện là đề xuất NHÁP theo shop VN, chưa duyệt bán.

# HAVIE — Dataset catalog vợt và giày bốn hãng

Ngày chốt: 31/10/2026. Nguồn: Yonex Mỹ, Li-Ning Singapore, Mizuno Việt Nam, Victor Australia. Đây là ảnh chụp các danh mục vùng đã lấy, KHÔNG phải toàn bộ catalog trên mọi thị trường của bốn hãng. Model mới chưa lên các vùng này có thể thiếu. Hàng hết trên nguồn vẫn giữ để đối chiếu; không kết luận đã ngừng sản xuất.

## Phạm vi và số lượng

| Hãng | Vợt | Giày | Tổng bản ghi sản phẩm |
| --- | ---: | ---: | ---: |
| Yonex | 62 | 27 | 89 |
| Li-Ning | 86 | 14 | 100 |
| Mizuno | 49 | 27 | 76 |
| Victor | 46 | 29 | 75 |
| Tổng | 243 | 97 | 340 |

2.339 bản ghi biến thể; 2.851 liên kết ảnh từ nguồn. “Sản phẩm” là bản ghi listing, không phải số model độc nhất: cùng tên có thể khác màu, giới tính, form hoặc mùa. `possible_duplicate_models.json` chỉ nhóm ứng viên để duyệt, không tự gộp. Ba bản ghi bộ sản phẩm/loại giày chưa rõ bị tách ra `excluded.json`.

## File sử dụng

- `products.json/.csv`: sản phẩm, loại, thị trường, URL nguồn, thông số trích có điều kiện, ảnh và trạng thái duyệt.
- `variants.json/.csv`: SKU nguồn, ID biến thể, giá gốc/tiền tệ, lựa chọn gốc và thuộc tính trích.
- `images.json/.csv`: mọi URL ảnh, kích thước, ảnh tương ứng biến thể nếu nguồn cung cấp.
- `images/`: ảnh đại diện đã tải được; xem kết quả thực tế trong `image_downloads.json`.
- `image_downloads.json`: tải thành công/thất bại, đường dẫn và mã SHA256. Không suy từ URL rằng ảnh đã có trên đĩa.
- `catalog.sqlite`: database staging mở bằng DB Browser for SQLite; không phải bản thay thế PostgreSQL của HAVIE.
- `import-staging.postgres.sql`: tạo schema staging PostgreSQL riêng, không ghi bảng kinh doanh HAVIE.
- `approved-products.template.json`: mẫu dữ liệu chuẩn bị duyệt để nhập vào schema Prisma hiện có.
- `import-havie.mjs`: importer sau khi duyệt, mặc định dry-run.
- `coverage.json`, `summary.json`, `validation.json`: phạm vi, số lượng, kiểm tra.

## Giá và tồn kho

Không quy đổi giá ngoại tệ thành VND. USD là nguồn Mỹ; SGD là nguồn Singapore; AUD là nguồn Australia; VND là nguồn Việt Nam. Tiền tệ gắn theo thị trường storefront, cần xác minh lại trước sử dụng thương mại.

Giá 0 trên nguồn được đưa về null, KHÔNG xem là miễn phí. `source_available` là trạng thái nguồn, không phải số lượng tồn HAVIE. `havie_price_vnd` và `havie_stock_quantity` đang để null. Không tạo giá, số lượng bán, điểm review hoặc nhãn “phù hợp người mới” giả.

## Thông số và biến thể

`specification_excerpts` là các dòng ngắn lấy từ mô tả kỹ thuật; chưa duyệt thành thông số chuẩn. Dữ liệu mô tả đầy đủ không được đóng gói lại để sao chép bài quảng cáo. Trọng lượng U và grip G chỉ trích khi có ký hiệu rõ trong options. Các giá trị khác giữ trong `options`. Không chuyển size giữa EU/US/UK khi nguồn không cho bảng quy đổi. Không suy grip còn thiếu từ mã size không rõ. Cần kiểm tra giới hạn căng theo đúng biến thể trước chatbot sử dụng.

## Ảnh và watermark

Ảnh lấy từ URL CDN của trang nguồn, không tạo ảnh sản phẩm giả. Bản local là ảnh đại diện yêu cầu CDN ở bề rộng 800 để gói tải gọn; URL ảnh gốc đầy đủ vẫn giữ trong bảng images. Bytes tải về được giữ nguyên, không xóa watermark, logo hãng hoặc chỉnh chi tiết sản phẩm.

CHƯA kiểm tra trực quan toàn bộ ảnh. Vì vậy `watermark_status = not_visually_reviewed`, không chứng nhận “mọi ảnh không watermark”. Nếu ảnh có watermark của bên bán, ưu tiên thay bằng ảnh gốc được phép sử dụng; chưa có ảnh thay thì giữ trạng thái cần duyệt. Logo in trên vợt/giày không phải lỗi cần xóa. Nguồn công khai không tự đồng nghĩa được cấp quyền tái sử dụng thương mại; `license_status = not_verified`.

## Nhập staging vào PostgreSQL

Chạy từ terminal, thay đường dẫn và database:

```powershell
psql -U postgres -d havie -f "C:\duong-dan\HAVIE_Catalog\import-staging.postgres.sql"
```

Kiểm tra:

```sql
SELECT brand, category, COUNT(*)
FROM havie_catalog_staging.products
GROUP BY brand, category
ORDER BY brand, category;
```

Script tạo schema `havie_catalog_staging`, dùng ID nguồn có namespace làm khóa. Có thể chạy lại để cập nhật payload; không xóa dữ liệu staging cũ không còn trong file. Chưa thực thi script này trên database PostgreSQL của người dùng.

## Nhập vào bảng Product và ProductVariant của HAVIE

1. Sao chép `approved-products.template.json` thành `approved-products.json` và chỉ giữ sản phẩm muốn đưa vào HAVIE.
2. Duyệt đúng model, đời, biến thể, ảnh và quyền sử dụng; xử lý trùng với database hiện tại. Đổi slug nếu cần.
3. Điền `price` nguyên dương theo VND cho từng biến thể, không lấy giá Mỹ/Singapore làm giá VND.
4. Chỉ đổi `reviewStatus` thành `approved` sau khi duyệt. `specs` để trống cho đến khi xác nhận thông số; không tự chuyển nhận xét quảng cáo thành thông số.
5. Copy `import-havie.mjs` vào `backend/scripts/import-catalog.mjs`.
6. Trong thư mục backend đã cấu hình Prisma và DATABASE_URL:

```powershell
node scripts/import-catalog.mjs "C:\duong-dan\approved-products.json"
node scripts/import-catalog.mjs "C:\duong-dan\approved-products.json" --apply
```

Lệnh đầu chỉ kiểm tra dữ liệu. Lệnh sau tạo sản phẩm mới; gặp slug đã tồn tại thì từ chối thay vì ghi đè. Mỗi sản phẩm dùng một transaction: nếu lỗi ở sản phẩm sau thì sản phẩm trước đã nhập vẫn tồn tại; sau đó cần loại bản ghi đã nhập khỏi file khi tiếp tục. Đây không phải transaction cho toàn bộ batch.

Mọi biến thể nhập ở trạng thái `stockQuantity=0`, `isAvailable=false` dù file yêu cầu khác, để người quản trị đối soát giá/kho trước mở bán. Không chạy seed cũ với file này: seed cũ có thể tự bật isAvailable. Importer giữ rating mặc định 0, không tạo đánh giá giả. Chưa chạy importer vào database HAVIE thực tế.

## Giới hạn và phần còn thiếu

- Chưa bảo đảm tất cả model toàn cầu, đặc biệt mẫu riêng thị trường Trung Quốc/Nhật và mẫu vừa công bố.
- Niêm yết trong collection không chứng minh còn sản xuất hoặc còn hàng tại Việt Nam.
- Chưa kiểm chứng kỹ thuật từng dòng thông số và hình ảnh toàn bộ.
- Chưa xác minh tồn kho HAVIE, quyền ảnh hoặc giá bán nội bộ.
- Chưa kiểm thử importer với PostgreSQL đang chạy; đã kiểm tra cú pháp JavaScript và tính toàn vẹn SQLite/ID.
- Dùng dataset để dựng catalog và duyệt dữ liệu; chưa nạp trực tiếp mọi thông số vào chatbot như dữ kiện đã phê duyệt.

## Nguồn danh mục

- https://us.yonex.com/collections/badminton-racquets
- https://us.yonex.com/collections/badminton-shoes
- https://sg.lining.studio/collections/badminton-racket
- https://sg.lining.studio/collections/badminton-shoes
- https://vnm.mizuno.com/collections/badminton-rackets
- https://vnm.mizuno.com/collections/badminton
- https://shop.au.victorsport.com/collections/rackets
- https://shop.au.victorsport.com/collections/footwear

Mỗi bản ghi có URL sản phẩm để đối chiếu riêng. Thay đổi theo thời gian là bình thường.
