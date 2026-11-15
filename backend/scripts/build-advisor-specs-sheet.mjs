// Tạo data/advisor-specs-todo.json: danh sách vợt Yonex, Li-Ning, Mizuno
// cần nhập thông số tư vấn. Phần parse được từ mô tả có sẵn thì điền sẵn
// (kèm "prefilled" để biết cần kiểm lại); phần còn lại để null cho người nhập.
//
// Chạy: node scripts/build-advisor-specs-sheet.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { parseCatalogBalance, parseCatalogFlex } from "../src/services/racketSuitability.js";

const catalog = JSON.parse(
  readFileSync(new URL("../data/shared-catalog.json", import.meta.url), "utf8"),
);

const BRANDS = ["yonex", "lining", "mizuno"];

const specOf = (product, label) => {
  const line = product.specs?.find((item) => item.startsWith(label));
  return line ? line.slice(line.indexOf(":") + 1).trim() : null;
};

const rows = [];

for (const product of catalog.products) {
  if (product.categorySlug !== "rackets" || !BRANDS.includes(product.brandSlug)) {
    continue;
  }

  const flexText = specOf(product, "Độ cứng");
  const balanceText = specOf(product, "Điểm cân bằng");
  const maxTension = specOf(product, "Mức căng tối đa");

  rows.push({
    slug: product.slug,
    name: product.name,
    brand: product.brandSlug,
    done: false,
    prefilled: {
      shaftFlex: flexText ? parseCatalogFlex(flexText) : null,
      balanceType: balanceText ? parseCatalogBalance(balanceText) : null,
      balanceRaw: balanceText,
      maxTensionRaw: maxTension,
    },
    advisor: {
      modelCode: null,
      shaftFlex: flexText ? parseCatalogFlex(flexText) : null,
      balanceType: balanceText ? parseCatalogBalance(balanceText) : null,
      averageWeightG: null,
      stringingAdvice: {
        scope: "manufacturer_advice",
        minLbf: null,
        maxLbf: maxTension ? Number.parseFloat(maxTension) || null : null,
      },
      sourceUrl: null,
      sourceCheckedOn: null,
    },
  });
}

const out = new URL("../data/advisor-specs-todo.json", import.meta.url);
writeFileSync(out, `${JSON.stringify(rows, null, 2)}\n`);

const count = (fn) => rows.filter(fn).length;
console.log(`Tổng ${rows.length} vợt.`);
console.log(`Có độ cứng: ${count((r) => r.advisor.shaftFlex)}`);
console.log(`Có điểm cân bằng: ${count((r) => r.advisor.balanceType)}`);
console.log(`Có mức căng tối đa: ${count((r) => r.advisor.stringingAdvice.maxLbf)}`);
console.log(`Đã ghi: ${out.pathname}`);
