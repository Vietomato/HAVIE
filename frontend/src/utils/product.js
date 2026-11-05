export const PRODUCT_BADGE_LABELS = {
  'BEST SELLER': 'BÁN CHẠY',
  HOT: 'ĐANG HOT',
  POPULAR: 'ƯA CHUỘNG',
  NEW: 'MỚI',
};

export const FALLBACK_PRODUCT_IMAGE = '/images/product-1.svg';

export const slugify = (value = '') =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const localizeVariantName = (name = '') => name.replace(/^Size\b/, 'Cỡ');

export const getProductPath = (product) => '/products/' + (product?.slug || product?.id);

// The cart API nests the product under its variant.
export const getCartProduct = (item) => item.variant?.product || item.product || {};

export const isVariantInStock = (variant) =>
  Boolean(variant) && variant.isAvailable !== false && variant.stockQuantity > 0;

export const getDefaultVariant = (product) =>
  product?.variants?.find(isVariantInStock) || product?.variants?.[0] || null;

export const getDiscountPercent = (price, oldPrice) =>
  oldPrice > price ? Math.round(((oldPrice - price) / oldPrice) * 100) : 0;

export const showFallbackImage = (event) => {
  if (!event.currentTarget.src.endsWith(FALLBACK_PRODUCT_IMAGE)) {
    event.currentTarget.src = FALLBACK_PRODUCT_IMAGE;
  }
};
