import test from "node:test";
import assert from "node:assert/strict";
import { rankBM25, rankHybrid, embedLocally, clearEmbeddingCache, cosineSimilarity } from "../src/services/hybridRetrieval.js";
import { buildKnowledgeDocuments, loadKnowledge, retrieveKnowledge, retrieveKnowledgeHybrid } from "../src/services/knowledgeBase.js";

test("BM25 handles Vietnamese accents, repeated words and exact product identifiers", () => {
  const documents = [{ id: "a", text: "BG65 cước bền tập luyện" }, { id: "b", text: "BG80 kiểm soát bám cầu" }];
  assert.equal(rankBM25("cuoc ben BG65", documents)[0].document.id, "a");
  assert.equal(rankBM25("BG80", documents)[0].document.id, "b");
  assert.deepEqual(rankBM25("cảm ơn", []), []);
});

test("semantic vectors retrieve a paraphrase with no lexical overlap and fuse with BM25", async () => {
  const documents = [{ id: "control", text: "head light maneuverable" }, { id: "power", text: "head heavy smash" }];
  const result = await rankHybrid("xoay trở linh hoạt", documents, {
    embed: async () => [[1, 0], [0.99, 0.01], [0, 1]], semantic: true,
  });
  assert.equal(result.mode, "hybrid");
  assert.equal(result.hits[0].document.id, "control");
  assert.equal(result.hits[0].bm25, 0);
  assert.ok(result.hits[0].similarity > 0.99);
});

test("embedding errors, malformed vectors and low similarity do not invent matches", async () => {
  const docs = [{ id: "a", text: "BG65 bền" }];
  for (const embed of [async () => { throw new Error("offline"); }, async () => [[1, 0], [1]], async () => [[0, 0], [1, 0]]]) {
    const result = await rankHybrid("BG65", docs, { embed, semantic: true });
    assert.equal(result.mode, "bm25");
    assert.equal(result.hits[0].document.id, "a");
  }
  const none = await rankHybrid("không liên quan", docs, { embed: async () => [[1, 0], [0, 1]], semantic: true });
  assert.deepEqual(none.hits, []);
  assert.throws(() => cosineSimilarity([1], [1, 0]));
});

test("embeddings remain local, cache exact content and invalidate edits and models", async () => {
  clearEmbeddingCache();
  let calls = 0;
  const fetchImpl = async (url, options) => {
    calls++;
    assert.equal(url, "http://127.0.0.1:11434/api/embed");
    const body = JSON.parse(options.body);
    assert.equal(body.truncate, false);
    return { ok: true, json: async () => ({ embeddings: body.input.map(() => [1, 0]) }) };
  };
  const options = { fetchImpl, baseUrl: "http://127.0.0.1:11434", model: "test" };
  await embedLocally(["public paragraph"], options);
  await embedLocally(["public paragraph"], options);
  assert.equal(calls, 1);
  await embedLocally(["edited paragraph"], options);
  await embedLocally(["public paragraph"], { ...options, model: "new-model" });
  assert.equal(calls, 3);
  await assert.rejects(embedLocally(["text"], { ...options, baseUrl: "https://external.example" }), /must be local/);
  assert.equal(calls, 3);
  clearEmbeddingCache();
});

test("KB passages cover existing customer knowledge with stable paths, excluding internal policy", () => {
  const kb = loadKnowledge();
  const docs = buildKnowledgeDocuments(kb);
  for (const topic of kb.consultation_topics) assert.ok(docs.some((doc) => doc.path === `consultation_topics.${topic.id}`));
  for (const section of ["racquet.weight_classes", "racquet.balance_types", "racquet.shaft_flex", "stringing.models", "stringing.tension_adjustments"]) {
    assert.ok(docs.some((doc) => doc.path.startsWith(section)), section);
  }
  assert.equal(new Set(docs.map((doc) => doc.id)).size, docs.length);
  assert.ok(docs.every((doc) => !/assistant_rules|tension_policy|suitability_rules/u.test(doc.path)));
});

test("semantic KB fallback retrieves a paraphrase and keeps shoe/racket topics separate", async () => {
  let target;
  const query = "Bàn chân ngang rộng cần gì?";
  assert.equal(retrieveKnowledge(query).snippets.length, 0);
  const result = await retrieveKnowledgeHybrid(query, null, loadKnowledge(), {
    semantic: true,
    embed: async (texts) => {
      target = texts.findIndex((text, i) => i > 0 && /phom|bề ngang/iu.test(text));
      return texts.map((_, i) => i === 0 || i === target ? [1, 0] : [0, 1]);
    },
  });
  assert.ok(target > 0);
  assert.ok(result.snippets.length);
  assert.ok(result.snippets.every((item) => item.topic.startsWith("shoe_")));
});

test("fusion retains the strongest BM25 evidence when broad semantic matches crowd it out", async () => {
  const documents = [{ id: "exact", text: "BG65 tiết kiệm" }, ...Array.from({ length: 5 }, (_, i) => ({ id: `broad-${i}`, text: "tiết kiệm cước" }))];
  const result = await rankHybrid("BG65 tiết kiệm", documents, {
    semantic: true, limit: 3,
    embed: async () => [[1, 0], [0, 1], ...Array.from({ length: 5 }, () => [1, 0])],
  });
  assert.ok(result.hits.some((hit) => hit.document.id === "exact"));
});

test("numeric tension safety does not depend on semantic retrieval", async () => {
  const result = await retrieveKnowledgeHybrid("Căng 30 lbs được không?", null, loadKnowledge(), {
    embed: async () => assert.fail("numeric safety must bypass embeddings"),
  });
  assert.equal(result.tensionRequest.lbf, 30);
});
