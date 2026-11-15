import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';

export default function Footer() {
  return (
    <footer className="footer" id="about">
      <div className="container footer-grid">
        <section aria-label="Giới thiệu HAVIE">
          <Link className="footer-logo" to="/" aria-label="Trang chủ HAVIE">
            <Logo onDark />
          </Link>
          <p>Vượt mọi giới hạn.</p>
          <p>Dành trọn đam mê cho cầu lông.</p>
        </section>
        <section>
          <h2>KHÁM PHÁ</h2>
          <Link to="/products">Tất cả sản phẩm</Link>
          <Link to="/products?category=rackets">Vợt cầu lông</Link>
          <Link to="/products?category=shoes">Giày cầu lông</Link>
          <Link to="/about">Về chúng tôi</Link>
        </section>
        <section>
          <h2>HỖ TRỢ</h2>
          <a href="tel:0329596879">Hotline: 0329 596 879</a>
          <a href="mailto:hoangvietdinh0506@gmail.com">Email liên hệ</a>
          <Link to="/cart">Giỏ hàng</Link>
          <Link to="/favorites">Sản phẩm yêu thích</Link>
          <Link to="/auth">Tài khoản của tôi</Link>
        </section>
        <section>
          <h2>CÙNG ĐAM MÊ CẦU LÔNG</h2>
          <p>Thiết kế cho sân đấu, phù hợp mỗi ngày.</p>
          <p>66 Đường D1, Phường Tăng Nhơn Phú, TP Thủ Đức</p>
          <p>Mở cửa 8:00 – 21:00 hằng ngày</p>
        </section>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Cửa hàng cầu lông HAVIE</span>
        <span>Chỉn chu trong từng chi tiết.</span>
      </div>
    </footer>
  );
}
