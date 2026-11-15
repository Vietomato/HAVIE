import "dotenv/config";
import prisma from "../src/config/prisma.js";
import {
  inspectAdvisorProduct,
} from "../src/services/productAdvisorService.js";

try {
  const result = await inspectAdvisorProduct(
    "47df1bb9-a4c0-4e98-997a-5f3f52be8592",
  );

  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}