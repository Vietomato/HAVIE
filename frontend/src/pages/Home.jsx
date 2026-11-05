import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  ArrowLeft,
  Truck,
  ShieldCheck,
  RotateCcw,
  CreditCard,
  Pause,
  Play,
} from 'lucide-react';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard.jsx';
import { ProductGridSkeleton } from '../components/Skeleton.jsx';
import usePageTitle from '../hooks/usePageTitle.js';

const HOME_BANNERS = [
  { src: '/images/banner1.png', alt: 'Vợt, giày và phụ kiện cầu lông: xem bộ sưu tập' },
  { src: '/images/banner2.png', alt: 'Trang bị cầu lông nổi bật: xem bộ sưu tập' },
  { src: '/images/banner3.png', alt: 'Sản phẩm cầu lông mới: xem bộ sưu tập' },
];

const CATEGORIES = [
  { name: 'Vợt cầu lông', slug: 'rackets', img: 1 },
  { name: 'Giày cầu lông', slug: 'shoes', img: 2 },
  { name: 'Trang phục', slug: 'apparel', img: 4 },
  { name: 'Phụ kiện', slug: 'accessories', img: 6 },
];

const PERKS = [
  { icon: Truck, title: 'Vận chuyển toàn quốc', text: 'Thanh toán khi nhận hàng' },
  { icon: ShieldCheck, title: 'Bảo đảm chất lượng', text: 'Sản phẩm được kiểm tra kỹ' },
  { icon: CreditCard, title: 'Thanh toán thuận tiện', text: 'Nhận hàng rồi mới trả tiền' },
  { icon: RotateCcw, title: 'Đổi sản phẩm mới', text: 'Nếu sản phẩm bị lỗi' },
];

const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export default function Home() {
  usePageTitle();
  const [featured, setFeatured] = useState([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredError, setFeaturedError] = useState('');
  const [activeBanner, setActiveBanner] = useState(0);
  const [paused, setPaused] = useState(prefersReducedMotion);
  const [interacting, setInteracting] = useState(false);

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
    if (paused || interacting) return undefined;

    const timer = window.setInterval(() => {
      setActiveBanner((current) => (current + 1) % HOME_BANNERS.length);
    }, 5000);

    return () => window.clearInterval(timer);
  }, [paused, interacting]);

  const showPreviousBanner = () => {
    setActiveBanner((current) => (current === 0 ? HOME_BANNERS.length - 1 : current - 1));
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
        onMouseEnter={() => setInteracting(true)}
        onMouseLeave={() => setInteracting(false)}
        onFocus={() => setInteracting(true)}
        onBlur={() => setInteracting(false)}
      >
        {HOME_BANNERS.map((banner, index) => (
          <Link
            key={banner.src}
            to="/products"
            className={'home-banner-slide' + (index === activeBanner ? ' is-active' : '')}
            aria-hidden={index !== activeBanner}
            tabIndex={index === activeBanner ? undefined : -1}
          >
            <img
              className="home-banner-image"
              src={banner.src}
              alt={banner.alt}
              width="2182"
              height="721"
              fetchPriority={index === 0 ? 'high' : undefined}
            />
          </Link>
        ))}
        <button
          type="button"
          className="home-banner-arrow home-banner-previous"
          onClick={showPreviousBanner}
          aria-label="Xem ảnh trước"
        >
          <ArrowLeft size={20} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="home-banner-arrow home-banner-next"
          onClick={showNextBanner}
          aria-label="Xem ảnh tiếp theo"
        >
          <ArrowRight size={20} aria-hidden="true" />
        </button>
        <div className="home-banner-controls">
          <button
            type="button"
            className="home-banner-toggle"
            onClick={() => setPaused(!paused)}
            aria-label={paused ? 'Tiếp tục trình chiếu' : 'Tạm dừng trình chiếu'}
          >
            {paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
          </button>
          {HOME_BANNERS.map((banner, index) => (
            <button
              key={banner.src}
              type="button"
              className={`home-banner-dot${index === activeBanner ? ' is-active' : ''}`}
              onClick={() => setActiveBanner(index)}
              aria-label={`Chuyển tới ảnh ${index + 1}`}
              aria-current={index === activeBanner ? 'true' : undefined}
            />
          ))}
        </div>
      </section>

      <section className="home-intro">
        <div className="container">
          <div>
            <span className="eyebrow">HAVIE — CỬA HÀNG CẦU LÔNG</span>
            <h1>
              Dành trọn đam mê cho cầu lông<span className="dot">.</span>
            </h1>
          </div>
          <Link to="/products" className="btn btn-primary">
            MUA SẮM NGAY <ArrowRight size={18} aria-hidden="true" />
          </Link>
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
            TẤT CẢ <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </div>
        <div className="category-grid">
          {CATEGORIES.map((c) => (
            <Link className="category-card" key={c.slug} to={'/products?category=' + c.slug}>
              <div className="category-image">
                <img src={'/images/product-' + c.img + '.svg'} alt="" loading="lazy" />
              </div>
              <div className="category-label">
                <span>{c.name}</span>
                <ArrowRight size={20} aria-hidden="true" />
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
                SẢN PHẨM NỔI BẬT<span className="dot">.</span>
              </h2>
            </div>
            <Link className="text-link" to="/products?sort=rating_desc">
              XEM TẤT CẢ <ArrowRight size={17} aria-hidden="true" />
            </Link>
          </div>
          {featuredLoading ? (
            <ProductGridSkeleton count={4} />
          ) : featuredError ? (
            <p className="inline-alert" role="alert">
              {featuredError}
            </p>
          ) : featured.length ? (
            <div className="products-grid">
              {featured.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <p className="muted-text">Hiện chưa có sản phẩm nổi bật.</p>
          )}
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
          <Link to="/products" className="btn btn-primary">
            KHÁM PHÁ NGAY <ArrowRight size={18} aria-hidden="true" />
          </Link>
        </div>
        <div className="campaign-mark" aria-hidden="true">
          H<span>.</span>
        </div>
      </section>

      <section className="perks container" aria-label="Cam kết của HAVIE">
        {PERKS.map(({ icon: Icon, title, text }) => (
          <div key={title}>
            <Icon size={26} aria-hidden="true" />
            <strong>{title}</strong>
            <span>{text}</span>
          </div>
        ))}
      </section>
    </>
  );
}
