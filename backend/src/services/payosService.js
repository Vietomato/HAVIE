import { PayOS } from "@payos/node";
import { releaseVoucher } from "./voucherService.js";

// Thanh toán chuyển khoản QR qua payOS.
// Luồng: đặt đơn (PENDING_PAYMENT) -> tạo link thanh toán -> khách quét QR -> payOS báo về (webhook)
// hoặc backend hỏi lại payOS khi khách mở trang thanh toán -> đơn sang PENDING_CONFIRMATION + PAID.
// Quá hạn mà chưa trả tiền thì hủy đơn và trả hàng về kho.

export const PAYMENT_WINDOW_MINUTES = 15;
export const PAYMENT_METHOD_PAYOS = "PAYOS";

// ---------- Cấu hình ----------

export function createPayosClient(environment = process.env) {
  const clientId = environment.PAYOS_CLIENT_ID?.trim();
  const apiKey = environment.PAYOS_API_KEY?.trim();
  const checksumKey = environment.PAYOS_CHECKSUM_KEY?.trim();
  if (!clientId || !apiKey || !checksumKey) return null;
  return new PayOS({ clientId, apiKey, checksumKey });
}

let sharedClient;
export function getPayosClient() {
  if (sharedClient === undefined) sharedClient = createPayosClient();
  return sharedClient;
}

export function getFrontendBaseUrl(environment = process.env) {
  const configured =
    environment.FRONTEND_URL?.trim() || environment.CORS_ORIGIN?.split(",")[0]?.trim();
  return (configured || "http://localhost:5174").replace(/\/+$/, "");
}

// ---------- Mã đơn: payOS cần số nguyên, mã đơn của shop là chữ ----------
// "HV-YYYYMMDD-XXXXXXXX" <-> số = (số ngày từ 1970) * 10^10 + (8 ký tự hex đọc thành số).
// Kết quả luôn nhỏ hơn 2^53 và đổi ngược lại được, nên không cần lưu thêm cột.

const ORDER_CODE_PATTERN = /^HV-(\d{4})(\d{2})(\d{2})-([0-9A-F]{8})$/;
const HEX_RANGE = 10 ** 10;

export function toPayosOrderCode(orderCode) {
  const match = ORDER_CODE_PATTERN.exec(orderCode ?? "");
  if (!match) throw new Error(`Mã đơn không hợp lệ: ${orderCode}`);
  const [, year, month, day, hex] = match;
  const days = Math.floor(Date.UTC(Number(year), Number(month) - 1, Number(day)) / 86_400_000);
  return days * HEX_RANGE + Number.parseInt(hex, 16);
}

export function fromPayosOrderCode(number) {
  if (!Number.isSafeInteger(number) || number <= 0) return null;
  const days = Math.floor(number / HEX_RANGE);
  const hex = (number % HEX_RANGE).toString(16).toUpperCase().padStart(8, "0");
  if (hex.length !== 8) return null;
  const date = new Date(days * 86_400_000).toISOString().slice(0, 10).replaceAll("-", "");
  return `HV-${date}-${hex}`;
}

// ---------- Tạo link thanh toán ----------

export function getPaymentExpiry(order) {
  return new Date(new Date(order.createdAt).getTime() + PAYMENT_WINDOW_MINUTES * 60_000);
}

export async function createPaymentLink({ payos, order, items, returnBase = getFrontendBaseUrl() }) {
  const expiresAt = getPaymentExpiry(order);
  const pageUrl = `${returnBase}/account/orders/${order.id}/pay`;

  const link = await payos.paymentRequests.create({
    orderCode: toPayosOrderCode(order.orderCode),
    amount: order.totalAmount,
    // payOS giới hạn mô tả 25 ký tự; mã đơn của shop dài 20 ký tự.
    description: order.orderCode.slice(0, 25),
    returnUrl: pageUrl,
    cancelUrl: pageUrl,
    expiredAt: Math.floor(expiresAt.getTime() / 1000),
    items: items.map((item) => ({
      name: String(item.productName).slice(0, 80),
      quantity: item.quantity,
      price: item.price,
    })),
    buyerName: order.recipientName,
    buyerPhone: order.recipientPhone,
  });

  return {
    paymentLinkId: link.paymentLinkId,
    checkoutUrl: link.checkoutUrl,
    qrCode: link.qrCode,
    paymentExpiresAt: expiresAt,
  };
}

// Thông tin thanh toán gửi cho khách (không có khóa hay dữ liệu nội bộ).
export function toPublicPayment(order, now = new Date()) {
  const expiresAt = order.paymentExpiresAt ?? getPaymentExpiry(order);
  return {
    method: PAYMENT_METHOD_PAYOS,
    checkoutUrl: order.checkoutUrl ?? null,
    qrCode: order.qrCode ?? null,
    amount: order.totalAmount,
    transferContent: order.orderCode,
    expiresAt: new Date(expiresAt).toISOString(),
    expired: new Date(expiresAt) <= now,
  };
}

// ---------- Đổi trạng thái đơn ----------

export async function markOrderPaid(database, { orderId, orderCode, amount = null, now = new Date() }) {
  const order = await database.order.findFirst({
    where: orderId ? { id: orderId } : { orderCode },
  });
  if (!order) return { ok: false, code: "ORDER_NOT_FOUND" };
  if (order.paymentMethod !== PAYMENT_METHOD_PAYOS) return { ok: false, code: "NOT_PAYOS_ORDER" };
  if (order.paymentStatus === "PAID") return { ok: true, order, alreadyPaid: true };
  if (amount !== null && amount !== order.totalAmount) return { ok: false, code: "AMOUNT_MISMATCH" };
  if (order.status !== "PENDING_PAYMENT") return { ok: false, code: "ORDER_NOT_PAYABLE", order };

  const claim = await database.order.updateMany({
    where: { id: order.id, status: "PENDING_PAYMENT", paymentStatus: "PENDING" },
    data: { status: "PENDING_CONFIRMATION", paymentStatus: "PAID", paidAt: now },
  });
  if (claim.count !== 1) return { ok: false, code: "ORDER_NOT_PAYABLE", order };

  return { ok: true, order: await database.order.findUnique({ where: { id: order.id } }) };
}

// Hủy đơn chưa trả tiền và trả hàng về kho. Chỉ chạy một lần cho mỗi đơn.
export async function cancelUnpaidOrder(database, order, { paymentStatus, reason }) {
  return database.$transaction(async (tx) => {
    const claim = await tx.order.updateMany({
      where: { id: order.id, status: "PENDING_PAYMENT", paymentStatus: "PENDING" },
      data: { status: "CANCELLED", paymentStatus, cancelReason: reason },
    });
    if (claim.count !== 1) return false;

    // Trả lại lượt dùng mã giảm giá đã giữ cho đơn này.
    await releaseVoucher(tx, order);

    const items = order.items ?? (await tx.orderItem.findMany({ where: { orderId: order.id } }));
    for (const item of items) {
      await tx.productVariant.update({
        where: { id: item.variantId },
        data: { stockQuantity: { increment: item.quantity } },
      });
      await tx.stockMovement.create({
        data: { variantId: item.variantId, type: "IN", quantity: item.quantity, reason: "ORDER_CANCELLED" },
      });
    }
    return true;
  });
}

// ---------- Đồng bộ với payOS ----------

// Hỏi payOS trạng thái thật của link rồi cập nhật đơn. Dùng khi khách mở trang thanh toán,
// nên đơn vẫn được ghi nhận dù webhook chưa tới được máy (ví dụ chạy local, chưa mở ngrok).
export async function syncPayosOrder({ database, payos, order, now = new Date() }) {
  if (!payos || order.paymentMethod !== PAYMENT_METHOD_PAYOS || order.status !== "PENDING_PAYMENT") {
    return order;
  }

  let remote = null;
  try {
    remote = await payos.paymentRequests.get(toPayosOrderCode(order.orderCode));
  } catch (error) {
    // Chưa gọi được payOS (mạng, link chưa tạo xong): giữ nguyên, lần sau hỏi lại.
    console.error("[payos] Không đọc được trạng thái link:", error.message);
  }

  if (remote?.status === "PAID") {
    const result = await markOrderPaid(database, { orderId: order.id, amount: remote.amountPaid, now });
    if (result.ok) return result.order;
  } else if (remote && ["CANCELLED", "EXPIRED", "FAILED"].includes(remote.status)) {
    await cancelUnpaidOrder(database, order, {
      paymentStatus: remote.status === "EXPIRED" ? "EXPIRED" : "FAILED",
      reason: remote.status === "EXPIRED" ? "Quá hạn thanh toán chuyển khoản" : "Thanh toán đã bị hủy",
    });
  } else if (getPaymentExpiry(order) <= now) {
    // payOS chưa báo hết hạn nhưng đã quá giờ của shop: hủy link rồi hủy đơn.
    await payos?.paymentRequests.cancel(toPayosOrderCode(order.orderCode), "Quá hạn thanh toán").catch(() => {});
    await cancelUnpaidOrder(database, order, {
      paymentStatus: "EXPIRED",
      reason: "Quá hạn thanh toán chuyển khoản",
    });
  }

  return database.order.findUnique({ where: { id: order.id } });
}

// Duyệt các đơn payOS còn chờ thanh toán đã quá hạn (của một khách, hoặc của tất cả).
export async function expireStalePayosOrders({ database, payos, userId = null, now = new Date() }) {
  const stale = await database.order.findMany({
    where: {
      status: "PENDING_PAYMENT",
      paymentMethod: PAYMENT_METHOD_PAYOS,
      paymentStatus: "PENDING",
      createdAt: { lte: new Date(now.getTime() - PAYMENT_WINDOW_MINUTES * 60_000) },
      ...(userId ? { userId } : {}),
    },
    include: { items: true },
  });

  for (const order of stale) {
    await syncPayosOrder({ database, payos, order, now });
  }
  return stale.length;
}

// ---------- Webhook ----------

// payOS gọi khi có giao dịch. Chữ ký được kiểm bằng Checksum Key; chỉ tin dữ liệu verify() trả về.
export async function handlePayosWebhook({ database, payos, body, now = new Date() }) {
  if (!payos) return { handled: false, reason: "PAYOS_NOT_CONFIGURED" };

  const data = await payos.webhooks.verify(body); // ném lỗi nếu chữ ký sai

  // payOS gửi một yêu cầu thử khi bạn đăng ký URL webhook.
  const orderCode = fromPayosOrderCode(data.orderCode);
  if (!orderCode) return { handled: false, reason: "UNKNOWN_ORDER_CODE" };

  if (body.success !== true || data.code !== "00") return { handled: false, reason: "NOT_A_SUCCESS" };

  const result = await markOrderPaid(database, { orderCode, amount: data.amount, now });
  return { handled: result.ok, reason: result.code ?? null, order: result.order ?? null };
}
