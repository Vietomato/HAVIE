export const PRODUCT_BADGE_LABELS = {
  'BEST SELLER': 'BÁN CHẠY',
  HOT: 'ĐANG ĐƯỢC QUAN TÂM',
  POPULAR: 'ĐƯỢC ƯA CHUỘNG',
  NEW: 'MỚI',
};

export const slugify = (value = '') =>
  value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const localizeVariantName = (name = '') => name.replace(/^Size\b/, 'Cỡ');
