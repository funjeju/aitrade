import "server-only";

/**
 * 경량 OpenAI Chat Completions 클라이언트 (SDK 의존 없이 fetch).
 * 키/모델은 env에서만 읽는다(브라우저 노출 금지).
 */

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export function isLlmConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export type LlmResult =
  | { ok: true; content: string }
  | { ok: false; reason: "not_configured" | "http_error" | "network"; message: string };

/**
 * JSON 응답을 강제(response_format json_object)해서 구조화된 결과를 받는다.
 */
export async function chatJson(
  messages: ChatMessage[],
  opts?: { model?: string; temperature?: number },
): Promise<LlmResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { ok: false, reason: "not_configured", message: "OPENAI_API_KEY가 설정되지 않았습니다." };
  }
  const model = opts?.model ?? process.env.LLM_MODEL_GENERATE ?? "gpt-4o-mini";

  let res: Response;
  try {
    res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: opts?.temperature ?? 0.2,
        response_format: { type: "json_object" },
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: "network", message: e instanceof Error ? e.message : "network error" };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, reason: "http_error", message: `HTTP ${res.status} ${text.slice(0, 300)}` };
  }

  const data = (await res.json().catch(() => null)) as
    | { choices?: Array<{ message?: { content?: string } }> }
    | null;
  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    return { ok: false, reason: "http_error", message: "빈 응답" };
  }
  return { ok: true, content };
}
