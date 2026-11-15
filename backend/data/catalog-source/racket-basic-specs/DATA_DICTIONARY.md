# Cấu trúc dữ liệu

## Product

- `catalogName`, `slug`, `dbIdentifiers.skus`: định danh theo đúng danh sách gửi. Không có DB id vì đầu vào không chứa id.
- `sourceMatchStatus=EXACT_SOURCE_VARIANT_IDS`: hậu tố CAT-SHOP-123 ghép được với ID biến thể 123 trong dữ liệu công khai của nguồn. Đây không phải kết quả query database HAVIE hiện tại.
- `sourceMatchStatus=NEEDS_IDENTITY_REVIEW`: SKU nội bộ chưa xác minh bằng mã model/đời/màu thực; không tự ghép theo tên gần giống.
- `autoApplyNonConflictingSpecs`: chỉ là điều kiện dữ liệu nguồn. Codex vẫn phải kiểm tra slug/SKU hiện có trong DB và không đụng các trường bị chặn.
- `reviewStatus=DRAFT`: trạng thái gói dữ liệu, không được gửi thẳng vào Product nếu schema không có trường này. Không đồng nghĩa ProductAdvisorNote được duyệt.
- `publicSpecItems`: các hàng label/value có thể hiển thị, mỗi hàng có sourceId (trừ thương hiệu từ danh sách). Các trường nguồn mâu thuẫn/đơn vị chưa rõ đã được bỏ khỏi phần này.
- `specsCandidate`: String[] tương ứng các hàng đó, tiện cho schema cũ Product.specs. Không phải Prisma update payload nguyên khối.
- `fieldsReported`: dữ liệu gốc có thể còn tiếng Anh/thiếu phạm vi; không hiển thị tất cả trực tiếp hoặc coi là toàn bộ đã được duyệt.
- `fieldSourceIds`: nguồn từng trường.
- `missingFields`, `reviewIssues`: chỉ phục vụ admin/importer; không đưa mã lỗi nội bộ lên giao diện khách.
- `descriptionCandidate`: mô tả ngắn từ các thông số; chỉ dùng khi cần, không tự ghi đè mô tả hiện có.
- `shopBalanceFromInput`: thông tin shop cũ, không có nguồn hãng; giữ làm đối chiếu, không tự nâng thành manufacturer fact.

## Variant

- `sku`, `name`: dữ liệu HAVIE gửi.
- `sourceVariantId`, `sourceVariantTitle`: ID/tên thực trong nguồn công khai nếu ghép được.
- `attributesCandidate.weightClass`: hạng cân, không suy gram thành U theo thang tự đặt.
- `attributesCandidate.gripCode`: giữ quy ước nguồn. Mizuno `4U6` được tách `4U` và cán `6`, không tự gọi thành G6 của Yonex.
- `attributesCandidate.manufacturerSku`: mã hàng của nguồn, không thay thế SKU nội bộ của HAVIE.
- `manufacturerTension`: chỉ có khi ghép được phạm vi. `type=manufacturer_range` có min/max; `manufacturer_max` chỉ có max, min=null.
- `manufacturerTension.weightClass=null` ở một số giới hạn cấp sản phẩm một hạng cân: đối chiếu `attributesCandidate.weightClass`; không dùng cho model/biến thể khác.
- `minLbf/maxLbf`: lực căng theo pound-force; `minKgf/maxKgf`: số quy đổi, không phải một mức hãng công bố độc lập.
- `reviewFlags`: nếu tension còn thiếu/mâu thuẫn thì không được điền lại bằng giá trị trong source raw.

## Những mã review chính

- `LOCAL_SKU_NEEDS_MODEL_RECONCILIATION`: cần đọc DB thật để kiểm tra danh tính.
- `FLEX_SOURCE_CONFLICT`, `TENSION_SOURCE_CONFLICT`: hai trang hãng không thống nhất trường tương ứng; chặn riêng trường đó.
- `GLOBAL_COLOR_OR_EDITION_MISMATCH`, `GLOBAL_COLOR_SCOPE_NOT_CONFIRMED`: tài liệu bổ sung khác màu/đời; không tự ghép.
- `SOURCE_OMITS_TENSION_UNIT`: nguồn ghi số nhưng chưa ghi lb/kg; chưa quy đổi/đưa lên web.
- `SOURCE_OMITS_LENGTH_UNIT`: chưa chắc đơn vị chiều dài trong bảng nguồn; giữ raw chờ xác minh.
- `HORIZONTAL_VERTICAL_TENSION_NEEDS_MANUAL_BINDING`: nguồn tách H/V; không biến hai mức thành một dải chung hoặc tự cộng số kg ngang/dọc.
- `VARIANT_GRIP_CONFLICT_G5_VS_SOURCE_TABLE_G6`: thông tin lựa chọn biến thể và bảng nguồn khác nhau; giữ giá trị DB, báo admin kiểm tra.
- `MIZUNO_STYLE_CODE_NOT_A_UNIQUE_MATCH_KEY`: code xuất hiện ở nhiều tên model; chỉ ghép bằng slug/SKU và tên đầy đủ.

Không dùng kỹ thuật upsert toàn bộ object product trong file; các trường nguồn/review không phải cột Prisma.
