import "server-only";
import { getKiwoomConfig } from "./config";
import { getAccessToken } from "./token";

/**
 * 키움 종목정보 리스트 (ka10099, 서버 전용).
 * POST /api/dostk/stkinfo, body { mrkt_tp: "0"(코스피) | "10"(코스닥) }.
 * 응답 배열 `list`: { code, name, upName(업종), upSizeName(규모), auditInfo, state, lastPrice, ... }
 *
 * 원가: 종목 스캔은 일봉 호출이 종목수만큼 발생하므로 스캔은 상한을 둔다.
 * 이 목록 조회 자체는 시장당 1회(가벼움) + 서버 메모리 캐시(TTL).
 */

export type MarketKey = "kospi" | "kosdaq";

const MRKT_TP: Record<MarketKey, string> = { kospi: "0", kosdaq: "10" };

export type StockInfo = {
  code: string;
  name: string;
  sector: string; // 업종
  size: string; // 대형주/중형주/소형주
  market: MarketKey;
};

export type UniverseResult =
  | { ok: true; stocks: StockInfo[] }
  | { ok: false; reason: string; message: string };

type RawRow = {
  code?: string;
  name?: string;
  upName?: string;
  upSizeName?: string;
  auditInfo?: string;
  state?: string;
};

// 서버 인스턴스 메모리 캐시 (30분 TTL).
const CACHE_TTL = 30 * 60 * 1000;
const cache = new Map<MarketKey, { at: number; stocks: StockInfo[] }>();

export async function getUniverse(market: MarketKey): Promise<UniverseResult> {
  const cached = cache.get(market);
  if (cached && Date.now() - cached.at < CACHE_TTL) {
    return { ok: true, stocks: cached.stocks };
  }

  const config = getKiwoomConfig();
  if (!config) return { ok: false, reason: "not_configured", message: "키움 앱키 미설정." };
  const tokenRes = await getAccessToken();
  if (!tokenRes.ok) return { ok: false, reason: "auth", message: tokenRes.message };

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/api/dostk/stkinfo`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        authorization: `Bearer ${tokenRes.token.token}`,
        "api-id": "ka10099",
      },
      body: JSON.stringify({ mrkt_tp: MRKT_TP[market] }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: "network", message: e instanceof Error ? e.message : "network" };
  }
  if (!res.ok) return { ok: false, reason: "http_error", message: `HTTP ${res.status}` };

  const data = (await res.json().catch(() => ({}))) as {
    return_code?: number;
    return_msg?: string;
    list?: RawRow[];
  };
  if (data.return_code !== 0) {
    return { ok: false, reason: "api_error", message: data.return_msg || "조회 실패" };
  }

  const stocks: StockInfo[] = (data.list ?? [])
    .filter((r) => {
      const code = (r.code ?? "").trim();
      // 6자리 보통주만, 관리·정지 종목 제외.
      if (!/^\d{6}$/.test(code)) return false;
      if (r.auditInfo && r.auditInfo !== "정상") return false;
      if (r.state && /정지|거래정지/.test(r.state)) return false;
      return true;
    })
    .map((r) => ({
      code: r.code!.trim(),
      name: (r.name ?? "").trim(),
      sector: (r.upName ?? "").trim(),
      size: (r.upSizeName ?? "").trim(),
      market,
    }));

  cache.set(market, { at: Date.now(), stocks });
  return { ok: true, stocks };
}
