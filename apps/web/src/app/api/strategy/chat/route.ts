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

/** 문자열/퍼센트를 숫자·소수로 보정. ratio01=true면 1 초과값은 퍼센트로 보고 /100. */
function num(v: unknown, ratio01: boolean, fallback: number): number {
  let n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  if (ratio01 && n > 1) n = n / 100; // 20 → 0.20, 5 → 0.05
  return n;
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
}

/**
 * 모델이 낸 DSL을 검증 통과 가능하게 보정한다.
 * - 누락 필수 필드는 기본값으로 채운다(사용자는 초안에서 고칠 수 있음).
 * - 비율 필드의 퍼센트/문자열 실수를 소수로 정규화한다.
 * 이렇게 해서 "draft가 자꾸 ask로 되돌아가는" 문제를 없앤다.
 */
function normalizeChatDsl(input: unknown): Record<string, unknown> {
  const d = obj(input);
  const rc = obj(d.referenceCandle);
  const entry = obj(d.entry);
  const pb = obj(entry.pullback);
  const exit = obj(d.exit);
  const stop = obj(exit.stop);

  const bodyMid = obj(pb.toBodyMid);
  const toOpen = pb.toOpen != null ? obj(pb.toOpen) : null;
  const nearMA = pb.nearMA != null ? obj(pb.nearMA) : { period: 10, pct: 0.03 };
  const volHealth = entry.volumeHealth != null ? obj(entry.volumeHealth) : { decayRatio: 0.6 };
  const maSlope = entry.maSlope != null ? obj(entry.maSlope) : { period: 20, minSlope: 0 };

  return {
    universe: { market: obj(d.universe).market === "US" ? "US" : "KR" },
    leader: d.leader ?? { rankBy: ["relStrength", "volSurge"], topN: 3 },
    referenceCandle: {
      highGainFromOpen: num(rc.highGainFromOpen, true, 0.2),
      closeNearHighPct: num(rc.closeNearHighPct, true, 0.05),
      volMultVsPrev: num(rc.volMultVsPrev, false, 5),
      lookbackDays: num(rc.lookbackDays, false, 10),
    },
    entry: {
      pullback: {
        toBodyMid: { tolerance: num(bodyMid.tolerance, true, 0.02) },
        ...(toOpen ? { toOpen: { tolerance: num(toOpen.tolerance, true, 0.02) } } : {}),
        nearMA: { period: num(nearMA.period, false, 10), pct: num(nearMA.pct, true, 0.03) },
      },
      volumeHealth: { decayRatio: num(volHealth.decayRatio, true, 0.6) },
      maSlope: { period: num(maSlope.period, false, 20), minSlope: num(maSlope.minSlope, false, 0) },
      splits: Array.isArray(entry.splits) && entry.splits.length > 0
        ? entry.splits
        : [{ at: "bodyMid", weight: 0.5 }, { at: "open", weight: 0.5 }],
    },
    exit: {
      trailing: exit.trailing ?? { type: "atr", mult: 2 },
      maExit: exit.maExit ?? { period: 5 },
      stop: {
        basis: (stop.basis as string) ?? "refCandleLow",
        buffer: num(stop.buffer, true, 0),
      },
    },
  };
}

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

  // draft면 보정(기본값 채움 + 퍼센트/문자열 정규화) 후 검증한다.
  // 보정 덕분에 거의 항상 통과 → "draft가 ask로 되돌아가는" 문제 없음(P4).
  if (result.mode === "draft" && result.dsl) {
    const normalized = normalizeChatDsl(result.dsl);
    const v = validateStrategyDSL(normalized);
    if (v.ok) {
      result.dsl = normalized;
    } else {
      // 극히 예외: 보정 후에도 실패하면 그때만 되묻는다.
      result.mode = "ask";
      result.dsl = null;
      result.reply = result.reply || "전략을 확정하려면 아래 항목이 더 필요합니다.";
      result.questions = v.issues.map((i) => `${i.path}: ${i.message}`);
    }
  }

  return NextResponse.json(result);
}
