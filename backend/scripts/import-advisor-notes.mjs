
import "dotenv/config";
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");

try {
  const notes = JSON.parse(
    fs.readFileSync("data/advisor-notes.json", "utf8")
      .replace(/^\uFEFF/, "")
  );

  if (!Array.isArray(notes) || notes.length === 0) {
    throw new Error("File phải chứa một mảng nhận xét không rỗng.");
  }

  // Kiểm tra toàn bộ dữ liệu trước khi ghi.
  for (const note of notes) {
    if (
      typeof note.productId !== "string" ||
      typeof note.content !== "string" ||
      !note.content.trim() ||
      note.reviewStatus !== "DRAFT" ||
      note.reviewedAt != null
    ) {
      throw new Error("Nhận xét thiếu dữ liệu hoặc không ở trạng thái DRAFT.");
    }

    if (
      !note.conditions ||
      typeof note.conditions !== "object" ||
      Array.isArray(note.conditions)
    ) {
      throw new Error("conditions phải là một object.");
    }

    const product = await prisma.product.findUnique({
      where: { id: note.productId },
      select: { id: true, name: true },
    });

    if (!product) {
      throw new Error(`Không tìm thấy sản phẩm: ${note.productId}`);
    }

    if (note.variantId != null) {
      const variant = await prisma.productVariant.findFirst({
        where: {
          id: note.variantId,
          productId: note.productId,
        },
        select: { id: true },
      });

      if (!variant) {
        throw new Error("Biến thể không thuộc sản phẩm được nhận xét.");
      }
    }

    console.log("Sản phẩm:", product.name);
    console.log("Nội dung:", note.content);
  }

  if (!apply) {
    console.log("\nKiểm tra đạt. Chưa ghi database.");
  } else {
    await prisma.$transaction(async (tx) => {
      for (const note of notes) {
        const variantId = note.variantId ?? null;
        const content = note.content.trim();

        // Bỏ qua nội dung giống hệt đã nhập trước đó.
        const existing = await tx.productAdvisorNote.findFirst({
          where: {
            productId: note.productId,
            variantId,
            content,
          },
          select: { id: true },
        });

        if (existing) {
          console.log("Đã tồn tại, bỏ qua:", existing.id);
          continue;
        }

        const created = await tx.productAdvisorNote.create({
          data: {
            productId: note.productId,
            variantId,
            content,
            conditions: note.conditions,
            reviewStatus: "DRAFT",
            reviewedAt: null,
          },
        });

        console.log("Đã tạo nhận xét DRAFT:", created.id);
      }
    });
  }
} catch (error) {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
