import { Router } from 'express';
import prisma from '../config/prisma.js';
import { asyncHandler, HttpError } from '../utils/http.js';
import { parseCatalogQuery } from '../utils/catalogQuery.js';

const router = Router();
const categorySelect = { id: true, name: true, slug: true };
const brandSelect = { id: true, name: true, slug: true };
const variantSelect = {
  id: true,
  sku: true,
  name: true,
  attributes: true,
  price: true,
  oldPrice: true,
  stockQuantity: true,
  isAvailable: true,
};

const productInclude = {
  category: { select: categorySelect },
  brand: { select: brandSelect },
  variants: {
    where: { isAvailable: true },
    select: variantSelect,
    orderBy: { createdAt: 'asc' },
  },
};

router.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const categories = await prisma.category.findMany({
      select: categorySelect,
      orderBy: { name: 'asc' },
    });
    res.json({ data: categories, message: 'Lấy danh mục thành công.' });
  }),
);

router.get(
  '/brands',
  asyncHandler(async (req, res) => {
    const brands = await prisma.brand.findMany({
      select: brandSelect,
      orderBy: { name: 'asc' },
    });
    res.json({ data: brands, message: 'Lấy thương hiệu thành công.' });
  }),
);

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const filters = parseCatalogQuery(req.query);
    const where = {};

    if (filters.q) {
      where.OR = [
        { name: { contains: filters.q, mode: 'insensitive' } },
        { description: { contains: filters.q, mode: 'insensitive' } },
        { category: { name: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }
    if (filters.category) {
      where.category = {
        ...(where.category || {}),
        OR: [
          { slug: filters.category },
          { id: filters.category },
          { name: filters.category },
        ],
      };
    }
    if (filters.brand) {
      where.brand = {
        OR: [{ slug: filters.brand }, { id: filters.brand }],
      };
    }

    const variantConditions = [];
    if (filters.minPrice !== undefined) variantConditions.push({ price: { gte: filters.minPrice } });
    if (filters.maxPrice !== undefined) variantConditions.push({ price: { lte: filters.maxPrice } });
    if (filters.inStock) {
      variantConditions.push({ isAvailable: true, stockQuantity: { gt: 0 } });
    }
    for (const { key, value } of filters.attributes) {
      variantConditions.push({ attributes: { path: [key], equals: value } });
    }
    if (variantConditions.length) {
      where.variants = { some: { AND: variantConditions } };
    }

    const total = await prisma.product.count({ where });
    const skip = (filters.page - 1) * filters.pageSize;
    let products;

    if (filters.sort === 'price_asc' || filters.sort === 'price_desc') {
      const allProducts = await prisma.product.findMany({
        where,
        include: productInclude,
      });
      allProducts.sort((left, right) => {
        const leftPrices = left.variants.map(({ price }) => price);
        const rightPrices = right.variants.map(({ price }) => price);
        const leftPrice =
          leftPrices.length === 0
            ? 0
            : filters.sort === 'price_asc'
              ? Math.min(...leftPrices)
              : Math.max(...leftPrices);
        const rightPrice =
          rightPrices.length === 0
            ? 0
            : filters.sort === 'price_asc'
              ? Math.min(...rightPrices)
              : Math.max(...rightPrices);
        return filters.sort === 'price_asc' ? leftPrice - rightPrice : rightPrice - leftPrice;
      });
      products = allProducts.slice(skip, skip + filters.pageSize);
    } else {
      const orderBy =
        filters.sort === 'rating_desc'
          ? [{ ratingAverage: 'desc' }, { createdAt: 'desc' }]
          : [{ createdAt: 'desc' }];
      products = await prisma.product.findMany({
        where,
        include: productInclude,
        orderBy,
        skip,
        take: filters.pageSize,
      });
    }

    res.json({
      data: products,
      meta: {
        page: filters.page,
        pageSize: filters.pageSize,
        total,
        totalPages: Math.ceil(total / filters.pageSize) || 1,
      },
    });
  }),
);

router.get(
  '/products/:slug/reviews',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
      select: { id: true },
    });
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');

    const page = Number(req.query.page ?? 1);
    const pageSize = Number(req.query.pageSize ?? 20);
    if (
      !Number.isSafeInteger(page) ||
      page < 1 ||
      !Number.isSafeInteger(pageSize) ||
      pageSize < 1 ||
      pageSize > 100
    ) {
      throw new HttpError(400, 'VALIDATION_ERROR', 'Tham số phân trang không hợp lệ.');
    }

    const where = { productId: product.id, isVisible: true };
    const [total, reviews] = await Promise.all([
      prisma.review.count({ where }),
      prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          comment: true,
          createdAt: true,
          user: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    res.json({
      data: reviews.map(({ user, ...review }) => ({ ...review, userName: user.fullName })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) || 1 },
    });
  }),
);

router.get(
  '/products/:slug',
  asyncHandler(async (req, res) => {
    const product = await prisma.product.findFirst({
      where: { OR: [{ slug: req.params.slug }, { id: req.params.slug }] },
      include: productInclude,
    });
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Không tìm thấy sản phẩm.');

    res.json({ data: product, message: 'Lấy chi tiết sản phẩm thành công.' });
  }),
);

export default router;
