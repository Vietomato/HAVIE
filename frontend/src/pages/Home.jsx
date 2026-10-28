import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowLeft, Truck, ShieldCheck, RotateCcw, CreditCard } from 'lucide-react';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard.jsx';

const HOME_BANNERS = [
  { src: '/images/banner1.png', alt: 'HAVIE — ảnh quảng bá 1' },
  { src: '/images/banner2.png', alt: 'HAVIE — ảnh quảng bá 2' },
  { src: '/images/banner3.png', alt: 'HAVIE — ảnh quảng bá 3' },
];

export default function Home() {
  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);

  useEffect(() => {
    let active = true;

    catalogApi
      .getProducts({ pageSize: 4, sort: 'rating_desc' })
      .then((res) => {
        if (active) setFeatured(res.data || []);
      })
      .catch((error) => {
        if (active) setFeaturedError(error.message || 'Không thể tải sản phẩm nổi bật.');
      })
      .finally(() => {
        if (active) setFeaturedLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % HOME_BANNERS.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  const showPreviousBanner = () => {
    setActiveBanner((current) =>
      current === 0 ? HOME_BANNERS.length - 1 : current - 1,
    );
  };

  const showNextBanner = () => {
    setActiveBanner((current) => (current + 1) % HOME_BANNERS.length);
  };

  return (
    <>
      <section
        className="home-banner"
        aria-label="Ảnh quảng bá của cửa hàng"
        aria-roledescription="trình chiếu ảnh"
      >
        <img
          key={HOME_BANNERS[activeBanner].src}
          className="home-banner-image"
          src={HOME_BANNERS[activeBanner].src}
          alt={HOME_BANNERS[activeBanner].alt}
        />
        <button
          type="button"
          className="home-banner-arrow home-banner-previous"
          onClick={showPreviousBanner}
          aria-label="Xem ảnh trước"
        >
          <ArrowLeft size={20} />
        </button>
        <button
          type="button"
          className="home-banner-arrow home-banner-next"
          onClick={showNextBanner}
          aria-label="Xem ảnh tiếp theo"
        >
          <ArrowRight size={20} />
        </button>
        <div className="home-banner-dots" aria-label="Chọn ảnh quảng bá">
          {HOME_BANNERS.map((banner, index) => (
            <button
              key={banner.src}
              type="button"
              className={`home-banner-dot${index === activeBanner ? ' is-active' : ''}`}
              onClick={() => setActiveBanner(index)}
              aria-label={`Chuyển tới banner ${index + 1}`}
              aria-current={index === activeBanner ? 'true' : undefined}
            />
          ))}
        </div>
      </section>

      <section className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">DANH MỤC</span>
            <h2>
              SẢN PHẨM<span className="dot">.</span>
            </h2>
          </div>
          <Link className="text-link" to="/products">
            TẤT CẢ SẢN PHẨM <ArrowRight size={17} />
          </Link>
        </div>
        <div className="category-grid">
          {[
            { name: 'Vợt cầu lông', slug: 'rackets', n: '01', img: 1 },
            { name: 'Giày cầu lông', slug: 'shoes', n: '02', img: 2 },
            { name: 'Trang phục', slug: 'apparel', n: '03', img: 4 },
            { name: 'Phụ kiện', slug: 'accessories', n: '04', img: 6 },
          ].map((c) => (
            <Link className="category-card" key={c.slug} to={'/products?category=' + c.slug}>
              <div className="category-image">
                <img src={'/images/product-' + c.img + '.svg'} alt="" />
              </div>
              <div className="category-label">
                <span>
                  {c.n} / {c.name.toUpperCase()}
                </span>
                <ArrowRight size={20} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="section section-products">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ĐƯỢC YÊU THÍCH</span>
              <h2>
                SẢN PHẨM BÁN CHẠY<span className="dot">.</span>
              </h2>
            </div>
            <Link className="text-link" to="/products">
              XEM TẤT CẢ <ArrowRight size={17} />
            </Link>
          </div>
          <div className="products-grid">
            {featuredLoading ? (
              <p role="status">Đang tải sản phẩm...</p>
            ) : featuredError ? (
              <p role="alert">{featuredError}</p>
            ) : featured.length ? (
              featured.map((p) => <ProductCard key={p.id} product={p} />)
            ) : (
              <p>Hiện chưa có sản phẩm nổi bật.</p>
            )}
          </div>
        </div>
      </section>

      <section className="campaign container">
        <div>
          <span className="eyebrow">TRIẾT LÝ HAVIE</span>
          <h2>
            DỤNG CỤ TỐT.
            <br />
            TRẬN ĐẤU HAY.
          </h2>
          <p>
            Mỗi chuyển động đều quan trọng. Trang bị phù hợp giúp bạn tự tin thể hiện lối chơi của
            mình.
          </p>
          <Link to="/products" className="btn btn-light">
            KHÁM PHÁ NGAY <ArrowRight size={18} />
          </Link>
        </div>
        <div className="campaign-mark">
          H<span>.</span>
        </div>
      </section>

      <section className="perks container">
        <div>
          <Truck size={26} />
          <strong>Vận chuyển TOÀN QUỐC</strong>
          <span>Thanh toán khi nhận hàng</span>
        </div>
        <div>
          <ShieldCheck size={26} />
          <strong>Bảo đảm chất lượng</strong>
          <span>Sản phẩm bảo đảm chất lượng.</span>
        </div>
        <div>
          <CreditCard size={26} />
          <strong>Thanh toán thuận tiện</strong>
          <span>Chọn hình thức phù hợp</span>
        </div>
        <div>
          <RotateCcw size={26} />
          <strong>Đổi sản phẩm mới</strong>
          <span>nếu sản phẩm lỗi</span>
        </div>
      </section>
    </>
  );
}
