import { Router } from "express";
import prisma from "../config/prisma.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import { handleRacketMessage } from "../services/chatService.js";
import { createEmptyNeeds } from "../services/needsExtractor.js";
import { asyncHandler, HttpError } from "../utils/http.js";

const router = Router();
const processingLeaseMs = 6 * 60 * 1000;

router.use(authMiddleware);

function getConversationTitle(message) {
  const title = message.trim().replace(/\s+/g, " ");
  return title.length > 60 ? `${title.slice(0, 57)}...` : title;
}

async function clearExpiredProcessing(userId) {
  await prisma.advisorConversation.updateMany({
    where: {
      userId,
      isProcessing: true,
      processingStartedAt: { lt: new Date(Date.now() - processingLeaseMs) },
    },
    data: { isProcessing: false, processingStartedAt: null },
  });
}

router.get(
  "/conversations",
  asyncHandler(async (req, res) => {
    await clearExpiredProcessing(req.user.id);
    const conversations = await prisma.advisorConversation.findMany({
      where: { userId: req.user.id },
      select: {
        id: true,
        title: true,
        isProcessing: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json({ data: conversations });
  }),
);

router.post(
  "/conversations",
  asyncHandler(async (req, res) => {
    const conversation = await prisma.advisorConversation.create({
      data: { userId: req.user.id, needs: createEmptyNeeds() },
      select: {
        id: true,
        title: true,
        isProcessing: true,
        createdAt: true,
        updatedAt: true,
        messages: true,
      },
    });
    res.status(201).json({ data: conversation });
  }),
);

router.get(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    await clearExpiredProcessing(req.user.id);
    const conversation = await prisma.advisorConversation.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      include: { messages: { orderBy: { createdAt: "asc" } } },
    });
    if (!conversation) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
    }
    res.json({ data: conversation });
  }),
);

router.patch(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const title = req.body?.title;
    if (typeof title !== "string" || !title.trim() || title.trim().length > 60) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Tên cuộc trò chuyện phải có từ 1 đến 60 ký tự.",
      );
    }

    const updated = await prisma.advisorConversation.updateMany({
      where: { id: req.params.id, userId: req.user.id },
      data: { title: title.trim(), titleCustomized: true },
    });
    if (updated.count !== 1) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
    }

    const conversation = await prisma.advisorConversation.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: {
        id: true,
        title: true,
        isProcessing: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!conversation) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
    }
    res.json({ data: conversation, message: "Đã đổi tên cuộc trò chuyện." });
  }),
);

router.delete(
  "/conversations/:id",
  asyncHandler(async (req, res) => {
    const conversation = await prisma.advisorConversation.findFirst({
      where: { id: req.params.id, userId: req.user.id },
      select: { id: true, isProcessing: true },
    });
    if (!conversation) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
    }
    if (conversation.isProcessing) {
      throw new HttpError(
        409,
        "CONVERSATION_BUSY",
        "Không thể xóa cuộc trò chuyện khi trợ lý đang xử lý.",
      );
    }

    const deleted = await prisma.advisorConversation.deleteMany({
      where: { id: conversation.id, userId: req.user.id, isProcessing: false },
    });
    if (deleted.count !== 1) {
      throw new HttpError(
        409,
        "CONVERSATION_BUSY",
        "Cuộc trò chuyện vừa bắt đầu xử lý. Vui lòng thử xóa lại sau.",
      );
    }
    res.json({ data: { id: conversation.id }, message: "Đã xóa cuộc trò chuyện." });
  }),
);

router.post(
  "/conversations/:id/messages",
  asyncHandler(async (req, res) => {
    const { message } = req.body ?? {};
    if (typeof message !== "string" || !message.trim() || message.length > 2000) {
      throw new HttpError(
        400,
        "VALIDATION_ERROR",
        "Tin nhắn phải có từ 1 đến 2000 ký tự.",
      );
    }

    const conversation = await prisma.advisorConversation.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!conversation) {
      throw new HttpError(404, "CONVERSATION_NOT_FOUND", "Không tìm thấy cuộc trò chuyện.");
    }

    const now = new Date();
    const claim = await prisma.$transaction(async (tx) => {
      const updated = await tx.advisorConversation.updateMany({
        where: {
          id: conversation.id,
          userId: req.user.id,
          OR: [
            { isProcessing: false },
            { processingStartedAt: { lt: new Date(now.getTime() - processingLeaseMs) } },
          ],
        },
        data: { isProcessing: true, processingStartedAt: now },
      });
      if (updated.count !== 1) return false;

      const hasMessages = await tx.advisorMessage.count({
        where: { conversationId: conversation.id },
      });
      await tx.advisorMessage.create({
        data: {
          conversationId: conversation.id,
          role: "user",
          content: message.trim(),
        },
      });
      if (hasMessages === 0 && !conversation.titleCustomized) {
        await tx.advisorConversation.updateMany({
          where: {
            id: conversation.id,
            userId: req.user.id,
            titleCustomized: false,
          },
          data: { title: getConversationTitle(message) },
        });
      }
      return true;
    });

    if (!claim) {
      throw new HttpError(
        409,
        "CONVERSATION_BUSY",
        "Cuộc trò chuyện này vẫn đang xử lý. Bạn có thể mở cuộc trò chuyện mới.",
      );
    }

    try {
      const result = await handleRacketMessage(
        message.trim(),
        Object.keys(conversation.needs || {}).length
          ? conversation.needs
          : createEmptyNeeds(),
        conversation.lastQuestion,
      );

      const updatedConversation = await prisma.$transaction(async (tx) => {
        await tx.advisorMessage.create({
          data: {
            conversationId: conversation.id,
            role: "assistant",
            content: result.reply,
            candidates: result.candidates ?? undefined,
            pricingNotice: result.pricingNotice ?? null,
            action: result.action,
          },
        });

        return tx.advisorConversation.update({
          where: { id: conversation.id },
          data: {
            needs: result.needs,
            lastQuestion: result.lastQuestion,
            isProcessing: false,
            processingStartedAt: null,
          },
          include: { messages: { orderBy: { createdAt: "asc" } } },
        });
      });

      res.json({ data: updatedConversation });
    } finally {
      await prisma.advisorConversation.updateMany({
        where: {
          id: conversation.id,
          userId: req.user.id,
          isProcessing: true,
          processingStartedAt: now,
        },
        data: { isProcessing: false, processingStartedAt: null },
      });
    }
  }),
);

export default router;
