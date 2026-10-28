import React from 'react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="footer" id="about">
      <div className="container footer-grid">
        <section>
          <Link className="footer-logo" to="/">
            HAVIE.
          </Link>
          <p>Vượt mọi giới hạn.</p>
          <p>Dành trọn đam mê cho cầu lông.</p>
        </section>
        <section>
          <h3>KHÁM PHÁ</h3>
          <Link to="/products">Tất cả sản phẩm</Link>
          <Link to="/products?category=rackets">Vợt cầu lông</Link>
          <Link to="/products?category=shoes">Giày cầu lông</Link>
        </section>
        <section>
          <h3>HỖ TRỢ</h3>
          <a href="mailto:hello@havie.example">Liên hệ</a>
          <Link to="/cart">Giỏ hàng</Link>
          <Link to="/auth">Tài khoản của tôi</Link>
        </section>
        <section>
          <h3>CÙNG ĐAM MÊ CẦU LÔNG</h3>
          <p>Thiết kế cho sân đấu, phù hợp mỗi ngày.</p>
          <span className="footer-note">Dữ liệu sản phẩm trực tiếp từ API HAVIE</span>
        </section>
      </div>
      <div className="container footer-bottom">
        © 2026 Cửa hàng cầu lông HAVIE <span>Chỉn chu trong từng chi tiết.</span>
      </div>
    </footer>
  );
}
