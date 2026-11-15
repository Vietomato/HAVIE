import { Router } from "express";
import prisma from "../config/prisma.js";
import { asyncHandler } from "../utils/http.js";
import { getPayosClient, handlePayosWebhook } from "../services/payosService.js";

const router = Router();

// payOS gọi vào đây khi có giao dịch. Không cần đăng nhập, bảo vệ bằng chữ ký (Checksum Key).
// Luôn trả 200 khi đã nhận đúng chữ ký để payOS không gọi lại; chữ ký sai thì trả 400.
router.post(
  "/payos/webhook",
  asyncHandler(async (req, res) => {
    let result;
    try {
      result = await handlePayosWebhook({
        database: prisma,
        payos: getPayosClient(),
        body: req.body,
      });
    } catch (error) {
      console.error("[payos] Webhook không hợp lệ:", error.message);
      res.status(400).json({ success: false, message: "Webhook không hợp lệ." });
      return;
    }

    if (result.handled === false && result.reason && !["UNKNOWN_ORDER_CODE", "NOT_A_SUCCESS"].includes(result.reason)) {
      console.warn("[payos] Webhook chưa xử lý được:", result.reason);
    }
    res.json({ success: true });
  }),
);

export default router;
