import React from 'react';

export function ProductGridSkeleton({ count = 4, className = '' }) {
  return (
    <div className={('products-grid ' + className).trim()} role="status">
      <span className="sr-only">Đang tải sản phẩm...</span>
      {Array.from({ length: count }, (_, index) => (
        <div className="product-card" key={index} aria-hidden="true">
          <div className="product-media skeleton" />
          <div className="skeleton-lines">
            <span className="skeleton w-1/3" />
            <span className="skeleton w-5/6" />
            <span className="skeleton w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function BlockSkeleton({ label, rows = 3 }) {
  return (
    <div className="skeleton-block" role="status">
      <span className="sr-only">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <span className="skeleton" key={index} aria-hidden="true" />
      ))}
    </div>
  );
}
