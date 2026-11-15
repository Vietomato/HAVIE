import "dotenv/config";
import { extractRacketNeeds } from "../src/services/needsExtractor.js";

const message =
  process.argv[2] ||
  "Mình mới chơi, đánh đôi, tầm 2 triệu cả cước. " +
  "Muốn vợt không quá nhẹ nhưng dễ đánh.";

try {
  const needs = await extractRacketNeeds(message);
  console.log(JSON.stringify(needs, null, 2));
} catch (error) {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
}
