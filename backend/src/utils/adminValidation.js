import { HttpError } from "./http.js";

const PRODUCT_FIELDS = new Set([
  "name",
  "slug",
  "description",
  "categoryId",
  "brandId",
  "imageUrls",
  "badge",
  "specs",
  "isActive",
  "variants",
]);

function invalid(message, details = {}) {
  throw new HttpError(400, "VALIDATION_ERROR", message, details);
}

function requiredString(value, field, maxLength = 500) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maxLength
  ) {
    invalid(`${field} không hợp lệ.`);
  }
  return value.trim();
}

function optionalString(value, field, maxLength = 500) {
  if (value === null || value === undefined || value === "") return null;
  return requiredString(value, field, maxLength);
}

function stringArray(value, field, maxItems = 50) {
  if (
    !Array.isArray(value) ||
    value.length > maxItems ||
    value.some(
      (item) => typeof item !== "string" || !item.trim() || item.length > 2000,
    )
  ) {
    invalid(`${field} phải là danh sách chuỗi hợp lệ.`);
  }
  return value.map((item) => item.trim());
}

function positiveInteger(value, field, allowZero = false) {
  if (!Number.isSafeInteger(value) || (allowZero ? value < 0 : value < 1)) {
    invalid(`${field} phải là số nguyên ${allowZero ? "không âm" : "dương"}.`);
  }
  return value;
}

function validateVariant(variant, index, allowId) {
  if (!variant || typeof variant !== "object" || Array.isArray(variant)) {
    invalid(`Biến thể thứ ${index + 1} không hợp lệ.`);
  }

  const allowedFields = new Set([
    ...(allowId ? ["id"] : []),
    "sku",
    "name",
    "attributes",
    "price",
    "oldPrice",
    "stockQuantity",
    "isAvailable",
  ]);
  if (Object.keys(variant).some((field) => !allowedFields.has(field))) {
    invalid(`Biến thể thứ ${index + 1} chứa trường không được hỗ trợ.`);
  }

  const attributes = variant.attributes ?? {};
  if (
    !attributes ||
    typeof attributes !== "object" ||
    Array.isArray(attributes)
  ) {
    invalid(`Thuộc tính biến thể thứ ${index + 1} phải là một object.`);
  }

  const normalized = {
    sku: requiredString(variant.sku, `SKU biến thể ${index + 1}`, 100),
    name: requiredString(variant.name, `Tên biến thể ${index + 1}`, 200),
    attributes,
    price: positiveInteger(variant.price, `Giá biến thể ${index + 1}`),
    oldPrice:
      variant.oldPrice === null ||
      variant.oldPrice === undefined ||
      variant.oldPrice === ""
        ? null
        : positiveInteger(variant.oldPrice, `Giá cũ biến thể ${index + 1}`),
    stockQuantity: positiveInteger(
      variant.stockQuantity,
      `Tồn kho biến thể ${index + 1}`,
      true,
    ),
    isAvailable: variant.isAvailable ?? true,
  };

  if (typeof normalized.isAvailable !== "boolean") {
    invalid(`Trạng thái biến thể thứ ${index + 1} không hợp lệ.`);
  }
  if (allowId && variant.id !== undefined) {
    normalized.id = requiredString(variant.id, `ID biến thể ${index + 1}`, 100);
  }
  return normalized;
}

export function validateProductPayload(input, { partial = false } = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    invalid("Dữ liệu sản phẩm không hợp lệ.");
  }
  if (Object.keys(input).some((field) => !PRODUCT_FIELDS.has(field))) {
    invalid("Dữ liệu sản phẩm chứa trường không được hỗ trợ.");
  }

  const requiredFields = ["name", "slug", "categoryId", "brandId"];
  if (!partial && requiredFields.some((field) => input[field] === undefined)) {
    invalid("Vui lòng nhập tên, slug, danh mục và thương hiệu.");
  }

  const product = {};
  if (input.name !== undefined)
    product.name = requiredString(input.name, "Tên sản phẩm", 200);
  if (input.slug !== undefined) {
    product.slug = requiredString(input.slug, "Slug", 200);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug)) {
      invalid("Slug chỉ được chứa chữ thường không dấu, số và dấu gạch ngang.");
    }
  }
  if (input.description !== undefined) {
    product.description = optionalString(input.description, "Mô tả", 10000);
  }
  if (input.categoryId !== undefined) {
    product.categoryId = requiredString(input.categoryId, "Danh mục", 100);
  }
  if (input.brandId !== undefined) {
    product.brandId = requiredString(input.brandId, "Thương hiệu", 100);
  }
  if (input.imageUrls !== undefined)
    product.imageUrls = stringArray(input.imageUrls, "Ảnh");
  if (input.specs !== undefined)
    product.specs = stringArray(input.specs, "Thông số kỹ thuật");
  if (input.badge !== undefined)
    product.badge = optionalString(input.badge, "Nhãn", 100);
  if (input.isActive !== undefined) {
    if (typeof input.isActive !== "boolean")
      invalid("Trạng thái sản phẩm không hợp lệ.");
    product.isActive = input.isActive;
  }
  if (input.variants !== undefined) {
    if (
      !Array.isArray(input.variants) ||
      input.variants.length === 0 ||
      input.variants.length > 100
    ) {
      invalid("Sản phẩm phải có từ 1 đến 100 biến thể.");
    }
    product.variants = input.variants.map((variant, index) =>
      validateVariant(variant, index, partial),
    );
    const skus = product.variants.map(({ sku }) => sku.toLowerCase());
    if (new Set(skus).size !== skus.length)
      invalid("SKU biến thể không được trùng nhau.");
    const ids = product.variants.flatMap(({ id }) => (id ? [id] : []));
    if (new Set(ids).size !== ids.length)
      invalid("Biến thể bị lặp trong dữ liệu gửi lên.");
  } else if (!partial) {
    invalid("Sản phẩm phải có ít nhất một biến thể.");
  }

  return product;
}

export const ADMIN_ORDER_TRANSITIONS = {
  PENDING_CONFIRMATION: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["SHIPPING", "CANCELLED"],
  SHIPPING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
  REFUND_PENDING: [],
  PENDING_PAYMENT: [],
};

export function validateAdminOrderTransition(currentStatus, nextStatus) {
  if (!Object.hasOwn(ADMIN_ORDER_TRANSITIONS, nextStatus)) {
    invalid("Trạng thái đơn hàng không hợp lệ.");
  }
  if (!ADMIN_ORDER_TRANSITIONS[currentStatus]?.includes(nextStatus)) {
    throw new HttpError(
      409,
      "INVALID_ORDER_TRANSITION",
      "Không thể chuyển đơn hàng từ trạng thái hiện tại sang trạng thái này.",
      { currentStatus, nextStatus },
    );
  }
}
