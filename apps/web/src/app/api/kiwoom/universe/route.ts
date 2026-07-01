import { NextResponse } from "next/server";
import { getUniverse, type MarketKey } from "@/lib/kiwoom/universe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 종목 유니버스 조회.
 * GET /api/kiwoom/universe?market=kospi|kosdaq&q=검색어&limit=50
 * 목록만 반환(가벼움). 실제 스캔은 /api/kiwoom/scan에서 상한 하에 수행.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const marketRaw = searchParams.get("market") ?? "kospi";
  const market: MarketKey = marketRaw === "kosdaq" ? "kosdaq" : "kospi";
  const q = (searchParams.get("q") ?? "").trim();
  const limitRaw = Number(searchParams.get("limit") ?? "50");
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 200) : 50;

  const res = await getUniverse(market);
  if (!res.ok) {
    const status = res.reason === "not_configured" ? 400 : 502;
    return NextResponse.json({ error: res.reason, message: res.message }, { status });
  }

  let stocks = res.stocks;
  if (q) {
    const needle = q.toLowerCase();
    stocks = stocks.filter(
      (s) => s.name.toLowerCase().includes(needle) || s.code.includes(needle),
    );
  }

  return NextResponse.json({
    market,
    total: stocks.length,
    stocks: stocks.slice(0, limit),
  });
}
