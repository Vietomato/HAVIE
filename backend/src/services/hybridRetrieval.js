  import { createHash } from "node:crypto";

// Shared ranking primitives for the existing KB and catalog search, not a new
// source of facts. No customer/account/inventory records belong in this index.
const STOP_WORDS = new Set("toi minh em anh chi ban cho cua la va hay voi thi sao nao gi mot nhung duoc khong co muon can ve khi nhu the de tu van giup hoi nen bao nhieu".split(" "));
export const foldSearchText = (text) => String(text ?? "").normalize("NFD")
  .replace(/\p{M}/gu, "").toLowerCase().replaceAll("đ", "d");

export function tokenize(text) {
  return (foldSearchText(text).match(/[a-z0-9]+(?:[.,][0-9]+)?/gu) ?? [])
    .filter((term) => !STOP_WORDS.has(term));
}

export function rankBM25(query, documents) {
  const terms = [...new Set(tokenize(query))];
  if (!terms.length || !documents.length) return [];
  const tokens = documents.map((doc) => tokenize(doc.searchText ?? doc.text));
  const average = tokens.reduce((sum, row) => sum + row.length, 0) / tokens.length || 1;
  const frequency = new Map(terms.map((term) => [term, tokens.filter((row) => row.includes(term)).length]));
  return documents.map((document, index) => {
    const row = tokens[index];
    let score = 0;
    for (const term of terms) {
      const tf = row.filter((token) => token === term).length;
      if (!tf) continue;
      const df = frequency.get(term);
      const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
      score += idf * tf * 2.2 / (tf + 1.2 * (0.25 + 0.75 * row.length / average));
    }
    return { document, score };
  }).filter((row) => row.score > 0).sort((a, b) => b.score - a.score || a.document.id.localeCompare(b.document.id));
}

export function cosineSimilarity(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right) || !left.length || left.length !== right.length ||
      !left.every(Number.isFinite) || !right.every(Number.isFinite)) throw new Error("Invalid embedding dimensions");
  const dot = left.reduce((sum, value, i) => sum + value * right[i], 0);
  const norm = Math.hypot(...left) * Math.hypot(...right);
  if (!norm) throw new Error("Zero embedding vector");
  return dot / norm;
}

// In-memory derived cache, invalidated by model + exact text + endpoint. Bounded
// so catalog edits cannot grow memory forever; never persists a second KB.
const vectors = new Map();
const pending = new Map();
let retryAfter = 0;
export function clearEmbeddingCache() { vectors.clear(); pending.clear(); retryAfter = 0; }
const hash = (text) => createHash("sha256").update(text).digest("hex");

export async function embedLocally(texts, {
  fetchImpl = fetch,
  baseUrl = process.env.HAVIE_EMBEDDING_URL || "http://127.0.0.1:11434",
  model = process.env.HAVIE_EMBEDDING_MODEL || "bge-m3",
  timeoutMs = 45000,
} = {}) {
  const url = new URL(baseUrl);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
      !["http:", "https:"].includes(url.protocol) || url.username || url.password) {
    throw new Error("Embedding endpoint must be local");
  }
  const keys = texts.map((text) => hash(`${url.origin}\n${model}\n${text}`));
  for (let offset = 0; offset < texts.length; offset += 24) {
    const batch = [...new Set(keys.slice(offset, offset + 24))];
    const missing = batch.filter((key) => !vectors.has(key) && !pending.has(key));
    if (missing.length) {
      const request = (async () => {
        const response = await fetchImpl(`${url.origin}/api/embed`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          redirect: "error",
          body: JSON.stringify({ model, input: missing.map((key) => texts[keys.indexOf(key)]), truncate: false, keep_alive: "10m" }),
          signal: AbortSignal.timeout(timeoutMs),
        });
        if (!response.ok) throw new Error(`Local embeddings unavailable (${response.status})`);
        const result = await response.json();
        if (!Array.isArray(result.embeddings) || result.embeddings.length !== missing.length) throw new Error("Invalid embeddings response");
        const dimension = result.embeddings[0]?.length;
        for (const vector of result.embeddings) {
          if (vector.length !== dimension) throw new Error("Inconsistent embedding dimensions");
          cosineSimilarity(vector, vector);
        }
        result.embeddings.forEach((vector, i) => {
          if (vectors.size >= 2048) vectors.delete(vectors.keys().next().value);
          vectors.set(missing[i], vector);
        });
      })();
      for (const key of missing) pending.set(key, request);
    }
    const inFlight = batch.map((key) => [key, pending.get(key)]).filter(([, request]) => request);
    try { await Promise.all([...new Set(inFlight.map(([, request]) => request))]); }
    finally {
      for (const [key, request] of inFlight) if (pending.get(key) === request) pending.delete(key);
    }
  }
  return keys.map((key) => vectors.get(key));
}

export async function rankHybrid(query, documents, {
  embed = embedLocally, limit = 5, minSimilarity = 0.55, semantic = process.env.HAVIE_SEMANTIC_SEARCH !== "false",
} = {}) {
  if (!documents.length || !tokenize(query).length) return { mode: "bm25", hits: [] };
  const lexical = rankBM25(query, documents).slice(0, 20);
  let dense = [];
  let mode = "bm25";
  if (semantic && (embed !== embedLocally || Date.now() >= retryAfter)) {
    try {
      const result = await embed([query, ...documents.map((doc) => doc.searchText ?? doc.text)]);
      if (result.length !== documents.length + 1) throw new Error("Missing embedding vectors");
      dense = documents.map((document, i) => ({ document, score: cosineSimilarity(result[0], result[i + 1]) }))
        .filter((row) => row.score >= minSimilarity).sort((a, b) => b.score - a.score).slice(0, 20);
      mode = "hybrid";
    } catch {
      // Do not log input, vectors, provider responses or customer information.
      if (embed === embedLocally) retryAfter = Date.now() + 30000;
    }
  }
  const fused = new Map();
  for (const ranking of [lexical, dense]) ranking.forEach(({ document, score }, index) => {
    const entry = fused.get(document.id) ?? { document, score: 0, bm25: 0, similarity: 0 };
    entry.score += 1 / (60 + index + 1);
    if (ranking === lexical) entry.bm25 = score;
    else entry.similarity = score;
    fused.set(document.id, entry);
  });
  const hits = [...fused.values()].sort((a, b) => b.score - a.score || a.document.id.localeCompare(b.document.id)).slice(0, limit);
  // Retain the strongest keyword evidence in the first three results. Dense
  // similarity can otherwise crowd a short, precise passage out with several
  // broadly related passages (e.g. string durability vs tension retention).
  const anchor = lexical[0] && fused.get(lexical[0].document.id);
  const slot = Math.min(3, limit) - 1;
  if (anchor && slot >= 0 && !hits.slice(0, slot + 1).some((hit) => hit.document.id === anchor.document.id)) {
    const oldIndex = hits.findIndex((hit) => hit.document.id === anchor.document.id);
    if (oldIndex >= 0) hits.splice(oldIndex, 1);
    hits.splice(slot, 0, anchor);
    hits.length = Math.min(hits.length, limit);
  }
  return { mode, hits };
}
