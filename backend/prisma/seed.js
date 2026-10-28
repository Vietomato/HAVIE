import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const prisma = new PrismaClient();

async function main() {
  console.log('--- Bắt đầu Seed dữ liệu ---');

  // 1. Tạo sẵn 4 Danh mục chuẩn
  const categories = [
    { name: 'Vợt cầu lông', slug: 'rackets' },
    { name: 'Giày cầu lông', slug: 'shoes' },
    { name: 'Trang phục', slug: 'apparel' },
    { name: 'Phụ kiện', slug: 'accessories' },
  ];

  const categoryMap = {};
  for (const cat of categories) {
    const c = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name },
      create: cat,
    });
    categoryMap[cat.slug] = c.id;
  }

  // 2. Tạo sẵn các Thương hiệu
  const brands = [
    { name: 'Yonex', slug: 'yonex' },
    { name: 'Li-Ning', slug: 'lining' },
    { name: 'Victor', slug: 'victor' },
    { name: 'HAVIE', slug: 'havie' },
  ];

  const brandMap = {};
  for (const b of brands) {
    const br = await prisma.brand.upsert({
      where: { slug: b.slug },
      update: { name: b.name },
      create: b,
    });
    brandMap[b.slug] = br.id;
  }

  // 3. Đọc danh sách từ file productsData.json
  const rawData = fs.readFileSync(path.join(__dirname, 'productsData.json'), 'utf-8');
  const products = JSON.parse(rawData);
  if (!Array.isArray(products)) {
    throw new TypeError('productsData.json phải chứa một danh sách sản phẩm.');
  }

  console.log(`Đang nạp ${products.length} sản phẩm...`);

  // 4. Lặp qua từng sản phẩm để nạp vào DB
  for (const item of products) {
    if (!Array.isArray(item.variants) || item.variants.length === 0) {
      throw new TypeError(`Sản phẩm "${item.name}" phải có ít nhất một biến thể.`);
    }

    const categoryId = categoryMap[item.categorySlug];
    const brandId = brandMap[item.brandSlug];

    if (!categoryId || !brandId) {
      console.warn(`Bỏ qua sản phẩm "${item.name}" vì không tìm thấy danh mục hoặc hãng.`);
      continue;
    }

    const existing = await prisma.product.findUnique({
      where: { slug: item.slug },
      include: { variants: true },
    });

    if (existing) {
      await prisma.product.update({
        where: { id: existing.id },
        data: {
          name: item.name,
          slug: item.slug,
          description: item.description,
          categoryId,
          brandId,
          imageUrls: item.imageUrls || [],
          specs: item.specs || [],
          badge: item.badge || null,
        },
      });

      for (const v of item.variants) {
        await prisma.productVariant.upsert({
          where: { sku: v.sku },
          update: {
            productId: existing.id,
            name: v.name,
            attributes: v.attributes || {},
            price: v.price,
            oldPrice: v.oldPrice ?? null,
            stockQuantity: v.stockQuantity ?? 0,
            isAvailable: true,
          },
          create: {
            productId: existing.id,
            sku: v.sku,
            name: v.name,
            attributes: v.attributes || {},
            price: v.price,
            oldPrice: v.oldPrice ?? null,
            stockQuantity: v.stockQuantity ?? 0,
            isAvailable: true,
          },
        });
      }
    } else {
      await prisma.product.create({
        data: {
          name: item.name,
          slug: item.slug,
          description: item.description,
          categoryId,
          brandId,
          imageUrls: item.imageUrls || [],
          specs: item.specs || [],
          badge: item.badge || null,
          ratingAverage: 5.0,
          reviewCount: 0,
          variants: {
            create: item.variants.map((v) => ({
              sku: v.sku,
              name: v.name,
              attributes: v.attributes || {},
              price: v.price,
              oldPrice: v.oldPrice ?? null,
              stockQuantity: v.stockQuantity ?? 0,
              isAvailable: true,
            })),
          },
        },
      });
    }
  }

  console.log('✅ Hoàn tất Seed dữ liệu thành công!');
}

main()
  .catch((e) => {
    console.error('Lỗi seed dữ liệu:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });