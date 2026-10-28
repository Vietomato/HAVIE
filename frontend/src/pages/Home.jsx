import React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Truck, ShieldCheck, RotateCcw } from 'lucide-react';
import { catalogApi } from '../api';
import ProductCard from '../components/ProductCard.jsx';

export default function Home() {
  const [featured, setFeatured] = useState([]);

  useEffect(() => {
    catalogApi.getProducts({ pageSize: 4 }).then((res) => {
      setFeatured(res.data || []);
    });
  }, []);

  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-line" /> EQUIPMENT FOR THE EVERYDAY ATHLETE
            </span>
            <h1>
              EVERY POINT
              <br />
              <em>MATTERS.</em>
            </h1>
            <p>
              Find your rhythm. Own your game. Gear made for every rally, from the first serve to
              match point.
            </p>
            <Link to="/products" className="btn btn-primary">
              EXPLORE THE COLLECTION <ArrowRight size={18} />
            </Link>
            <div className="hero-index">
              01 <span /> 03 <small>DESIGNED TO PLAY</small>
            </div>
          </div>
          <div className="hero-visual">
            <div className="hero-image">
              <img src="/images/product-1.svg" alt="HAVIE performance badminton racket" />
            </div>
            <div className="hero-sticker">
              MOVE
              <br />
              WITH
              <br />
              PURPOSE <ArrowRight size={23} />
            </div>
            <div className="hero-caption">THE COURT IS YOURS — 2026 COLLECTION</div>
          </div>
        </div>
      </section>

      <section className="section container">
        <div className="section-heading">
          <div>
            <span className="eyebrow">FIND YOUR FIT</span>
            <h2>
              SHOP BY CATEGORY<span className="dot">.</span>
            </h2>
          </div>
          <Link className="text-link" to="/products">
            SHOP ALL <ArrowRight size={17} />
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
              <span className="eyebrow">THE COMMUNITY FAVORITES</span>
              <h2>
                BEST SELLERS<span className="dot">.</span>
              </h2>
            </div>
            <Link className="text-link" to="/products">
              VIEW ALL <ArrowRight size={17} />
            </Link>
          </div>
          <div className="products-grid">
            {featured.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </div>
      </section>

      <section className="campaign container">
        <div>
          <span className="eyebrow">THE HAVIE PHILOSOPHY</span>
          <h2>
            GOOD GEAR.
            <br />
            GREAT GAME.
          </h2>
          <p>
            Every movement matters. We believe the right equipment gives you the freedom to play
            your way.
          </p>
          <Link to="/products" className="btn btn-light">
            DISCOVER MORE <ArrowRight size={18} />
          </Link>
        </div>
        <div className="campaign-mark">
          H<span>.</span>
        </div>
      </section>

      <section className="perks container">
        <div>
          <Truck size={26} />
          <strong>READY FOR YOUR NEXT MATCH</strong>
          <span>Giao hàng toàn quốc & COD tiện lợi</span>
        </div>
        <div>
          <ShieldCheck size={26} />
          <strong>MADE FOR PERFORMANCE</strong>
          <span>Vợt & phụ kiện chính hãng HAVIE</span>
        </div>
        <div>
          <RotateCcw size={26} />
          <strong>SHOP WITH CONFIDENCE</strong>
          <span>Đổi trả thuận tiện & tư vấn tận tâm</span>
        </div>
      </section>
    </>
  );
}
