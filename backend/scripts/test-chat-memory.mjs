import "dotenv/config";
import assert from "node:assert/strict";
import prisma from "../src/config/prisma.js";
import { handleRacketMessage } from "../src/services/chatService.js";

const messages = [
  "Mình mới chơi, đánh đôi, muốn vợt không quá nhẹ và dễ đánh.",
  "Tầm 2 triệu.",
  "Tính cả cước và công căng nhé.",
];

let previousNeeds = null;
let lastQuestion = null;

try {
  for (const [index, message] of messages.entries()) {
    const result = await handleRacketMessage(
      message,
      previousNeeds,
      lastQuestion,
    );

    console.log(`\nLUOT ${index + 1}: ${message}`);
    console.log(JSON.stringify(result, null, 2));

    assert.equal(result.needs.skillLevel, "beginner");
    assert.equal(result.needs.playFormat, "doubles");
    assert.equal(result.needs.weightPreference, "không quá nhẹ");
    assert.ok(result.needs.priorities.includes("easy_to_use"));

    if (index === 0) {
      assert.equal(result.action, "ask_followup");
      assert.equal(result.needs.budgetTargetVnd, null);
      assert.equal(result.needs.budgetIncludesStringing, null);
    }

    if (index === 1) {
      assert.equal(result.action, "ask_followup");
      assert.equal(result.needs.budgetTargetVnd, 2_000_000);
      assert.equal(result.needs.budgetIncludesStringing, null);
    }

    if (index === 2) {
      assert.equal(result.needs.budgetTargetVnd, 2_000_000);
      assert.equal(result.needs.budgetIncludesStringing, true);

      assert.ok(
        ["no_reviewed_match", "review_candidates"]
          .includes(result.action),
      );
    }

    previousNeeds = result.needs;
    lastQuestion = result.lastQuestion;
  }

  console.log("\nPASS: Chat service giữ nhu cầu qua 3 lượt.");
} catch (error) {
  console.error("\nFAIL:", error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}