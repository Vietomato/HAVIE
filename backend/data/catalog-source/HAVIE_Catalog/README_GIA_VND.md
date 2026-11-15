# Cập nhật giá VND — 01/11/2026

211/340 mục catalog có giá VND đề xuất nháp. Còn 129 mục chưa tìm được giá VN đủ khớp, giữ null, không quy đổi ngoại tệ và không bịa giá.

## Nguồn và phạm vi
- VNB, HVShop, XBSports và các trang shop trả về trong tra cứu, URL và ngày đọc ở price-review.vnd.csv/json.
- 76 mục Mizuno dùng giá VND có sẵn trong snapshot chính thức Mizuno Việt Nam ngày 31/10/2026, KHÔNG gọi là giá vừa xác minh ngày 01/11.
- Ghép theo model chuẩn hóa tên; chưa xác nhận đầy đủ phiên bản năm, màu, nhóm trọng lượng, phom, hệ size và bảo hành giữa thị trường nguồn và Việt Nam. Các giá này chưa phải báo giá chính xác cho mọi biến thể.
- Ưu tiên quan sát có ghi rõ Có bảo hành; nếu trang có khoảng giá, giá đề xuất lấy cận trên của khoảng đã chọn, không lấy giá niêm yết gạch ngang. Có thể khác giá khách nhận ở chi nhánh hoặc chương trình ưu đãi.
- Không dùng source_available làm tồn kho HAVIE. Không suy giá bằng tỷ giá.

## Các trường đã cập nhật
- products.json: havie_price_vnd là GIÁ ĐỀ XUẤT NHÁP; vn_price_reference giữ nguồn, phạm vi và điều kiện.
- variants.json: havie_price_vnd có thể kế thừa GIÁ MODEL, scope=model_reference_not_variant_quote; cần kiểm tra trước khi dùng bán hàng. Với Mizuno dùng giá snapshot đúng source_variant_id.
- source_price/source_currency giữ nguyên để truy xuất nguồn ngoại tệ, không phải giá hiển thị HAVIE. price_currency là VND.
- approved-products.template.json: price đã điền khi có nguồn, reviewStatus vẫn pending, advisorEnabled=false, isActive=false, tồn kho 0, isAvailable=false. Những mục thiếu giá vẫn có price=null. Không nhập toàn file qua importer yêu cầu mọi price là số dương.
- CSV, SQLite payload và SQL staging được đồng bộ với JSON. SQL chỉ dành cho staging, không tự cập nhật bảng products của HAVIE.
- vn-price-observations.json chứa các quan sát giá từ shop, có thể có nhiều giá/điều kiện cho cùng model.
- price-review.vnd.csv mở được bằng Excel; missing-vn-prices.json là danh sách cần dò tiếp.

## Cách dùng với thư mục đã giải nén trên máy
1. Giải nén bản ZIP cập nhật vào backend/data/catalog-source; chọn ghi đè thư mục HAVIE_Catalog đang có.
2. Mở HAVIE_Catalog/price-review.vnd.csv để xem bảng giá và nguồn.
3. Chưa chạy seed cũ hoặc import-catalog.mjs với approved-products.template.json: còn mục price=null, chưa ghép với sản phẩm cũ trong DB và chưa xác nhận giá bán/tồn kho.
4. Bước nhập DB tiếp theo phải ghép model/biến thể, giữ giá cũ và nhận xét cũ, dùng danh sách đã xác nhận. Gói này chỉ cập nhật dataset, KHÔNG truy cập database của bạn.

340 mục là các listing theo nguồn/khu vực, không phải 340 model độc nhất, cũng không phải toàn bộ catalog toàn cầu.
