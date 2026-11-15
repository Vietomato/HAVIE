import { writeFile } from "node:fs/promises";
import { buildKnowledgeDocuments } from "../src/services/knowledgeBase.js";
import { rankBM25, rankHybrid } from "../src/services/hybridRetrieval.js";

// Explicit, read-only local-model experiment. Does not load dotenv, contact Groq
// or access account/order records. Run outside the automated unit-test suite.
const documents = buildKnowledgeDocuments();
const queries = [
  { query: "Cổ tay yếu, muốn xoay trở nhanh để đỡ cầu thì chọn vợt sao?", expected: ["consultation_topics.beginner_balance", "racquet.balance_types.2"] },
  { query: "Chân ngang rộng, chạy ngang dễ lật cổ chân thì chọn giày thế nào?", expected: ["consultation_topics.shoe_width", "consultation_topics.shoe_stability"] },
  { query: "Loại dây nào lâu đứt, dùng tập luyện tiết kiệm?", expected: ["stringing.string_selection_guidance.0"] },
  { query: "Muốn dễ phất từ cuối sân khi lực vung còn yếu, nên chọn thân vợt sao?", expected: ["racquet.shaft_flex.0", "consultation_topics.beginner_balance"] },
];
const rows = [];
for (const { query, expected } of queries) {
  const start = Date.now();
  const hybrid = await rankHybrid(query, documents, { limit: 5 });
  const bm25 = rankBM25(query, documents).slice(0, 5);
  const bm25Paths = bm25.map((hit) => hit.document.path);
  const hybridPaths = hybrid.hits.map((hit) => hit.document.path);
  const row = { query, expected, mode: hybrid.mode, elapsedMs: Date.now() - start,
    bm25: bm25Paths, hybrid: hybrid.hits.map((hit) => ({ path: hit.document.path, similarity: hit.similarity, bm25: hit.bm25 })),
    bm25HitAt3: expected.some((path) => bm25Paths.slice(0, 3).includes(path)),
    hybridHitAt3: expected.some((path) => hybridPaths.slice(0, 3).includes(path)),
  };
  rows.push(row);
  console.log(JSON.stringify(row));
}
const report = { generatedAt: new Date().toISOString(), model: "bge-m3", passages: documents.length,
  note: "Small smoke benchmark, not a production accuracy estimate. Cold corpus embedding is included in first-query time.", rows };
await writeFile(new URL("../data/hybrid-retrieval-evaluation.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
if (rows.some((row) => row.mode !== "hybrid")) process.exitCode = 1;
