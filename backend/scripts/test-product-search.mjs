import "dotenv/config";
import prisma from "../src/config/prisma.js";
import { searchAdvisorRackets } from "../src/services/productSearchService.js";

try {
  const budget = Number(process.argv[2] ?? 2000000);

  const result = await searchAdvisorRackets({
    budgetTargetVnd: budget,
    budgetMaxVnd: null,
    budgetIncludesStringing: true,
  });

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
