
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function callAI({
  messages,
  schema,
  temperature = 0,
  maxTokens = 512,
  timeoutMs = 60000,
  // "extract" (đọc nhu cầu) hoặc "write" (viết câu trả lời): mỗi việc có thể dùng
  // model riêng, vì Groq tính giới hạn token theo từng model.
  role = null,
  fetchImpl = fetch,
  env = process.env,
}) {
  const provider = (env.AI_PROVIDER || "ollama").toLowerCase();

  if (!["groq", "ollama"].includes(provider)) {
    throw new Error(`AI provider không hợp lệ: ${provider}`);
  }

  const isGroq = provider === "groq";

  if (isGroq && !env.GROQ_API_KEY) {
    throw new Error("Thiếu GROQ_API_KEY trong .env");
  }

  const baseUrl = (env.OLLAMA_BASE_URL || "http://localhost:11434")
    .replace(/\/+$/, "");

  const url = isGroq
    ? GROQ_URL
    : `${baseUrl}/api/chat`;

  const roleKey = role ? role.toUpperCase() : null;

  const model = isGroq
    ? (roleKey && env[`GROQ_${roleKey}_MODEL`]) ||
      env.GROQ_MODEL ||
      "qwen/qwen3.8-27b"
    : (roleKey && env[`OLLAMA_${roleKey}_MODEL`]) ||
      env.OLLAMA_MODEL ||
      "qwen2.5:3b";

  // Model suy luận của OpenAI (gpt-oss) dùng tham số khác Qwen.
  const reasoning = model.startsWith("openai/gpt-oss")
    ? { reasoning_effort: "low", include_reasoning: false }
    : { reasoning_effort: "none", reasoning_format: "hidden" };

  const body = isGroq
    ? {
        model,
        messages,
        stream: false,
        temperature,
        max_completion_tokens: maxTokens,
        ...reasoning,
        ...(schema
          ? { response_format: { type: "json_object" } }
          : {}),
      }
    : {
        model,
        messages,
        stream: false,
        think: false,
        ...(schema ? { format: schema } : {}),
        options: {
          temperature,
          num_ctx: 2048,
          num_predict: maxTokens,
        },
      };

  const sendOnce = () =>
    fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(isGroq
          ? { Authorization: `Bearer ${env.GROQ_API_KEY}` }
          : {}),
      },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify(body),
    });

  // Lỗi mạng thoáng qua ("fetch failed") được thử lại tối đa 2 lần; hết thời gian
  // chờ thì không thử lại. Nếu không, câu trả lời của khách bị mất và bot hỏi lại.
  const send = async () => {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await sendOnce();
      } catch (error) {
        const timedOut =
          error?.name === "TimeoutError" || error?.name === "AbortError";

        if (timedOut || attempt >= 2) {
          const code = error?.cause?.code ?? error?.cause?.message;
          throw new Error(
            `${provider} lỗi kết nối: ${error?.message}${code ? ` (${code})` : ""}`,
            { cause: error },
          );
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 250 * (attempt + 1)),
        );
      }
    }
  };

  let response = await send();

  // Groq free tier giới hạn token/phút: chờ rồi thử lại tối đa 2 lần.
  for (let retry = 0; retry < 2 && response.status === 429; retry += 1) {
    const text = await response.text();
    const header = Number(response.headers?.get?.("retry-after"));
    const hint = Number(text.match(/try again in ([\d.]+)s/i)?.[1]);
    const waitSeconds = Number.isFinite(header) && header > 0 ? header : hint;

    if (!Number.isFinite(waitSeconds) || waitSeconds > 10) {
      throw new Error(`${provider} HTTP 429: ${text.slice(0, 500)}`);
    }

    await new Promise((resolve) =>
      setTimeout(resolve, Math.ceil(waitSeconds * 1000) + 300),
    );
    response = await send();
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `${provider} HTTP ${response.status}: ${errorText.slice(0, 500)}`
    );
  }

  const data = await response.json();

  const content = isGroq
    ? data.choices?.[0]?.message?.content
    : data.message?.content;

  if (typeof content !== "string" || !content.trim()) {
    throw new Error(`${provider} không trả nội dung hợp lệ`);
  }

  return {
    message: { content },
    provider,
    model,
  };
}
