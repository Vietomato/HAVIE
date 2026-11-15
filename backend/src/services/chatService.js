import {
  AdvisorModelUnavailableError,
  createEmptyNeeds,
  extractRacketNeeds,
} from "./needsExtractor.js";
import { decideNextAction } from "./conversationPolicy.js";
import {
  findAdvisorAlternatives,
  searchAdvisorProducts,
  searchYonexStrings,
  findCatalogProductsByModel,
  isNamedCatalogQuestion,
} from "./productSearchService.js";
import {
  BRAND_LABELS,
  describeFit,
  describeNeedsChange,
  describeOutOfScope,
  describePrivateRequest,
  fitPenalty,
  formatVnd,
  polishReply,
  preferencePenalty,
} from "./advisorReply.js";
import { findStringModels, getStringQuestionIntent, getTensionConversion, isKnowledgeOnlyQuestion, loadKnowledge, retrieveKnowledgeHybrid } from "./knowledgeBase.js";
import { preferenceRank } from "./racketSuitability.js";
import { NO_STRINGING_NOTICE, describeRacketRecommendations } from "./racketRecommendation.js";
import { answerTensionConversion, answerTensionUnitDefinition, formatLbsWithKg, formatLbsRangeWithKg, resolveTensionFollowup } from "./tensionUnits.js";
import { formatReplyParagraphs } from "../utils/replyFormat.js";
import {
  adviseTension,
  describeTensionAnswer,
  describeTensionSuggestion,
} from "./tensionAdvisor.js";

// Gợi ý mức căng theo trình độ, bị chặn bởi giới hạn hãng của đúng mẫu vợt.
function tensionSuggestionFor(needs, candidate) {
  if (needs.productType !== "rackets" || !candidate?.advisorSpecs) return null;

  return describeTensionSuggestion(
    adviseTension({
      skillLevel: needs.skillLevel,
      specs: candidate.advisorSpecs,
    }),
  );
}

// Kiến thức truy xuất được đổi thành câu văn do backend dựng; không đưa
// nguyên văn kho dữ liệu cho mô hình.
function buildKnowledgeSentences(knowledge, needs, result) {
  const sentences = knowledge.snippets.map((item) => item.text);
  const top = result.candidates?.[0] ?? null;

  if (knowledge.topics.includes("tension") && needs.productType !== "shoes") {
    const request = knowledge.tensionRequest ?? null;

    const alreadySuggested =
      request === null &&
      tensionSuggestionFor(needs, top) !== null &&
      result.action === "review_candidates";

    if (!alreadySuggested) {
      // Giới hạn hãng theo từng biến thể (3U khác 4U), nên nêu cả tên biến thể.
      const label = top
        ? [top.name, top.variantName].filter(Boolean).join(" ")
        : null;

      sentences.push(
        describeTensionAnswer(
          adviseTension({
            skillLevel: needs.skillLevel,
            specs: top?.advisorSpecs ?? null,
            requestedLbf: request?.lbf ?? null,
          }),
          label,
          request,
        ),
      );
    }
  }

  if (knowledge.heuristicNotice) sentences.push(knowledge.heuristicNotice);
  if (knowledge.stringNotice) sentences.push(knowledge.stringNotice);

  return sentences;
}

const STOCK_PRIVACY = "Em không cung cấp thông tin tồn kho trong cuộc trò chuyện.";

// Also applied when reading persisted conversations, including older candidate payloads.
export function sanitizeChatData(value) {
  if (Array.isArray(value)) return value.map(sanitizeChatData);
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const privateKeys = new Set([
    "stockQuantity", "stock_quantity", "internalNotes", "costPrice", "purchasePrice",
    "supplier", "password", "passwordHash", "apiKey", "apiSecret", "secret", "token", "otp",
  ]);
  return Object.fromEntries(Object.entries(value).filter(([key]) => !privateKeys.has(key))
    .map(([key, item]) => [key, sanitizeChatData(item)]));
}

function knowledgeResult(needs, lastQuestion, reply) {
  return {
    action: "answer_knowledge", needs, lastQuestion, requestedField: null,
    suitabilityAssessed: false, candidates: [], reply, draftReply: reply,
    replySource: "template", replyIssue: null,
  };
}

async function stringCommerceSentences(intent, names, searchStrings) {
  const sentences = [];
  if (intent.price && names.length) {
    try {
      // Never pass inventory or internal attributes to the writer or the client.
      const catalog = (await searchStrings(names)).map(({ model, name, variantName, priceVnd }) =>
        ({ model, name, variantName, priceVnd }));
      for (const name of names) {
        const matches = catalog.filter((item) => item.model === name);
        if (!matches.length) sentences.push(`Em chưa có giá ${name} trong danh mục hiện tại.`);
        else sentences.push(...matches.map((item) =>
          `${[item.name, item.variantName].filter(Boolean).join(" / ")}: ${item.priceVnd === null ? "chưa có giá hợp lệ" : formatVnd(item.priceVnd)}.`));
      }
    } catch (error) {
      console.error("[chatService] Không đọc được giá cước:", error.message);
      sentences.push("Hiện em chưa tra được giá cước, anh/chị thử lại sau nhé.");
    }
  }
  if (intent.stock) sentences.push(STOCK_PRIVACY);
  if (intent.labor) sentences.push("Em chưa có bảng giá công căng được xác minh để trả lời phần này.");
  return sentences;
}

function buildFallback(error, previousNeeds, lastQuestion) {
  const unavailable = error instanceof AdvisorModelUnavailableError;

  // Không đọc được câu trả lời: hỏi lại bằng cách khác, nêu rõ lựa chọn, thay vì
  // lặp nguyên văn câu hỏi cũ.
  const decision = decideNextAction(previousNeeds ?? createEmptyNeeds());
  const question =
    !unavailable && decision.action === "ask_followup"
      ? decision.clarification
      : lastQuestion;

  const reply = unavailable
    ? "Trợ lý tư vấn đang tạm gián đoạn. Anh/chị thử lại sau ít phút nhé."
    : "Em chưa hiểu rõ ý anh/chị." +
      (question ? ` ${question}` : " Anh/chị nói rõ hơn giúp em nhé.");

  return {
    action: unavailable ? "advisor_unavailable" : "clarify",
    needs: previousNeeds ?? createEmptyNeeds(),
    reply,
    lastQuestion: question,
    requestedField: null,
    suitabilityAssessed: false,
    candidates: [],
  };
}

function describeAlternatives(needs, { reason, candidates }) {
  const brand =
    BRAND_LABELS[needs.brandPreference] ?? needs.brandPreference;
  const budget = needs.budgetTargetVnd ?? needs.budgetMaxVnd;
  const price = candidates[0].priceVnd;
  const nearest =
    `có giá ${formatVnd(price)}` +
    (price > budget
      ? `, cao hơn ngân sách ${formatVnd(price - budget)}`
      : "");

  if (reason === "brand") {
    return `Em chưa có mẫu ${brand} trong tầm giá này, nhưng có mẫu hãng khác phù hợp ngân sách.`;
  }

  if (reason === "brand_and_price") {
    return `Em chưa có mẫu ${brand} gần mức ${formatVnd(budget)}. Mẫu hãng khác gần nhất ${nearest}.`;
  }

  return `Em chưa có mẫu đúng mức ${formatVnd(budget)}. Mẫu gần nhất ${nearest}.`;
}

// Gần ngân sách trước; mẫu khó với người mới xuống sau.
function sortCandidates(candidates, needs) {
  const anchor = needs.budgetTargetVnd ?? needs.budgetMaxVnd;
  const distance = (item) =>
    Number.isFinite(item.priceVnd) ? Math.abs(item.priceVnd - anchor) : Infinity;

  return [...candidates].sort(
    (left, right) =>
      preferenceRank(left, needs) - preferenceRank(right, needs) ||
      // Mức hợp theo kho kiến thức trước (hợp > chưa đủ dữ liệu > cần lưu ý).
      (right.fit?.tier ?? 1) - (left.fit?.tier ?? 1) ||
      fitPenalty(left, needs) - fitPenalty(right, needs) ||
      preferencePenalty(left, needs) - preferencePenalty(right, needs) ||
      (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0) ||
      distance(left) - distance(right) ||
      (left.priceVnd ?? 0) - (right.priceVnd ?? 0),
  );
}

function describeCandidates(needs, candidates, excludedForFit = 0) {
  const anchor = needs.budgetTargetVnd ?? needs.budgetMaxVnd;

  // Danh sách xếp theo độ hợp trước, nên mẫu gần ngân sách nhất không nhất thiết đứng đầu.
  const nearest = candidates.reduce(
    (best, item) =>
      Math.abs(item.priceVnd - anchor) < Math.abs(best - anchor) ? item.priceVnd : best,
    candidates[0].priceVnd,
  );
  const sentences = [
    candidates.length === 1
      ? "Em tìm được 1 mẫu theo điều kiện của anh/chị."
      : `Em tìm được ${candidates.length} mẫu theo điều kiện của anh/chị.`,
  ];

  if (needs.budgetTargetVnd == null && Number.isSafeInteger(nearest)) {
    sentences.push(
      `Mẫu gần ngân sách ${formatVnd(anchor)} nhất hiện có giá ${formatVnd(nearest)}.`,
    );
  } else if (Number.isSafeInteger(anchor)) {
    sentences.push(`Các mẫu được ưu tiên theo thông số và nhu cầu, quanh mức ${formatVnd(anchor)}.`);
  }

  if (needs.productType === "rackets") {
    const top = candidates[0];
    const fit = describeFit(top, needs);
    const fitNotes = top.fit?.tier === 2 ? top.fit.fitNotes.slice(0, 2) : [];
    const cautionNotes = top.fit?.cautionNotes?.slice(0, 1) ?? [];

    if (needs.balancePreference && !candidates.some((item) =>
      (item.advisorSpecs?.balanceType ?? item.racketTraits?.balanceType) === needs.balancePreference)) {
      sentences.push("Chưa có mẫu xác nhận đúng sở thích cân bằng trong các lựa chọn này; em chưa coi chúng là mẫu đã khớp yêu cầu đó.");
    }

    if (fitNotes.length) {
      sentences.push(`${top.name} hợp với anh/chị ở điểm: ${fitNotes.join("; ")}.`);
    } else if (cautionNotes.length) {
      sentences.push(`Lưu ý với ${top.name}: ${cautionNotes[0]}.`);
    }

    sentences.push(
      ...(fit.length
        ? fit
        : fitNotes.length || cautionNotes.length
          ? []
          : ["Em chưa có đủ thông số để đánh giá độ hợp với lối chơi của anh/chị."]),
    );

    const tension = tensionSuggestionFor(needs, candidates[0]);

    if (tension) sentences.push(tension);

    if (!top.advisorSpecs) {
      sentences.push("Chưa có đủ thông số hãng đã duyệt cho đúng biến thể; nhận xét từ catalog cần được xác minh thêm.");
    } else if (!top.advisorSpecs.balanceType) {
      sentences.push("Chưa có điểm cân bằng đã xác minh của hãng cho biến thể này.");
    }

    if (excludedForFit > 0) {
      sentences.push(
        `Em đã bỏ ${excludedForFit} mẫu trong tầm giá vì chưa hợp với trình độ hoặc sở thích anh/chị nêu.`,
      );
    }
  } else {
    const sizeUnverified = candidates.some(
      (candidate) => candidate.sizeStatus !== "listed_size_match",
    );

    sentences.push(
      sizeUnverified
        ? "Một số mẫu chưa xác nhận được size anh/chị yêu cầu."
        : "Các mẫu có size trùng với size anh/chị cung cấp.",
      "Anh/chị nên đối chiếu bảng size đúng model và phom chân trước khi chọn.",
    );
  }

  return sentences.join(" ");
}

// Quyết định nội dung trả lời; câu chữ cuối cùng do polishReply xử lý.
async function decideReply(needs, { search, findAlternatives, query }) {
  const decision = decideNextAction(needs);

  if (decision.action === "ask_followup") {
    return {
      action: "ask_followup",
      needs,
      reply: decision.question,
      lastQuestion: decision.question,
      requestedField: decision.field,
      clarification: decision.clarification,
      suitabilityAssessed: false,
      candidates: [],
    };
  }

  if (decision.action !== "search_products") {
    throw new Error(`Hành động chưa được hỗ trợ: ${decision.action}`);
  }

  const found = await search(needs, { query });

  if (!["CANDIDATES_FOUND", "NO_REVIEWED_MATCH"].includes(found.status)) {
    throw new Error(`Trạng thái tìm kiếm chưa được hỗ trợ: ${found.status}`);
  }

  if (!Array.isArray(found.candidates)) {
    throw new Error("Danh sách sản phẩm trả về không hợp lệ.");
  }

  const common = {
    needs,
    lastQuestion: null,
    requestedField: null,
    pricingNotice:
      needs.productType === "rackets"
        ? null
        : "Giá niêm yết theo từng biến thể sản phẩm.",
    initialBudgetVnd: found.initialBudgetVnd,
    suitabilityAssessed: false,
  };

  if (found.status === "NO_REVIEWED_MATCH" || found.candidates.length === 0) {
    const alternatives = await findAlternatives(needs, { query });

    if (alternatives) {
      const followUp = "Anh/chị muốn xem mẫu này hay đổi hãng, khoảng giá tìm kiếm?";

      return {
        ...common,
        action: "suggest_alternatives",
        reply: `${describeAlternatives(needs, alternatives)} ${followUp}`,
        lastQuestion: followUp,
        candidates: alternatives.candidates,
      };
    }

    const question = "Anh/chị muốn đổi hãng hay mở rộng khoảng giá tìm kiếm không?";

    return {
      ...common,
      action: "no_reviewed_match",
      reply:
        (found.excludedForFit > 0
          ? `Trong tầm giá có ${found.excludedForFit} mẫu nhưng chưa hợp với trình độ hoặc sở thích anh/chị nêu. `
          : "") +
        "Em chưa tìm thấy sản phẩm đáp ứng các điều kiện tìm kiếm " +
        `hiện tại trong dữ liệu cửa hàng. ${question}`,
      lastQuestion: question,
      candidates: [],
    };
  }

  const candidates = sortCandidates(found.candidates, needs);

  // Vợt: câu tư vấn có cấu trúc (3-5 mẫu, thông số, lý do chọn). Giày giữ cách viết cũ.
  const racketReply = needs.productType === "rackets";

  return {
    ...common,
    action: "review_candidates",
    structured: racketReply,
    reply: racketReply
      ? describeRacketRecommendations(needs, candidates, { excludedForFit: found.excludedForFit ?? 0 })
      : describeCandidates(needs, candidates, found.excludedForFit ?? 0),
    candidates,
  };
}

const UNCHANGED_NOTE =
  "Dạ vâng, các mẫu em gợi ý ở trên vẫn đang đúng với điều kiện của anh/chị nhé. " +
  "Nếu anh/chị muốn xem thêm lựa chọn khác, cứ cho em biết ngân sách, hãng hoặc lối chơi mới, em tìm lại ngay cho anh/chị ạ.";

function buildFacts(result, knowledge) {
  return {
    // Chỉ ghi chủ đề và độ tin cậy; nội dung nằm trong bản nháp đã kiểm tra.
    knowledge: knowledge.snippets.map(({ topic, kind }) => ({ topic, kind })),
    products: result.candidates.map((candidate) => ({
      name: candidate.name,
      price: formatVnd(candidate.priceVnd),
      notes: describeFit(candidate, result.needs),
    })),
    pricingNotice: result.pricingNotice ?? null,
  };
}

async function handleRacketMessageCore(
  message,
  previousNeeds = null,
  lastQuestion = null,
  {
    extract = extractRacketNeeds,
    search = searchAdvisorProducts,
    findAlternatives = findAdvisorAlternatives,
    polish = polishReply,
    searchStrings = searchYonexStrings,
    lookupProducts = findCatalogProductsByModel,
    history = [],
    retrieve = retrieveKnowledgeHybrid,
  } = {},
) {
  const savedNeeds = { ...createEmptyNeeds(), ...(previousNeeds ?? {}) };
  const privateNotice = describePrivateRequest(message);
  if (privateNotice) return knowledgeResult(savedNeeds, lastQuestion, privateNotice);
  // Resolve only a short numeric follow-up to a conversion, locally. Raw history
  // is never included in the AI prompt, and the current buying message wins.
  const tensionMessage = resolveTensionFollowup(message, history);
  // A unit conversion does not change shopping needs or select a racket.
  // Keep it deterministic, including when the AI provider/catalog is unavailable.
  try {
    const conversion = getTensionConversion(tensionMessage) ?? answerTensionConversion(tensionMessage) ?? answerTensionUnitDefinition(message);
    if (conversion) return {
      action: "answer_knowledge",
      needs: { ...createEmptyNeeds(), ...(previousNeeds ?? {}) },
      lastQuestion,
      requestedField: null,
      suitabilityAssessed: false,
      candidates: [],
      reply: conversion,
      draftReply: conversion,
      replySource: "template",
      replyIssue: null,
    };
  } catch (error) {
    console.error("[chatService] Không đọc được quy đổi đơn vị:", error.message);
  }
  let stringIntent = { focused: false, price: false, stock: false, labor: false };
  try {
    stringIntent = getStringQuestionIntent(message);
  } catch (error) {
    console.error("[chatService] Không đọc được ý hỏi cước:", error.message);
  }
  if (stringIntent.stock && !stringIntent.focused && !stringIntent.price && !stringIntent.description) {
    return knowledgeResult(savedNeeds, lastQuestion, STOCK_PRIVACY);
  }
  if (stringIntent.focused) {
    const knowledge = await retrieve(message, savedNeeds);
    const draft = stringIntent.description
      ? knowledge.snippets.filter((item) => ["string", "string_choice", "gauge_tradeoffs", "tension_retention"].includes(item.topic))
        .map((item) => item.text).join(" ")
      : "";
    const polished = draft ? await polish({ message, draft, facts: {
      knowledge: knowledge.snippets.map(({ topic, kind }) => ({ topic, kind })), products: [],
    } }) : { reply: "", source: "template" };
    const commerce = await stringCommerceSentences(stringIntent, stringIntent.models, searchStrings);
    const join = (text) => [...describeOutOfScope(message), text, ...commerce].filter(Boolean).join(" ");
    return {
      ...knowledgeResult(savedNeeds, lastQuestion, join(polished.reply)),
      draftReply: join(draft), replySource: polished.source, replyIssue: polished.reason,
    };
  }
  if (!stringIntent.models?.length && isNamedCatalogQuestion(message)) {
    let products;
    try {
      products = await lookupProducts(message);
    } catch (error) {
      console.error("[chatService] Không tra được model:", error.message);
      return knowledgeResult(savedNeeds, lastQuestion, "Hiện em chưa tra được dữ liệu sản phẩm, anh/chị thử lại sau nhé.");
    }
    const priceOnly = /giá|bao nhiêu tiền/iu.test(message) && !/thông số|so sánh|tìm hiểu|muốn biết|giới thiệu|cứng|dẻo|cân bằng|nặng đầu|nhẹ đầu|trọng lượng|khối lượng/iu.test(message);
    const generalSpecs = /thông số|so sánh|tìm hiểu|muốn biết|giới thiệu|hợp/iu.test(message);
    const asksFlex = !generalSpecs && /cứng|dẻo|flex/iu.test(message);
    const asksBalance = !generalSpecs && /cân bằng|nặng đầu|nhẹ đầu|\bbp\b/iu.test(message);
    const asksWeight = !generalSpecs && /trọng lượng|khối lượng/iu.test(message);
    const lines = products.flatMap((product) => {
      const prices = [...new Set(product.variants.map((variant) => variant.priceVnd))].sort((a, b) => a - b);
      const price = prices.length ? (prices.length === 1 ? formatVnd(prices[0])
        : `${formatVnd(prices[0])} đến ${formatVnd(prices.at(-1))}, tùy biến thể`) : "chưa có giá đã xác minh";
      if (priceOnly) return [`${product.name}: ${price}.`];
      const specs = product.variants.filter((variant) => variant.advisorSpecs).slice(0, 3);
      if (asksFlex || asksBalance || asksWeight) {
        const racquet = loadKnowledge().racquet;
        if (!specs.length) return [`${product.name}: em chưa có đủ thông số hãng cho đúng biến thể để xác nhận phần này.`];
        return specs.flatMap((variant) => {
          const label = [product.name, variant.name].filter(Boolean).join(" ");
          const s = variant.advisorSpecs;
          const facts = [];
          if (asksFlex) facts.push(`${label}: ${s.shaftFlex
            ? `thân ${racquet.shaft_flex.find((item) => item.id === s.shaftFlex)?.label}`
            : "chưa có độ cứng đủ rõ và thống nhất để xác nhận"}.`);
          if (asksBalance) facts.push(`${label}: ${s.balanceType
            ? racquet.balance_types.find((item) => item.id === s.balanceType)?.label
            : "chưa có phân loại cân bằng đã xác minh"}.`);
          if (asksWeight) facts.push(`${label}: ${s.weightClass
            ? `hạng trọng lượng ${s.weightClass}`
            : Number.isFinite(s.averageWeightG) ? `khối lượng trung bình ${s.averageWeightG} g` : "chưa có trọng lượng đã xác minh"}.`);
          if (/giá|bao nhiêu tiền/iu.test(message)) facts.push(`Giá ${label}: ${formatVnd(variant.priceVnd)}.`);
          return facts;
        });
      }
      const facts = specs.flatMap((variant) => [
        ...(Number.isFinite(variant.advisorSpecs.averageWeightG)
          ? [`${product.name} ${variant.name}: khối lượng trung bình hãng ghi ${variant.advisorSpecs.averageWeightG} g.`]
          : variant.advisorSpecs.weightClass ? [`${product.name} ${variant.name}: hạng trọng lượng ${variant.advisorSpecs.weightClass}.`] : []),
        ...describeFit({ name: `${product.name} ${variant.name}`, advisorSpecs: variant.advisorSpecs }, savedNeeds),
      ]);
      if (!facts.length) facts.push(`${product.name}: em chưa có đủ thông số hãng đã duyệt để đánh giá độ hợp hoặc so sánh kỹ thuật cho đúng biến thể.`);
      if (/giá|bao nhiêu tiền/iu.test(message)) facts.push(`Giá ${product.name}: ${price}.`);
      return facts;
    });
    const reply = lines.length ? lines.join(" ")
      : "Em chưa xác định được model này trong danh mục hiện tại. Anh/chị gửi tên đầy đủ và phiên bản sản phẩm giúp em nhé?";
    return knowledgeResult(savedNeeds, lastQuestion, reply);
  }
  // Education about rackets, strings and shoes uses the same KB, without a sales questionnaire.
  let educationalKnowledge;
  try {
    educationalKnowledge = await retrieve(message, savedNeeds);
  } catch (error) {
    console.error("[chatService] Không đọc được kiến thức tư vấn:", error.message);
  }
  const frameWarning = educationalKnowledge?.snippets.find((item) => item.topic === "racket_damage");
  if (frameWarning) return knowledgeResult(savedNeeds, lastQuestion, frameWarning.text);
  if (educationalKnowledge?.tensionRequest && /(?:astrox|nanoflare|arcsaber|axforce|halbertec|bladex|windstorm|auraspeed|thruster)[\s-]*\d/iu.test(message)) {
    let models;
    try { models = await lookupProducts(message); }
    catch { return knowledgeResult(savedNeeds, lastQuestion, "Em chưa tra được thông số đúng model để kiểm tra mức căng, nên chưa chốt mức này."); }
    if (models.length > 1) return knowledgeResult(savedNeeds, lastQuestion,
      "Danh mục đang có nhiều sản phẩm tên gần giống nhau. Em cần xác nhận đúng sản phẩm và biến thể trước khi kiểm tra giới hạn căng, nên chưa chốt mức này.");
    const model = models[0];
    const weight = message.match(/(?:^|[^\p{L}\p{N}])([2-6]u)(?=$|[^\p{L}\p{N}])/iu)?.[1];
    const variants = (model?.variants ?? []).filter((variant) => !weight ||
      new RegExp(`(?:^|[^a-z0-9])${weight}(?=g\\d|[^a-z0-9]|$)`, "iu").test(variant.name));
    if (variants.length > 1) return knowledgeResult(savedNeeds, lastQuestion,
      "Giới hạn căng có thể khác theo từng biến thể. Anh/chị cho em đúng phiên bản trọng lượng và quy cách trên vợt để kiểm tra nhé?");
    const variant = variants[0];
    const request = educationalKnowledge.tensionRequest;
    const advice = adviseTension({ skillLevel: savedNeeds.skillLevel,
      specs: variant?.advisorSpecs ?? null, requestedLbf: request.lbf });
    return knowledgeResult(savedNeeds, lastQuestion, describeTensionAnswer(advice,
      model ? [model.name, variant?.name].filter(Boolean).join(" ") : null, request));
  }
  // A numeric tension question is not an answer to a pending buying question.
  // Never take the first recommended racket as the customer's selected model.
  if (educationalKnowledge?.tensionRequest &&
      !/mua|tìm\s+(?:vợt|giày)|gợi ý\s+(?:vợt|giày|mẫu)|ngân sách|triệu|giá|bao nhiêu tiền|đánh đôi|đánh đơn/iu.test(message)) {
    const request = educationalKnowledge.tensionRequest;
    const skillLevel = /mới chơi|người mới|mới bắt đầu/iu.test(message) ? "beginner"
      : /nâng cao|chuyên nghiệp/iu.test(message) ? "advanced"
        : /trung cấp|trung bình|phong trào/iu.test(message) ? "intermediate" : savedNeeds.skillLevel;
    const advice = adviseTension({ skillLevel, specs: null, requestedLbf: request.lbf });
    const sentences = [];
    if (request.lbf && request.unit === "lbs") sentences.push(`${formatLbsWithKg(request.lbf)}.`);
    if (request.lbf && advice.heuristic) {
      sentences.push(`Khoảng tham khảo chung theo trình độ của anh/chị là ${formatLbsRangeWithKg(advice.heuristic.lowLbf, advice.heuristic.highLbf)}, chưa phải giới hạn của một cây vợt cụ thể.`);
    }
    sentences.push(describeTensionAnswer(advice, null, request));
    return knowledgeResult(savedNeeds, lastQuestion, sentences.join(" "));
  }
  if (educationalKnowledge && isKnowledgeOnlyQuestion(message, educationalKnowledge)) {
    const sentences = educationalKnowledge.snippets.map((item) => item.text);
    if (educationalKnowledge.topics.includes("tension") &&
        (!sentences.length || /(?:nên|mức|bao nhiêu|mấy).*(?:căng|kg|ký|lbs)|căng.*(?:bao nhiêu|mấy)/iu.test(message))) {
      const explicitSkill = /mới chơi|người mới|mới bắt đầu/iu.test(message) ? "beginner"
        : /nâng cao|chuyên nghiệp/iu.test(message) ? "advanced"
          : /trung cấp|trung bình|phong trào/iu.test(message) ? "intermediate" : savedNeeds.skillLevel;
      const advice = adviseTension({ skillLevel: explicitSkill, specs: null });
      sentences.push(explicitSkill
        ? describeTensionAnswer(advice, null)
        : "Mức căng cần dựa vào trình độ, cảm giác đánh và giới hạn hãng của đúng model, biến thể. Anh/chị mới chơi, trình trung bình hay nâng cao?");
      if (advice.heuristic && /kg|ký/iu.test(message)) {
        const factor = loadKnowledge().stringing.units.kgf_to_lbs;
        const round = (value) => Math.round(value / factor * 10) / 10;
        sentences.push(`Khoảng tham khảo này tương đương ${round(advice.heuristic.lowLbf)}-${round(advice.heuristic.highLbf)} kgf, chưa phải mức chốt cho một cây vợt cụ thể.`);
      }
    }
    const draft = sentences.join(" ");
    const polished = await polish({ message, draft, facts: {
      knowledge: educationalKnowledge.snippets.map(({ topic, kind }) => ({ topic, kind })), products: [],
    } });
    return { ...knowledgeResult(savedNeeds, lastQuestion, polished.reply),
      draftReply: draft, replySource: polished.source, replyIssue: polished.reason };
  }
  const outOfScope = describeOutOfScope(message);
  let needs;

  try {
    needs = await extract(message, previousNeeds, lastQuestion);
  } catch (error) {
    // Lỗi từ model không được làm hỏng cuộc trò chuyện của khách.
    console.error("[chatService] Không đọc được nhu cầu:", error);
    const fallback = buildFallback(error, previousNeeds, lastQuestion);
    const reply = [...outOfScope, fallback.reply].join(" ");

    return { ...fallback, reply, draftReply: reply, replySource: "template" };
  }

  const result = await decideReply(needs, { search, findAlternatives, query: message });

  // Lỗi kho kiến thức không được làm hỏng cuộc trò chuyện.
  let knowledge = { topics: [], snippets: [], requestedTensionLbf: null };

  try {
    knowledge = await retrieve(message, needs);
  } catch (error) {
    console.error("[chatService] Không đọc được kho kiến thức:", error);
  }

  const needsChange = describeNeedsChange(previousNeeds ?? createEmptyNeeds(), needs);
  const knowledgeSentences = buildKnowledgeSentences(knowledge, needs, result);
  const stringNames = knowledge.stringModels?.length
    ? knowledge.stringModels
    : knowledge.topics.includes("string_choice")
      ? [...new Set(knowledge.snippets.filter((item) => item.topic === "string_choice")
        .flatMap((item) => findStringModels(item.text)))]
      : [];
  const stringCatalogSentences = await stringCommerceSentences(stringIntent, stringNames, searchStrings);

  // Khách chỉ hỏi kiến thức, nhu cầu không đổi: không liệt kê lại cả danh sách vợt.
  const answeredOnly =
    knowledgeSentences.length > 0 &&
    !needsChange &&
    result.action === "review_candidates";

  // Khách đã trả lời mà hồ sơ không đổi: bot không đọc được câu trả lời. Hỏi lại
  // bằng cách khác, không lặp nguyên văn câu cũ.
  const repeatedQuestion =
    result.action === "ask_followup" &&
    !needsChange &&
    knowledgeSentences.length === 0 &&
    typeof lastQuestion === "string" &&
    (lastQuestion === result.lastQuestion || lastQuestion === result.clarification);

  if (repeatedQuestion) {
    result.reply = `Em chưa hiểu rõ ý anh/chị. ${result.clarification}`;
    result.lastQuestion = result.clarification;
  }

  // Không có gì mới: không liệt kê lại danh sách mẫu như thể khách vừa đổi điều kiện.
  // Khách chủ động xin tư vấn/gợi ý vợt thì là yêu cầu mới, dù hồ sơ nhu cầu không đổi.
  const asksForRecommendation =
    /(?:tư vấn|gợi ý|đề xuất|giới thiệu|chọn giúp|chọn cho)[^.?!]{0,20}vợt|vợt[^.?!]{0,15}(?:nào|gì)\s+(?:hợp|tốt|ổn)/iu
      .test(message);

  const nothingNew =
    !needsChange &&
    !asksForRecommendation &&
    !repeatedQuestion &&
    knowledgeSentences.length === 0 &&
    previousNeeds !== null &&
    (result.action === "review_candidates" ||
      (["suggest_alternatives", "no_reviewed_match"].includes(result.action) &&
        lastQuestion === result.lastQuestion));

  if (nothingNew) {
    result.reply = UNCHANGED_NOTE;
    result.lastQuestion = null;
  }

  // Khách đang hỏi điều khác (kiến thức, hoặc không có gì mới) thì không đưa lại danh sách vợt:
  // tập trung trả lời câu hỏi.
  const showCandidates = !answeredOnly && !nothingNew;

  // Tư vấn vợt: câu có cấu trúc, nhiều dòng, do backend dựng từ thông số thật; không để AI viết lại.
  if (result.structured && showCandidates) {
    const reply = [
      outOfScope.join(" "),
      stringCatalogSentences.join(" "),
      knowledgeSentences.join(" "),
      result.reply,
    ].filter(Boolean).join("\n\n");

    return {
      ...result,
      candidates: sanitizeChatData(result.candidates),
      reply,
      draftReply: reply,
      replySource: "template",
      replyIssue: null,
    };
  }

  const draft = [
    needsChange,
    ...knowledgeSentences,
    answeredOnly ? null : result.reply,
  ]
    .filter(Boolean)
    .join(" ");

  const polished = await polish({
    message,
    draft,
    facts: buildFacts(result, knowledge),
  });

  // Câu trả lời ngoài phạm vi giữ nguyên văn, không để model viết lại hay bỏ sót.
  // Keep live commerce facts outside the writer so prices and stock cannot be rewritten.
  const join = (text) => [...outOfScope, ...stringCatalogSentences, text].join(" ");

  // Vợt đề xuất (kể cả mẫu thay thế) luôn nói rõ giá chưa gồm tiền căng cước.
  const stringingNote =
    showCandidates && needs.productType === "rackets" && result.candidates.length > 0
      ? ` ${NO_STRINGING_NOTICE}.`
      : "";

  return {
    ...result,
    candidates: showCandidates ? sanitizeChatData(result.candidates) : [],
    reply: join(polished.reply) + stringingNote,
    draftReply: join(draft) + stringingNote,
    replySource: polished.source,
    replyIssue: polished.reason,
  };
}

// Mọi câu trả lời được chia đoạn ngắn để dễ đọc; câu đã có cấu trúc nhiều dòng giữ nguyên.
export async function handleRacketMessage(...args) {
  const result = await handleRacketMessageCore(...args);
  return { ...result, reply: formatReplyParagraphs(result.reply) };
}
