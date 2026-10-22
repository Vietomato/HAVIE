import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCatalogQuery } from '../src/utils/catalogQuery.js';

test('catalog query applies contract defaults and parses filters', () => {
  assert.deepEqual(
    parseCatalogQuery({
      q: '  attack ',
      category: 'rackets',
      minPrice: '500000',
      maxPrice: '2000000',
      inStock: 'true',
      'attribute.weight': '4U',
    }),
    {
      page: 1,
      pageSize: 20,
      minPrice: 500000,
      maxPrice: 2000000,
      sort: 'featured',
      q: 'attack',
      category: 'rackets',
      brand: '',
      inStock: true,
      attributes: [{ key: 'weight', value: '4U' }],
    },
  );
});

test('catalog query validates pagination, price ranges, and sort values', () => {
  assert.throws(
    () => parseCatalogQuery({ page: '0' }),
    (error) => error.status === 400 && error.code === 'VALIDATION_ERROR',
  );
  assert.throws(
    () => parseCatalogQuery({ pageSize: '101' }),
    (error) => error.status === 400,
  );
  assert.throws(
    () => parseCatalogQuery({ minPrice: '900', maxPrice: '100' }),
    (error) => error.status === 400,
  );
  assert.throws(
    () => parseCatalogQuery({ sort: 'invalid' }),
    (error) => error.details.sort.includes('price_asc'),
  );
});
