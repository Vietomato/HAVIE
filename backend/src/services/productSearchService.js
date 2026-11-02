import prisma from "../config/prisma.js";
import { validateAdvisorSpecs } from "./productAdvisorService.js";

const BUDGET_TOLERANCE_VND = 300_000;
const MAX_CANDIDATES = 5;

function isObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value)
  );
}

function readSize(attributes) {
  if (!isObject(attributes)) return null;

  const raw = String(attributes.size ?? "").trim();
  const system = String(attributes.sizeSystem ?? "")
    .trim()
    .toUpperCase();

  if (!raw) return null;

  const size = Number(raw.replace(",", "."));

  if (
    !Number.isFinite(size) ||
    size <= 0 ||
    !["EU", "US", "UK", "CM"].includes(system)
  ) {
    return null;
  }

  return { size, system };
}

function getBudgetRange(needs) {
  const target = needs.budgetTargetVnd ?? null;
  const maximum = needs.budgetMaxVnd ?? null;

  if (target === null && maximum === null) {
    throw new Error("Cần ngân sách VND trước khi tìm.");
  }

  for (const amount of [target, maximum]) {
    if (
      amount !== null &&
      (!Number.isSafeInteger(amount) || amount < 0)
    ) {
      throw new Error("Ngân sách phải là số nguyên VND không âm.");
    }
  }

  if (
    target !== null &&
    maximum !== null &&
    target > maximum
  ) {
    throw new Error("Ngân sách mục tiêu vượt mức tối đa.");
  }

  const anchor = target ?? maximum;
  const lower = Math.max(1, anchor - BUDGET_TOLERANCE_VND);

  // Có trần thì không bao giờ vượt trần.
  const upper = maximum === null
    ? anchor + BUDGET_TOLERANCE_VND
    : Math.min(
        anchor + BUDGET_TOLERANCE_VND,
        maximum,
      );

  return { anchor, lower, upper };
}

export async function searchAdvisorProducts(needs) {
  if (!["rackets", "shoes"].includes(needs.productType)) {
    throw new Error("Cần xác định vợt hoặc giày trước khi tìm.");
  }

  const budget = getBudgetRange(needs);

  const previewEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.ADVISOR_CATALOG_PREVIEW === "true";

  const productFilter = {
    isActive: true,
    category: { slug: needs.productType },
  };

  if (needs.brandPreference) {
    productFilter.brand = {
      slug: needs.brandPreference,
    };
  }

  const saleFilter = {
    isAvailable: true,
    stockQuantity: { gt: 0 },
    product: {
      advisorEnabled: true,
    },
  };

  const variants = await prisma.productVariant.findMany({
    where: {
      price: {
        gte: budget.lower,
        lte: budget.upper,
      },
      product: productFilter,
      OR: [
        saleFilter,
        ...(previewEnabled
          ? [{ sku: { startsWith: "CAT-" } }]
          : []),
      ],
    },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          slug: true,
          imageUrls: true,
          isActive: true,
          advisorEnabled: true,
          brand: {
            select: {
              name: true,
              slug: true,
            },
          },
        },
      },
    },
    orderBy: [{ price: "asc" }, { id: "asc" }],
  });

  const results = [];

  for (const variant of variants) {
    const product = variant.product;

    const attributes = isObject(variant.attributes)
      ? variant.attributes
      : {};

    const reference = attributes.marketPriceReference;

    const saleEnabled =
      product.isActive &&
      product.advisorEnabled &&
      variant.isAvailable &&
      variant.stockQuantity > 0;

    const specCheck = needs.productType === "rackets"
      ? validateAdvisorSpecs(attributes)
      : { specs: null, errors: [] };

    const reviewedForSale =
      saleEnabled &&
      needs.productType === "rackets" &&
      specCheck.errors.length === 0 &&
      specCheck.specs?.reviewStatus === "APPROVED";

    const catalogPreview =
      previewEnabled &&
      variant.sku.startsWith("CAT-") &&
      isObject(reference) &&
      reference.currency === "VND";

    if (!reviewedForSale && !catalogPreview) continue;

    let sizeStatus = "not_applicable";

    if (needs.productType === "shoes") {
      const size = readSize(attributes);

      const requestedSizeKnown =
        Number.isFinite(needs.shoeSize) &&
        needs.shoeSize > 0 &&
        ["EU", "US", "UK", "CM"].includes(
          needs.shoeSizeSystem,
        );

      if (size && requestedSizeKnown) {
        if (
          size.system !== needs.shoeSizeSystem ||
          size.size !== needs.shoeSize
        ) {
          continue;
        }

        sizeStatus = "listed_size_match";
      } else {
        sizeStatus = "needs_size_verification";
      }
    }

    results.push({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      productType: needs.productType,
      brand: product.brand.name,
      slug: product.slug,
      imageUrl: product.imageUrls[0] ?? null,
      isPublished: product.isActive,

      priceVnd: variant.price,
      racketPriceVnd: variant.price,

      budgetDifferenceVnd: variant.price - budget.anchor,
      budgetDistanceVnd: Math.abs(
        variant.price - budget.anchor,
      ),

      stockQuantity: variant.stockQuantity,
      isAvailable: variant.isAvailable,
      catalogOnly: !reviewedForSale,
      sizeStatus,

      priceSourceUrl: catalogPreview
        ? reference.sourceUrl ?? null
        : null,

      suitabilityAssessed: false,
    });
  }

  // Chọn biến thể đại diện:
  // với giày, ưu tiên size khớp trước trong cùng sản phẩm.
  const sizeRank = (item) =>
    item.sizeStatus === "needs_size_verification" ? 1 : 0;

  const comparePrice = (left, right) =>
    left.budgetDistanceVnd - right.budgetDistanceVnd ||
    left.priceVnd - right.priceVnd ||
    left.variantId.localeCompare(right.variantId);

  const representativeByProduct = new Map();

  for (const candidate of results) {
    const current = representativeByProduct.get(
      candidate.productId,
    );

    if (
      !current ||
      sizeRank(candidate) < sizeRank(current) ||
      (
        sizeRank(candidate) === sizeRank(current) &&
        comparePrice(candidate, current) < 0
      )
    ) {
      representativeByProduct.set(
        candidate.productId,
        candidate,
      );
    }
  }

  // Xếp gần ngân sách trước, rồi mới giới hạn 5 sản phẩm.
  const candidates = [...representativeByProduct.values()]
    .sort((left, right) =>
      left.budgetDistanceVnd - right.budgetDistanceVnd ||
      sizeRank(left) - sizeRank(right) ||
      left.priceVnd - right.priceVnd ||
      left.variantId.localeCompare(right.variantId)
    )
    .slice(0, MAX_CANDIDATES);

  return {
    status: candidates.length
      ? "CANDIDATES_FOUND"
      : "NO_REVIEWED_MATCH",

    initialBudgetVnd: budget.anchor,
    budgetMinVnd: budget.lower,
    budgetMaxVnd: budget.upper,
    previewEnabled,
    suitabilityAssessed: false,

    pricingNotice: needs.productType === "rackets"
      ? "Giá niêm yết riêng cây vợt; chưa cộng tiền cước và công căng."
      : "Giá niêm yết theo từng biến thể sản phẩm.",

    candidates,
  };
}

// Tương thích các script kiểm tra vợt cũ.
export async function searchAdvisorRackets(needs) {
  return searchAdvisorProducts({
    ...needs,
    productType: "rackets",
  });
}