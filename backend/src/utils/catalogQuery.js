import { HttpError } from './http.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const SORT_OPTIONS = new Set([
  'featured',
  'price_asc',
  'price_desc',
  'rating_desc',
  'newest',
]);

function parsePositiveInteger(value, fallback, field, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Tham số ${field} không hợp lệ.`, {
      [field]: `Giá trị phải là số nguyên từ 1 đến ${max}.`,
    });
  }

  return parsed;
}

function parsePrice(value, field) {
  if (value === undefined || value === '') return undefined;

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', `Tham số ${field} không hợp lệ.`, {
      [field]: 'Giá phải là số nguyên không âm.',
    });
  }

  return parsed;
}

export function parseCatalogQuery(query) {
  const page = parsePositiveInteger(query.page, 1, 'page');
  const pageSize = parsePositiveInteger(query.pageSize, DEFAULT_PAGE_SIZE, 'pageSize', MAX_PAGE_SIZE);
  const minPrice = parsePrice(query.minPrice, 'minPrice');
  const maxPrice = parsePrice(query.maxPrice, 'maxPrice');
  const sort = query.sort || 'featured';

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Khoảng giá không hợp lệ.', {
      minPrice: 'minPrice không được lớn hơn maxPrice.',
    });
  }
  if (!SORT_OPTIONS.has(sort)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Tham số sort không hợp lệ.', {
      sort: [...SORT_OPTIONS],
    });
  }
  if (typeof query.q === 'string' && query.q.trim().length > 100) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Từ khóa tìm kiếm không được vượt quá 100 ký tự.');
  }
  if (query.inStock !== undefined && !['true', 'false'].includes(query.inStock)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Tham số inStock chỉ nhận true hoặc false.');
  }

  const attributes = Object.entries(query)
    .filter(([key, value]) => key.startsWith('attribute.') && typeof value === 'string' && value.trim())
    .map(([key, value]) => ({ key: key.slice('attribute.'.length), value: value.trim() }));

  if (attributes.some(({ key }) => !key || key.length > 50)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Tên thuộc tính lọc không hợp lệ.');
  }

  return {
    page,
    pageSize,
    minPrice,
    maxPrice,
    sort,
    q: typeof query.q === 'string' ? query.q.trim() : '',
    category: typeof query.category === 'string' ? query.category.trim() : '',
    brand: typeof query.brand === 'string' ? query.brand.trim() : '',
    inStock: query.inStock === 'true',
    attributes,
  };
}
