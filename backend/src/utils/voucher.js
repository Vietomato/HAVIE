import { HttpError } from "./http.js";

export const DISCOUNT_TYPES = ["PERCENT", "FIXED"];
const CODE_PATTERN = /^[A-Z0-9_-]{3,30}$/;
const MAX_MONEY = 1_000_000_000;

export function normalizeVoucherCode(value) {
  return typeof value === "string" ? value.trim().toUpperCase() : "";
}

const money = (value) => `${value.toLocaleString("vi-VN")}đ`;

/**
 * Returns the discount (VND) a voucher gives on `subtotal`, or throws an
 * HttpError explaining why it cannot be used. The discount never exceeds the
 * subtotal; shipping is not discounted.
 */
export function calculateVoucherDiscount(voucher, subtotal, now = new Date()) {
  if (!voucher || !voucher.isActive) {
    throw new HttpError(404, "VOUCHER_NOT_FOUND", "Mã giảm giá không tồn tại hoặc đã ngừng áp dụng.");
  }
  if (voucher.startsAt && now < new Date(voucher.startsAt)) {
    throw new HttpError(409, "VOUCHER_NOT_STARTED", "Mã giảm giá chưa đến thời gian áp dụng.");
  }
  if (voucher.endsAt && now > new Date(voucher.endsAt)) {
    throw new HttpError(409, "VOUCHER_EXPIRED", "Mã giảm giá đã hết hạn.");
  }
  if (voucher.usageLimit !== null && voucher.usageLimit !== undefined && voucher.usedCount >= voucher.usageLimit) {
    throw new HttpError(409, "VOUCHER_USED_UP", "Mã giảm giá đã hết lượt sử dụng.");
  }
  if (subtotal < voucher.minOrderAmount) {
    throw new HttpError(
      409,
      "VOUCHER_MIN_ORDER",
      `Đơn hàng cần tối thiểu ${money(voucher.minOrderAmount)} tiền hàng để dùng mã này.`,
      { minOrderAmount: voucher.minOrderAmount },
    );
  }

  let discount =
    voucher.discountType === "PERCENT"
      ? Math.floor((subtotal * voucher.discountValue) / 100)
      : voucher.discountValue;
  if (voucher.maxDiscount !== null && voucher.maxDiscount !== undefined) {
    discount = Math.min(discount, voucher.maxDiscount);
  }
  return Math.max(0, Math.min(discount, subtotal));
}

function invalid(message) {
  throw new HttpError(400, "VALIDATION_ERROR", message);
}

function optionalMoney(value, label) {
  if (value === null || value === "" || value === undefined) return null;
  if (!Number.isInteger(value) || value <= 0 || value > MAX_MONEY) {
    invalid(`${label} phải là số nguyên dương.`);
  }
  return value;
}

function optionalDate(value, label) {
  if (value === null || value === "" || value === undefined) return null;
  const date = new Date(value);
  if (typeof value !== "string" || Number.isNaN(date.getTime())) {
    invalid(`${label} không hợp lệ.`);
  }
  return date;
}

/**
 * Validates an admin create/update payload. With `partial`, only the fields
 * present in `body` are returned.
 */
export function validateVoucherPayload(body, { partial = false } = {}) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    invalid("Dữ liệu mã giảm giá không hợp lệ.");
  }
  const has = (field) => !partial || Object.hasOwn(body, field);
  const data = {};

  if (has("code")) {
    const code = normalizeVoucherCode(body.code);
    if (!CODE_PATTERN.test(code)) {
      invalid("Mã gồm 3-30 ký tự: chữ, số, gạch ngang hoặc gạch dưới.");
    }
    data.code = code;
  }

  if (has("description")) {
    if (body.description !== null && body.description !== undefined && typeof body.description !== "string") {
      invalid("Mô tả không hợp lệ.");
    }
    const description = body.description?.trim() || null;
    if (description && description.length > 200) invalid("Mô tả tối đa 200 ký tự.");
    data.description = description;
  }

  if (has("discountType")) {
    if (!DISCOUNT_TYPES.includes(body.discountType)) invalid("Loại giảm giá không hợp lệ.");
    data.discountType = body.discountType;
  }

  if (has("discountValue")) {
    const value = body.discountValue;
    if (!Number.isInteger(value) || value <= 0 || value > MAX_MONEY) {
      invalid("Mức giảm phải là số nguyên dương.");
    }
    data.discountValue = value;
  }

  if (has("maxDiscount")) data.maxDiscount = optionalMoney(body.maxDiscount, "Mức giảm tối đa");

  if (has("minOrderAmount")) {
    const value = body.minOrderAmount ?? 0;
    if (!Number.isInteger(value) || value < 0 || value > MAX_MONEY) {
      invalid("Giá trị đơn tối thiểu phải là số nguyên không âm.");
    }
    data.minOrderAmount = value;
  }

  if (has("usageLimit")) data.usageLimit = optionalMoney(body.usageLimit, "Số lượt sử dụng");
  if (has("startsAt")) data.startsAt = optionalDate(body.startsAt, "Ngày bắt đầu");
  if (has("endsAt")) data.endsAt = optionalDate(body.endsAt, "Ngày kết thúc");

  if (has("isActive")) {
    const isActive = body.isActive ?? true;
    if (typeof isActive !== "boolean") invalid("Trạng thái không hợp lệ.");
    data.isActive = isActive;
  }

  return data;
}

/**
 * Checks rules that span several fields, using the merged voucher
 * (existing values overridden by the update).
 */
export function assertVoucherConsistent(voucher) {
  if (voucher.discountType === "PERCENT" && voucher.discountValue > 100) {
    invalid("Giảm theo phần trăm chỉ từ 1 đến 100%.");
  }
  if (voucher.startsAt && voucher.endsAt && voucher.startsAt >= voucher.endsAt) {
    invalid("Ngày kết thúc phải sau ngày bắt đầu.");
  }
  if (voucher.usageLimit !== null && voucher.usageLimit !== undefined && voucher.usageLimit < (voucher.usedCount ?? 0)) {
    invalid(`Số lượt sử dụng không được nhỏ hơn số lượt đã dùng (${voucher.usedCount}).`);
  }
}
