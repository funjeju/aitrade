import { NextResponse } from "next/server";
import { scanSymbol, validateStrategyDSL, type ScanResult } from "@ats/strategy-engine";
import { getDailyCandles } from "@/lib/kiwoom/marketData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * 스캐너: 종목 리스트를 사용자 전략(DSL)으로 평가.
 * POST { codes: string[], dsl }.
 *
 * ⚠️ P1: 종목 추천이 아니라 "사용자 전략 조건 부합 여부" 계산. 시세 읽기 전용(주문 아님).
 * 원가: 종목 수만큼 일봉 호출 → codes를 20개로 제한(호출량·rate limit).
 */

const MAX_CODES = 20;
const CANDLE_COUNT = 120; // 스캔에 필요한 최근 봉 수(lookback 여유)

type ScanRow = ScanResult & { code: string };

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { codes?: unknown; dsl?: unknown }
    | null;

  const codes = Array.isArray(body?.codes)
    ? body.codes
        .map((c) => String(c).replace(/\D/g, ""))
        .filter((c) => c.length === 6)
        .slice(0, MAX_CODES)
    : [];

  if (codes.length === 0) {
    return NextResponse.json(
      { error: "no_codes", message: "종목코드(6자리)를 1개 이상 입력하세요." },
      { status: 400 },
    );
  }

  const v = validateStrategyDSL(body?.dsl);
  if (!v.ok) {
    return NextResponse.json(
      { error: "bad_dsl", message: "전략 규칙이 유효하지 않습니다.", issues: v.issues },
      { status: 400 },
    );
  }

  const matches: ScanRow[] = [];
  const errors: Array<{ code: string; message: string }> = [];

  // 순차 호출(rate limit 보호). 종목당 실패는 건너뛰고 계속.
  for (const code of codes) {
    const res = await getDailyCandles(code, { count: CANDLE_COUNT });
    if (!res.ok) {
      errors.push({ code, message: res.message });
      continue;
    }
    const scan = scanSymbol(res.candles, v.dsl);
    matches.push({ code, ...scan });
  }

  // 신호 있는 것 우선, matchScore 내림차순.
  matches.sort((a, b) => b.matchScore - a.matchScore);

  return NextResponse.json({
    scannedAt: new Date().toISOString(),
    total: matches.length,
    matches,
    errors,
  });
}
