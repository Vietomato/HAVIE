import React from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Clock,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Truck,
} from 'lucide-react';
import Breadcrumbs from '../components/Breadcrumbs.jsx';
import { BRANDS, BrandLogoLink } from '../components/BrandStrip.jsx';
import { Reveal, RevealItem } from '../components/motion.jsx';
import usePageTitle from '../hooks/usePageTitle.js';
import { STORE } from '../content/store.js';

const SHOP = {
  address: '66 Đường D1, Phường Tăng Nhơn Phú, TP Thủ Đức',
  phone: '0329596879',
  phoneLabel: '0329 596 879',
  contactName: 'Hoàng Việt',
  email: 'hoangvietdinh0506@gmail.com',
  hours: '8:00 – 21:00 hằng ngày',
};

const MAP_URL =
  'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(SHOP.address);

const REASONS = [
  {
    icon: MessageCircle,
    title: 'Tư vấn đúng nhu cầu',
    text: 'Cho chúng tôi biết trình độ, ngân sách và lối chơi của bạn. Trợ lý tư vấn trên web hoặc đội ngũ HAVIE sẽ gợi ý vợt, cước phù hợp.',
  },
  {
    icon: BadgeCheck,
    title: 'Sản phẩm chính hãng',
    text: 'Vợt, giày, trang phục và phụ kiện từ các thương hiệu cầu lông uy tín, được kiểm tra kỹ trước khi giao đến tay bạn.',
  },
  {
    icon: Truck,
    title: 'Mua sắm đơn giản',
    text: 'Giao hàng toàn quốc, nhận hàng rồi mới thanh toán (COD). Sản phẩm bị lỗi được đổi sang sản phẩm mới.',
  },
];

export default function About() {
  usePageTitle('Về chúng tôi');

  return (
    <div className="container page-pad about-page">
      <Breadcrumbs items={[{ label: 'Trang chủ', to: '/' }, { label: 'Về chúng tôi' }]} />

      <Reveal as="header" className="about-hero" y={20}>
        <span className="eyebrow">VỀ CHÚNG TÔI</span>
        <h1>Trang bị chỉn chu cho từng trận cầu</h1>
        <p>
          {STORE.description}
        </p>
      </Reveal>

      <section className="about-section" aria-labelledby="about-values">
        <h2 id="about-values">Sứ mệnh và tầm nhìn</h2>
        <div className="store-values">
          <article><h3>Sứ mệnh</h3><p>{STORE.mission}</p></article>
          <article><h3>Tầm nhìn</h3><p>{STORE.vision}</p></article>
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-why">
        <Reveal>
          <span className="eyebrow">VÌ SAO CHỌN HAVIE</span>
          <h2 id="about-why">Mua đúng, chơi hay</h2>
        </Reveal>
        <div className="about-reasons">
          {REASONS.map(({ icon: Icon, title, text }, index) => (
            <RevealItem key={title} index={index}>
              <article className="about-reason">
                <Icon size={28} aria-hidden="true" />
                <h3>{title}</h3>
                <p>{text}</p>
              </article>
            </RevealItem>
          ))}
        </div>
      </section>

      <section className="about-section" aria-labelledby="about-brands">
        <Reveal>
          <span className="eyebrow">THƯƠNG HIỆU</span>
          <h2 id="about-brands">Các hãng đang có tại HAVIE</h2>
        </Reveal>
        <Reveal as="ul" className="about-brands" delay={0.05}>
          {BRANDS.map((brand) => (
            <li key={brand.slug}>
              <BrandLogoLink brand={brand} />
            </li>
          ))}
        </Reveal>
      </section>

      <section className="about-section" aria-labelledby="about-contact">
        <Reveal>
          <span className="eyebrow">LIÊN HỆ</span>
          <h2 id="about-contact">Ghé thăm hoặc nhắn cho chúng tôi</h2>
        </Reveal>
        <Reveal className="about-contact" delay={0.05}>
          <dl className="about-contact-list">
            <div>
              <MapPin size={22} aria-hidden="true" />
              <dt>Địa chỉ</dt>
              <dd>{SHOP.address}</dd>
            </div>
            <div>
              <Phone size={22} aria-hidden="true" />
              <dt>Hotline / Zalo</dt>
              <dd>
                <a href={'tel:' + SHOP.phone}>{SHOP.phoneLabel}</a> ({SHOP.contactName})
              </dd>
            </div>
            <div>
              <Mail size={22} aria-hidden="true" />
              <dt>Email</dt>
              <dd>
                <a href={'mailto:' + SHOP.email}>{SHOP.email}</a>
              </dd>
            </div>
            <div>
              <Clock size={22} aria-hidden="true" />
              <dt>Giờ làm việc</dt>
              <dd>{SHOP.hours}</dd>
            </div>
          </dl>
          <div className="about-contact-actions">
            <a className="btn btn-primary" href={'tel:' + SHOP.phone}>
              GỌI NGAY <Phone size={18} aria-hidden="true" />
            </a>
            <a
              className="btn btn-outline"
              href={'https://zalo.me/' + SHOP.phone}
              target="_blank"
              rel="noopener noreferrer"
            >
              NHẮN ZALO
            </a>
            <a className="btn btn-outline" href={MAP_URL} target="_blank" rel="noopener noreferrer">
              XEM BẢN ĐỒ
            </a>
          </div>
        </Reveal>
      </section>

      <aside className="service-feedback" aria-labelledby="service-feedback-title">
        <MessageCircle size={28} aria-hidden="true" />
        <div>
          <h3 id="service-feedback-title">Góp ý / than phiền dịch vụ</h3>
          <p>HAVIE lắng nghe góp ý của anh/chị để cải thiện sản phẩm và cách phục vụ. Liên hệ Zalo {STORE.feedbackPhone} ({STORE.feedbackName}).</p>
        </div>
        <a className="btn btn-primary" href={STORE.feedbackUrl} target="_blank" rel="noopener noreferrer">GỬI GÓP Ý QUA ZALO</a>
      </aside>

      <Reveal as="section" className="about-cta" aria-label="Bắt đầu mua sắm">
        <h2>Chưa biết chọn vợt nào?</h2>
        <p>Hỏi trợ lý tư vấn ở góc phải màn hình, hoặc xem ngay các mẫu vợt đang bán.</p>
        <Link to="/products?category=rackets" className="btn btn-primary">
          XEM VỢT CẦU LÔNG <ArrowRight size={18} aria-hidden="true" />
        </Link>
      </Reveal>
    </div>
  );
}
