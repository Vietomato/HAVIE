// Đăng ký địa chỉ webhook với payOS. Chạy sau khi đã mở ngrok:
//   node scripts/payos-confirm-webhook.mjs https://xxxx.ngrok-free.app/api/payments/payos/webhook
import "dotenv/config";
import { getPayosClient } from "../src/services/payosService.js";

const url = process.argv[2];
if (!url || !/^https:\/\/.+\/api\/payments\/payos\/webhook$/.test(url)) {
  console.error("Cách dùng: node scripts/payos-confirm-webhook.mjs https://<địa-chỉ-công-khai>/api/payments/payos/webhook");
  process.exit(1);
}

const payos = getPayosClient();
if (!payos) {
  console.error("Thiếu PAYOS_CLIENT_ID, PAYOS_API_KEY hoặc PAYOS_CHECKSUM_KEY trong .env.");
  process.exit(1);
}

try {
  const result = await payos.webhooks.confirm(url);
  console.log("Đã đăng ký webhook với payOS:", result);
} catch (error) {
  console.error("Không đăng ký được webhook:", error.message);
  process.exit(1);
}
