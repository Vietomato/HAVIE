import prisma from "../config/prisma.js";

export const MANUFACTURER_SPEC_HOSTS = new Set([
  "sg.lining.studio", "ae.lining.studio", "vnm.mizuno.com", "shop.au.victorsport.com",
  "us.yonex.com", "www.yonex.com",
]);

export function validSpecSource(source) {
  try {
    const url = new URL(source?.url);
    return url.protocol === "https:" && !url.username && !url.password &&
      MANUFACTURER_SPEC_HOSTS.has(url.hostname) && /^\d{4}-\d{2}-\d{2}$/u.test(source.checkedAt);
  } catch { return false; }
}

// Imported specs are validated per field, so missing tension does not hide known flex.
// The old manually approved record remains a compatible fallback for untouched SKUs.
export function readRacketSpecs(attributes, { sku, productSlug, legacyEnabled = true } = {}) {
  const data = attributes?.manufacturerSpecs;
  if (data !== undefined) {
    if (!data || data.schemaVersion !== 1 || data.identityStatus !== "SOURCE_VARIANT_ID_MATCH" ||
        data.sku !== sku || data.productSlug !== productSlug ||
        !/^CAT-[A-Z]+-\d+$/u.test(sku ?? "") ||
        String(data.sourceVariantId) !== sku.split("-").at(-1)) return null;
    const sourced = (field) => validSpecSource(data.fieldSources?.[field]) &&
      !(data.blockedFields ?? []).includes(field);
    const specs = {
      shaftFlex: sourced("shaftFlex") && ["flexible", "medium", "stiff", "extra_stiff"].includes(data.shaftFlex) ? data.shaftFlex : null,
      balanceType: sourced("balanceType") && ["head_light", "even", "head_heavy"].includes(data.balanceType) ? data.balanceType : null,
      weightClass: sourced("weightClass") && /^(?:[2-6]|3\.5)U$/u.test(data.weightClass ?? "") ? data.weightClass : null,
      averageWeightG: null,
      stringingMinLbf: null,
      stringingMaxLbf: null,
      sourceKind: "manufacturer",
    };
    const tension = data.manufacturerTension;
    if (sourced("manufacturerTension") && tension?.unit === "lbf" &&
        (!tension.weightClass || tension.weightClass === specs.weightClass) &&
        Number.isFinite(tension.maxLbf) && tension.maxLbf > 0 && tension.maxLbf <= 50) {
      if (tension.type === "manufacturer_range" && Number.isFinite(tension.minLbf) &&
          tension.minLbf > 0 && tension.minLbf <= tension.maxLbf) {
        specs.stringingMinLbf = tension.minLbf;
        specs.stringingMaxLbf = tension.maxLbf;
      } else if (tension.type === "manufacturer_max" && tension.minLbf === null) {
        specs.stringingMaxLbf = tension.maxLbf;
      }
    }
    return [specs.shaftFlex, specs.balanceType, specs.weightClass, specs.stringingMaxLbf].some((value) => value !== null) ? specs : null;
  }
  const checked = validateAdvisorSpecs(attributes);
  if (!legacyEnabled || checked.errors.length || checked.specs?.reviewStatus !== "APPROVED") return null;
  return {
    shaftFlex: checked.specs.shaftFlex, balanceType: checked.specs.balanceType ?? null,
    averageWeightG: checked.specs.averageWeightG,
    stringingMinLbf: checked.specs.stringingAdvice.minLbf,
    stringingMaxLbf: checked.specs.stringingAdvice.maxLbf,
    sourceKind: "approved",
  };
}

 export function validateAdvisorSpecs(attributes) {
  const specs = attributes?.advisor;
  const errors = [];

  if (!specs || typeof specs !== "object" || Array.isArray(specs)) {
    return { specs: null, errors: ["Chưa có thông số advisor."] };
  }

  if (specs.schemaVersion !== 1) {
    errors.push("schemaVersion không được hỗ trợ.");
  }

  if (typeof specs.modelCode !== "string" || !specs.modelCode.trim()) {
    errors.push("Thiếu mã model.");
  }

  const flexValues = [
    "extra_stiff",
    "stiff",
    "medium",
    "flexible",
  ];

  if (!flexValues.includes(specs.shaftFlex)) {
    errors.push("Độ cứng chưa được chuẩn hóa.");
  }

  if (
    !Number.isFinite(specs.averageWeightG) ||
    specs.averageWeightG <= 0
  ) {
    errors.push("Trọng lượng trung bình không hợp lệ.");
  }

  const tension = specs.stringingAdvice;

  if (
    !tension ||
    !Number.isFinite(tension.minLbf) ||
    !Number.isFinite(tension.maxLbf) ||
    tension.minLbf <= 0 ||
    tension.maxLbf < tension.minLbf
  ) {
    errors.push("Dải khuyến nghị căng không hợp lệ.");
  }

  try {
    if (new URL(specs.sourceUrl).protocol !== "https:") {
      errors.push("Nguồn thông số phải dùng HTTPS.");
    }
  } catch {
    errors.push("URL nguồn thông số không hợp lệ.");
  }

  return { specs, errors };
}

export async function inspectAdvisorProduct(productId) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      variants: true,
      advisorNotes: {
        where: {
          reviewStatus: "APPROVED",
          reviewedAt: { not: null },
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!product) {
    throw new Error("Không tìm thấy sản phẩm.");
  }

  return {
    id: product.id,
    name: product.name,
    isActive: product.isActive,
    advisorEnabled: product.advisorEnabled,

    variants: product.variants.map((variant) => {
      const { specs, errors } = validateAdvisorSpecs(
        variant.attributes,
      );

      const blockers = [...errors];

      if (!product.isActive) {
        blockers.push("Sản phẩm đã ngừng hiển thị.");
      }

      if (!product.advisorEnabled) {
        blockers.push("Sản phẩm chưa bật tư vấn.");
      }

      if (specs?.reviewStatus !== "APPROVED") {
        blockers.push("Thông số chưa được duyệt.");
      }

      if (!variant.isAvailable || variant.stockQuantity <= 0) {
        blockers.push("Biến thể chưa bán hoặc hết hàng.");
      }

      if (!Number.isSafeInteger(variant.price) || variant.price <= 0) {
        blockers.push("Giá bán không hợp lệ.");
      }

      return {
        id: variant.id,
        name: variant.name,
        price: variant.price,
        stockQuantity: variant.stockQuantity,
        specs,
        validationErrors: errors,
        recommendationBlockers: blockers,
        readyForRecommendation: blockers.length === 0,

        approvedNotes: product.advisorNotes
          .filter((note) =>
            note.variantId === null || note.variantId === variant.id
          )
          .map((note) => ({
            id: note.id,
            content: note.content,
            conditions: note.conditions,
            variantId: note.variantId,
          })),
      };
    }),
  };
}
