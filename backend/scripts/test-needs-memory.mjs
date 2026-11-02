import "dotenv/config";
import { extractRacketNeeds } from "../src/services/needsExtractor.js";

const initialNeeds = {
  skillLevel: null,
  playFormat: null,
  budgetTargetVnd: null,
  budgetMaxVnd: null,
  budgetIncludesStringing: null,
  weightPreference: null,
  priorities: [],
};

try {
  const first = await extractRacketNeeds(
    "Mình mới chơi, đánh đôi, muốn vợt không quá nhẹ và dễ đánh.",
    initialNeeds,
    null,
  );

  console.log("LUOT 1:");
  console.log(JSON.stringify(first, null, 2));

  const second = await extractRacketNeeds(
    "Tầm 2 triệu.",
    first,
    "Bạn dự định chi khoảng bao nhiêu cho cây vợt?",
  );

  console.log("LUOT 2:");
  console.log(JSON.stringify(second, null, 2));

  const third = await extractRacketNeeds(
  "Tính cả cước và công căng nhé.",
  second,
  "Khoảng 2 triệu này bạn tính cả cước và công căng, hay chỉ riêng cây vợt?",
);
console.log("LUOT 3:");
console.log(JSON.stringify(third, null, 2));


} catch (error) {
  console.error("Lỗi:", error.message);
  process.exitCode = 1;
}
