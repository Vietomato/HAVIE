import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { Reveal } from './motion.jsx';

// Logos are white-on-transparent PNGs; CSS turns them into the site's ink colour.
const BRANDS = [
  { name: 'Yonex', slug: 'yonex', src: '/images/brands/yonex.png', width: 243, height: 42 },
  { name: 'Li-Ning', slug: 'lining', src: '/images/brands/lining.png', width: 159, height: 71 },
  { name: 'Victor', slug: 'victor', src: '/images/brands/victor.png', width: 244, height: 36 },
  { name: 'Mizuno', slug: 'mizuno', src: '/images/brands/mizuno.png', width: 169, height: 76 },
];

export default function BrandStrip() {
  return (
    <Reveal as="section" className="brand-strip container" aria-labelledby="brand-strip-title">
      <h2 id="brand-strip-title" className="eyebrow">
        THƯƠNG HIỆU TẠI HAVIE
      </h2>
      <ul className="brand-strip-list">
        <li className="brand-strip-own">
          <Logo />
        </li>
        {BRANDS.map((brand) => (
          <li key={brand.slug}>
            <Link to={'/products?brand=' + brand.slug} aria-label={'Xem sản phẩm ' + brand.name}>
              <img
                className={'brand-logo brand-logo-' + brand.slug}
                src={brand.src}
                alt={brand.name}
                width={brand.width}
                height={brand.height}
                loading="lazy"
              />
            </Link>
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
