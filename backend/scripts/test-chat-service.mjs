import "dotenv/config";
import prisma from "../src/config/prisma.js";
import { handleRacketMessage } from "../src/services/chatService.js";

const message =
  process.argv[2] ||
  "Mình mới chơi, đánh đôi, tầm 2 triệu cả cước. " +
  "Muốn vợt không quá nhẹ nhưng dễ đánh.";

try {
  const result = await handleRacketMessage(message);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
