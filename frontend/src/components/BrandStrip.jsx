import React from 'react';
import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { Reveal } from './motion.jsx';

// Full-colour brand logos, already trimmed. Sizes are the intrinsic pixel size of each file.
export const BRANDS = [
  { name: 'Yonex', slug: 'yonex', src: '/images/brands/yonex.png', width: 450, height: 120 },
  { name: 'Li-Ning', slug: 'lining', src: '/images/brands/lining.png', width: 155, height: 120 },
  { name: 'Victor', slug: 'victor', src: '/images/brands/victor.png', width: 480, height: 120 },
  { name: 'Mizuno', slug: 'mizuno', src: '/images/brands/mizuno.png', width: 219, height: 120 },
];

// A logo tile that links to the shop filtered by that brand.
export function BrandLogoLink({ brand }) {
  return (
    <Link
      className="brand-tile"
      to={'/products?brand=' + brand.slug}
      aria-label={'Xem sản phẩm ' + brand.name}
    >
      <img
        className={'brand-logo brand-logo-' + brand.slug}
        src={brand.src}
        alt={brand.name}
        width={brand.width}
        height={brand.height}
        loading="lazy"
      />
    </Link>
  );
}

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
            <BrandLogoLink brand={brand} />
          </li>
        ))}
      </ul>
    </Reveal>
  );
}
