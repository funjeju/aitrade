import { NextResponse } from "next/server";
import { getDailyCandles } from "@/lib/kiwoom/marketData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 키움 일봉 조회. GET /api/kiwoom/candles?code=005930&count=250
 * 시세 읽기 전용(주문 아님, P1). 앱키/시크릿은 서버에만.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = (searchParams.get("code") ?? "").replace(/\D/g, "");
  const countRaw = Number(searchParams.get("count") ?? "250");
  const count = Number.isFinite(countRaw) ? Math.min(Math.max(countRaw, 30), 600) : 250;

  if (code.length !== 6) {
    return NextResponse.json(
      { error: "bad_code", message: "종목코드 6자리를 입력하세요." },
      { status: 400 },
    );
  }

  const res = await getDailyCandles(code, { count });
  if (!res.ok) {
    const status = res.reason === "not_configured" ? 400 : 502;
    return NextResponse.json({ error: res.reason, message: res.message }, { status });
  }

  return NextResponse.json({ code, count: res.candles.length, candles: res.candles });
}
