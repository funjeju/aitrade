import { NextResponse } from "next/server";
import { validateStrategyDSL } from "@ats/strategy-engine";
import { chatJson, isLlmConfigured, type ChatMessage } from "@/lib/llm/openai";
import { STRATEGY_CHAT_SYSTEM } from "@/lib/strategy/chatPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * AI 전략 대화 — 자연어를 Strategy DSL로 변환(strategy-dsl 스킬).
 * 응답은 { mode, reply, questions, dsl, transparency }.
 * DSL이 나오면 서버에서 스키마 검증까지 하고, 실패하면 ask 모드로 되돌린다(P4).
 */

type Turn = { role: "user" | "assistant"; content: string };

type ChatReply = {
  mode: "ask" | "draft";
  reply: string;
  questions: string[];
  dsl: unknown | null;
  transparency: Array<{ param: string; formula: string }>;
};

export async function POST(request: Request) {
  if (!isLlmConfigured()) {
    return NextResponse.json(
      { error: "not_configured", message: "OPENAI_API_KEY가 설정되지 않았습니다." },
      { status: 400 },
    );
  }

  const body = (await request.json().catch(() => null)) as { turns?: Turn[] } | null;
  const turns = body?.turns ?? [];
  if (turns.length === 0) {
    return NextResponse.json({ error: "empty", message: "메시지가 없습니다." }, { status: 400 });
  }

  const messages: ChatMessage[] = [
    { role: "system", content: STRATEGY_CHAT_SYSTEM },
    ...turns.map((t) => ({ role: t.role, content: t.content })),
  ];

  const llm = await chatJson(messages, { model: process.env.LLM_MODEL_GENERATE });
  if (!llm.ok) {
    return NextResponse.json({ error: llm.reason, message: llm.message }, { status: 502 });
  }

  let parsed: Partial<ChatReply>;
  try {
    parsed = JSON.parse(llm.content) as Partial<ChatReply>;
  } catch {
    return NextResponse.json(
      { error: "bad_json", message: "AI 응답을 파싱하지 못했습니다." },
      { status: 502 },
    );
  }

  const result: ChatReply = {
    mode: parsed.mode === "draft" ? "draft" : "ask",
    reply: typeof parsed.reply === "string" ? parsed.reply : "",
    questions: Array.isArray(parsed.questions) ? parsed.questions.map(String) : [],
    dsl: parsed.dsl ?? null,
    transparency: Array.isArray(parsed.transparency) ? parsed.transparency : [],
  };

  // draft면 서버에서 DSL 스키마 검증(P4). 실패 시 ask로 강등하고 이유를 questions에 담는다.
  if (result.mode === "draft" && result.dsl) {
    const v = validateStrategyDSL(result.dsl);
    if (!v.ok) {
      result.mode = "ask";
      result.dsl = null;
      result.reply = result.reply || "전략을 확정하려면 아래 항목이 더 필요합니다.";
      result.questions = v.issues.map((i) => `${i.path}: ${i.message}`);
    }
  }

  return NextResponse.json(result);
}
