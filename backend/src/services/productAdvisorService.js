import prisma from "../config/prisma.js";

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