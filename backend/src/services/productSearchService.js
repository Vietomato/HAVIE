import prisma from "../config/prisma.js";
import { readRacketSpecs } from "./productAdvisorService.js";
import { findStringModels, loadKnowledge } from "./knowledgeBase.js";
import {
  assessRacket,
  NEUTRAL_FIT,
  parseCatalogSpecs,
  readWeightClass,
  preferenceRank,
} from "./racketSuitability.js";

const BUDGET_TOLERANCE_VND = 300_000;
const MAX_CANDIDATES = 5;
const MAX_ALTERNATIVES = 3;
// Ít hơn số này vợt hợp thì bổ sung thêm vợt "cần lưu ý" (không bao giờ bổ sung vợt bị loại).
const MIN_SUITABLE = 3;
// Gợi ý thay thế không vượt quá 30% ngân sách mục tiêu.
const ALTERNATIVE_OVER_BUDGET_RATIO = 1.3;

const foldCatalogText = (text) => String(text).normalize("NFD").replace(/\p{M}/gu, "")
  .replace(/đ/gu, "d").toLowerCase();

export function isNamedCatalogQuestion(message) {
  const text = foldCatalogText(message);
  const modelText = text.replace(/\bsize\s*\d+(?:[.,]\d+)?(?:\s*(?:eu|us|uk|cm))?\b/gu, "")
    .replace(/\b[2-6]\s*u\b/gu, "");
  return /\bgia\b|bao nhieu tien|thong so|so sanh|tim hieu|muon biet|gioi thieu|cung|deo|can bang|nang dau|nhe dau|trong luong|khoi luong|co hop|hop khong/u.test(text) &&
    /[a-z]+[\s-]*\d|\d+[\s-]*[a-z]/u.test(modelText) &&
    // Câu nói về ngân sách ("tầm giá 4tr", "khoảng 3 triệu", "500k") không phải hỏi một model cụ thể.
    !/ngan sach|trieu|toi da|duoi|khong qua|tam gia|khoang gia|tam\s+\d|\d+\s*(?:kg|ky|lbs|mm)\b|(?<![a-z-])\d+\s*(?:tr|k|nghin|ngan|vnd)\b/u.test(text);
}

// Named-model lookup extends the existing catalog service; no LLM-supplied specs.
export async function findCatalogProductsByModel(message, { database = prisma } = {}) {
  const query = foldCatalogText(message);
  const compactQuery = query.replace(/[^a-z0-9]/gu, "");
  const products = await database.product.findMany({
    where: { isActive: true, category: { slug: { in: ["rackets", "shoes"] } } },
    include: { category: true, brand: true, variants: {
      where: { isAvailable: true }, select: { id: true, sku: true, name: true, price: true, attributes: true },
    } },
    orderBy: { name: "asc" },
  });
  const common = new Set(["vot", "cau", "long", "giay", "yonex", "li", "ning", "lining", "victor", "mizuno", "nam", "nu", "mens", "womens"]);
  const requestedEditions = ["tour", "pro", "game", "play"].filter((word) => new RegExp(`\\b${word}\\b`, "u").test(query));
  return products.filter((product) => {
    if (!product.isActive || !["rackets", "shoes"].includes(product.category.slug)) return false;
    const words = foldCatalogText(product.name).split(/[^a-z0-9]+/u).filter((word) => word && !common.has(word));
    const modelNumbers = words.filter((word) => /\d/u.test(word) && !/^[2-6]u$/u.test(word));
    const familyMatch = words.some((word) => !/\d/u.test(word) && word.length >= 4 && compactQuery.includes(word));
    const modelMatch = modelNumbers.some((word) => {
      const number = word.match(/\d+/u)[0];
      const requestedCode = query.match(new RegExp(`(?<!\\d)${number}[a-z]+\\d*`, "u"))?.[0];
      if (requestedCode && !foldCatalogText(product.name).replace(/[^a-z0-9]/gu, "").includes(requestedCode)) return false;
      return (/[a-z]/u.test(word) && compactQuery.includes(word)) ||
        (familyMatch && new RegExp(`(?<!\\d)${number}(?!\\d)`, "u").test(query));
    });
    const brand = ["yonex", "victor", "mizuno"].find((name) => query.includes(name));
    return modelMatch && (!brand || product.brand.slug === brand) &&
      (!requestedEditions.length || requestedEditions.some((edition) => words.includes(edition)));
  }).slice(0, 4).map((product) => ({
    productId: product.id, name: product.name, slug: product.slug, productType: product.category.slug,
    variants: product.variants.filter((v) => Number.isSafeInteger(v.price) && v.price > 0).map((variant) => {
      const specs = readRacketSpecs(variant.attributes, { sku: variant.sku, productSlug: product.slug });
      return { variantId: variant.id, name: variant.name, priceVnd: variant.price,
        advisorSpecs: specs };
    }),
  }));
}

// Technical knowledge identifies the model; only the live catalog supplies commerce data.
export async function searchYonexStrings(modelNames, { database = prisma } = {}) {
  const known = new Set(loadKnowledge().stringing.models.map((model) => model.name));
  const wanted = [...new Set(modelNames)].filter((name) => known.has(name));
  if (!wanted.length) return [];

  const variants = await database.productVariant.findMany({
    where: {
      product: {
        isActive: true,
        brand: { slug: "yonex" },
        category: { slug: { in: ["accessories", "strings"] } },
      },
    },
    include: { product: { include: { brand: true, category: true } } },
    orderBy: [{ price: "asc" }, { id: "asc" }],
  });

  return variants.flatMap((variant) => {
    const product = variant.product;
    if (!product.isActive || product.brand.slug !== "yonex" ||
        !["accessories", "strings"].includes(product.category.slug)) return [];
    const models = findStringModels(variant.attributes?.stringModel ?? product.name);
    // Reject ambiguous bundles instead of attributing their price to a single string.
    if (models.length !== 1 || !wanted.includes(models[0])) return [];
    return [{
      model: models[0], productId: product.id, variantId: variant.id,
      name: product.name, variantName: variant.name,
      priceVnd: Number.isSafeInteger(variant.price) && variant.price > 0 ? variant.price : null,
      stockQuantity: Number.isSafeInteger(variant.stockQuantity) && variant.stockQuantity >= 0
        ? variant.stockQuantity : null,
      isAvailable: variant.isAvailable === true,
    }];
  });
}

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

export function getBudgetRange(needs, { anyPrice = false } = {}) {
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

  if (anyPrice) {
    return {
      anchor,
      lower: 1,
      upper: maximum ?? Math.ceil(anchor * ALTERNATIVE_OVER_BUDGET_RATIO),
    };
  }

  // Chỉ có trần: mọi mức giá không vượt trần đều phù hợp.
  if (target === null) {
    return { anchor, lower: 1, upper: maximum };
  }

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

export async function searchAdvisorProducts(
  needs,
  {
    database = prisma,
    ignoreBrand = false,
    anyPrice = false,
    // Mọi sản phẩm đang bán trên cửa hàng (cùng điều kiện với trang bán hàng, giỏ hàng
    // và đặt hàng) được tìm kể cả khi chưa duyệt thông số tư vấn. Đặt
    // ADVISOR_ONLY_REVIEWED=true để chỉ lấy hàng đã duyệt.
    allowUnreviewedStock = process.env.ADVISOR_ONLY_REVIEWED !== "true",
  } = {},
) {
  if (!["rackets", "shoes"].includes(needs.productType)) {
    throw new Error("Cần xác định vợt hoặc giày trước khi tìm.");
  }

  const budget = getBudgetRange(needs, { anyPrice });

  const previewEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.ADVISOR_CATALOG_PREVIEW === "true";

  const productFilter = {
    isActive: true,
    category: { slug: needs.productType },
  };

  if (needs.brandPreference && !ignoreBrand) {
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

  // Đang bán: biến thể còn bán và còn tồn kho (sản phẩm đang hiển thị đã nằm trong
  // productFilter). Đây cũng là điều kiện của trang bán hàng, giỏ hàng và đặt hàng.
  const onSaleFilter = {
    isAvailable: true,
    stockQuantity: { gt: 0 },
  };

  const variants = await database.productVariant.findMany({
    where: {
      price: {
        gte: budget.lower,
        lte: budget.upper,
      },
      product: productFilter,
      OR: [
        saleFilter,
        { ...onSaleFilter, attributes: { path: ["manufacturerSpecs", "identityStatus"], equals: "SOURCE_VARIANT_ID_MATCH" } },
        ...(allowUnreviewedStock ? [onSaleFilter] : []),
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
          specs: true,
          description: true,
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

    const manufacturerSpecs = needs.productType === "rackets"
      ? readRacketSpecs(attributes, { sku: variant.sku, productSlug: product.slug, legacyEnabled: product.advisorEnabled })
      : null;

    const reviewedForSale =
      product.isActive && variant.isAvailable && variant.stockQuantity > 0 && manufacturerSpecs !== null;

    const catalogPreview =
      previewEnabled &&
      variant.sku.startsWith("CAT-") &&
      isObject(reference) &&
      reference.currency === "VND";

    const onSale =
      product.isActive &&
      variant.isAvailable &&
      variant.stockQuantity > 0;

    // Đang bán nhưng chưa duyệt thông số: được báo giá và tình trạng hàng, không được
    // nhận xét độ hợp hay tư vấn cước.
    const unreviewedStock = allowUnreviewedStock && onSale && !reviewedForSale;

    if (!reviewedForSale && !catalogPreview && !unreviewedStock) continue;

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

    // Độ hợp theo kho kiến thức, chỉ với vợt và chỉ từ thông tin cây vợt thật sự có.
    let fit = NEUTRAL_FIT;
    let traits = null;

    if (needs.productType === "rackets") {
      // An imported blocked/missing field must not be resurrected from old shop text.
      const catalogSpecs = attributes.manufacturerSpecs === undefined ? parseCatalogSpecs(product.specs) : {};
      const verified = reviewedForSale ? manufacturerSpecs : null;

      traits = {
        weightClass: verified?.weightClass ?? readWeightClass({
          attributes,
          variantName: variant.name,
          productName: product.name,
        }),
        shaftFlex: verified?.shaftFlex ?? catalogSpecs.shaftFlex,
        balanceType: verified?.balanceType ?? catalogSpecs.balanceType,
        specSource: verified
          ? verified.sourceKind
          : catalogSpecs.shaftFlex || catalogSpecs.balanceType
            ? "catalog_text"
            : null,
      };

      fit = assessRacket(traits, needs);
    }

    results.push({
      productId: product.id,
      variantId: variant.id,
      name: product.name,
      variantName: variant.name,
      productType: needs.productType,
      brand: product.brand.name,
      slug: product.slug,
      description: product.description ?? null,
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
      weightClass: traits?.weightClass ?? null,
      racketTraits: traits,
      fit,
      catalogOnly: !reviewedForSale && !unreviewedStock,
      specsVerified: reviewedForSale,
      sizeStatus,

      advisorSpecs: reviewedForSale ? manufacturerSpecs : null,

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

    // Cùng một sản phẩm: biến thể hợp hơn (vd. 4U thay vì 3U cho người mới) được chọn trước.
    const better =
      !current ||
      sizeRank(candidate) < sizeRank(current) ||
      (sizeRank(candidate) === sizeRank(current) && preferenceRank(candidate, needs) < preferenceRank(current, needs)) ||
      (sizeRank(candidate) === sizeRank(current) && preferenceRank(candidate, needs) === preferenceRank(current, needs) &&
        (candidate.fit.tier > current.fit.tier ||
          (candidate.fit.tier === current.fit.tier &&
            candidate.fit.score > current.fit.score) ||
          (candidate.fit.tier === current.fit.tier &&
            candidate.fit.score === current.fit.score &&
            comparePrice(candidate, current) < 0)));

    if (better) {
      representativeByProduct.set(
        candidate.productId,
        candidate,
      );
    }
  }

  // Độ hợp theo kho kiến thức: loại vợt không hợp (vd. thân rất cứng với người mới),
  // giữ vợt hợp hoặc chưa đủ dữ liệu để kết luận. Ít vợt hợp quá thì bổ sung vợt
  // "cần lưu ý" nhưng không bao giờ bổ sung vợt đã bị loại.
  const all = [...representativeByProduct.values()];
  let usable = all.filter((item) => !item.fit.excluded && !(
    needs.balancePreference === "head_light" && item.racketTraits?.balanceType === "head_heavy" ||
    needs.balancePreference === "head_heavy" && item.racketTraits?.balanceType === "head_light"
  ));
  if (needs.balancePreference && usable.some((item) => item.racketTraits?.balanceType === needs.balancePreference)) {
    usable = usable.filter((item) => item.racketTraits?.balanceType === needs.balancePreference);
  }
  const suitable = usable.filter((item) => item.fit.tier >= 1);
  const cautions = usable.filter((item) => item.fit.tier < 1);

  const kept = suitable.length >= MIN_SUITABLE
    ? suitable
    : [...suitable, ...cautions];

  // Hợp nhất trước, rồi gần ngân sách, rồi mới giới hạn số sản phẩm.
  const candidates = kept
    .sort((left, right) =>
      preferenceRank(left, needs) - preferenceRank(right, needs) ||
      right.fit.tier - left.fit.tier ||
      right.fit.score - left.fit.score ||
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
    includesUnreviewedStock: allowUnreviewedStock,
    // Số sản phẩm trong tầm giá bị loại vì không hợp với khách theo kho kiến thức.
    excludedForFit: all.length - usable.length,
    suitabilityAssessed: false,

    pricingNotice: needs.productType === "rackets"
      ? null
      : "Giá niêm yết theo từng biến thể sản phẩm.",

    candidates,
  };
}

// Không có mẫu đúng điều kiện: nới lần lượt hãng rồi giá, không vượt trần.
export async function findAdvisorAlternatives(
  needs,
  { database = prisma } = {},
) {
  const attempts = needs.brandPreference
    ? [
        { reason: "brand", ignoreBrand: true },
        { reason: "price", anyPrice: true },
        { reason: "brand_and_price", ignoreBrand: true, anyPrice: true },
      ]
    : [{ reason: "price", anyPrice: true }];

  for (const { reason, ...options } of attempts) {
    const { candidates } = await searchAdvisorProducts(needs, {
      ...options,
      database,
    });

    if (candidates.length) {
      return {
        reason,
        candidates: candidates.slice(0, MAX_ALTERNATIVES),
      };
    }
  }

  return null;
}

// Tương thích các script kiểm tra vợt cũ.
export async function searchAdvisorRackets(needs) {
  return searchAdvisorProducts({
    ...needs,
    productType: "rackets",
  });
}
