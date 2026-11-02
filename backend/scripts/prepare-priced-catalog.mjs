import fs from "node:fs/promises";

const folder = new URL(
  "../data/catalog-source/HAVIE_Catalog/",
  import.meta.url,
);

const source = JSON.parse(
  (await fs.readFile(
    new URL("approved-products.template.json", folder),
    "utf8",
  )).replace(/^\uFEFF/, ""),
);
const brandNames = {
  yonex: "Yonex",
  lining: "Li-Ning",
  mizuno: "Mizuno",
  victor: "Victor",
};

function vietnameseName(product) {
  const prefix = product.categorySlug === "shoes"
    ? "Giày cầu lông"
    : "Vợt cầu lông";

  const brand = brandNames[product.brandSlug] ?? product.brandSlug;

  const model = product.name
    .replace(/\(STRUNG\)/gi, "(Đã căng dây)")
    .replace(/\(UNSTRUNG\)/gi, "(Chưa căng dây)")
    .trim();

  return `${prefix} ${brand} ${model}`;
}
const output = [];

for (const product of source) {
  const variants = product.variants
    .filter((variant) =>
      Number.isSafeInteger(variant.price) &&
      variant.price > 0
    )
    .map((variant) => ({
      ...variant,
      stockQuantity: 0,
      isAvailable: false,
    }));

  if (variants.length === 0) continue;

    output.push({
    ...product,
    name: vietnameseName(product),
    isActive: false,
    advisorEnabled: false,
    variants,
  });
}

const destination = new URL(
  "../prisma/catalog-priced.json",
  import.meta.url,
);

await fs.writeFile(
  destination,
  JSON.stringify(output, null, 2),
  "utf8",
);

console.log(`Sản phẩm có giá: ${output.length}`);
console.log(`Sản phẩm bỏ qua: ${source.length - output.length}`);
console.log(
  `Biến thể có giá: ${
    output.reduce((total, product) => total + product.variants.length, 0)
  }`,
);
console.log("Đã tạo prisma/catalog-priced.json. Chưa ghi database.");