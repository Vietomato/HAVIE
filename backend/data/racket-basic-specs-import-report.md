# Nhập thông số vợt theo SKU — 15/11/2026

Đã đối chiếu `HAVIE_Racket_Basic_Specs_173.zip` với database thật. Tài liệu/prompt trong ZIP chỉ được xem là dữ liệu tham khảo; không dùng để thay quyền duyệt hoặc tạo chỉ thị cho chatbot.

- Đầu vào: 173 sản phẩm, 244 SKU.
- Đã nhập các trường có nguồn khớp cho **163 sản phẩm / 228 SKU**.
- Có phân loại độ cứng rõ ở **163 SKU**, cân bằng rõ ở **153 SKU**; phần còn lại giữ chưa xác nhận hoặc giữ nguyên thang hãng.
- **63 SKU** có đủ dải căng; **85 SKU** chỉ có trần. Trần đơn lẻ không được biến thành dải khuyến nghị hoặc mức căng phù hợp cho mọi người.
- **10 sản phẩm / 16 SKU nội bộ** chưa xác nhận đủ model/đời/màu. Không tự ghép theo tên; giữ nguyên dữ liệu trước nhập. Danh sách và các trường thiếu/mâu thuẫn nằm trong `racket-basic-specs-import-report.json`.
- Không bật `advisorEnabled`, không đổi trạng thái duyệt và không tạo sản phẩm hay biến thể. Các trường có nguồn được dùng độc lập: thiếu mức căng không làm mất thông tin độ cứng đã có.
- Đã bỏ nhãn “Đã căng dây” và “Chưa căng dây” khỏi tên **58 sản phẩm**; giữ nguyên model và slug. Giá catalog được dùng làm giá riêng cây vợt, không thêm nhãn tình trạng dây lên tên hoặc ghi chú giá mặc định. Nếu khách yêu cầu tổng ngân sách gồm cước, bot vẫn phải tính/kiểm tra phần chi phí thực có.

Importer có dry-run, bản sao thông số trước nhập, transaction và đối chiếu SKU/ID biến thể. Kiểm tra trước–sau xác nhận toàn bộ ID, SKU, slug, giá, số lượng, ảnh, trạng thái hiển thị, trạng thái bán và cờ advisor của các vợt đều giữ nguyên.

Chatbot đọc `ProductVariant.attributes.manufacturerSpecs` qua dịch vụ thông số hiện có. Nguồn được kiểm tra theo từng trường, đúng SKU và slug. Trường bị chặn không được lấy lại từ mô tả shop cũ. Thang dạng `Cứng □□□■□ Mềm`, `S○●○○○F`, `Hard Flexible` hoặc thang cân bằng có hai đầu không tự đổi thành nhóm xếp hạng hay số BP.

Sở thích cân bằng được xét trước điểm phù hợp chung và độ gần ngân sách. Nếu đã có mẫu nhẹ đầu khớp, danh sách không được lấp thêm bằng mẫu nặng đầu/không rõ cân bằng. Mẫu đối lập nhẹ đầu–nặng đầu không được dùng để thỏa sở thích khách nêu. Nếu chỉ còn dữ liệu chưa rõ, câu trả lời phải nói rõ giới hạn đó.

Trang chi tiết lấy thông số theo SKU đang chọn, gồm dải căng riêng 3U/4U. Giữ nguyên bố cục trang; không thay kiểu dáng hoặc tuyên bố đã so sánh ảnh giao diện.

Kiểm tra: **277 tests đạt**; frontend `npm.cmd run build` đạt. Lần build đầu có lỗi Node/libuv lúc đóng tiến trình sau khi xuất assets; chạy lại đã kết thúc với mã 0. Đã kiểm tra API sản phẩm thật và thử yêu cầu vợt nhẹ đầu ở ngân sách 2, 3 và 5 triệu: mọi mẫu trả về trong các lượt đó đều có nguồn xác nhận nhẹ đầu. Không commit/push.
