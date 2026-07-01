import "server-only";
import type { Candle } from "@ats/strategy-engine";
import { getKiwoomConfig } from "./config";
import { getAccessToken } from "./token";

/**
 * 키움 REST 주식 일봉 조회 (ka10081, 서버 전용).
 *
 * 실제 응답(확인됨):
 *  { stk_dt_pole_chart_qry: [ { dt:"YYYYMMDD", open_pric, high_pric, low_pric,
 *    cur_prc(종가), trde_qty(거래량), ... } ], return_code, return_msg }
 *  - 값은 문자열, 최신일자 → 과거 순으로 내려온다. 엔진은 과거→현재 정렬을 요구하므로 뒤집는다.
 *
 * ⚠️ 시세 조회(읽기)만. 주문 아님(P1).
 */

type ChartRow = {
  dt?: string;
  open_pric?: string;
  high_pric?: string;
  low_pric?: string;
  cur_prc?: string;
  trde_qty?: string;
};

export type CandlesResult =
  | { ok: true; candles: Candle[] }
  | {
      ok: false;
      reason: "not_configured" | "auth" | "http_error" | "api_error" | "network";
      message: string;
    };

/** "YYYYMMDD" → "YYYY-MM-DD" */
function fmtDate(dt: string): string {
  if (dt.length !== 8) return dt;
  return `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
}

/** 부호·콤마 섞인 문자열을 양수 숫자로. */
function num(v: string | undefined): number {
  if (!v) return 0;
  return Math.abs(Number(v.replace(/[+,\s]/g, "")));
}

function todayKST(): string {
  const now = new Date(Date.now() + 9 * 3600 * 1000);
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * 일봉을 과거→현재 순 Candle[]로 반환. count로 최근 N봉만 자른다.
 * @param stkCd 종목코드 6자리 (예: "005930")
 */
export async function getDailyCandles(
  stkCd: string,
  opts?: { baseDt?: string; count?: number; adjusted?: boolean },
): Promise<CandlesResult> {
  const config = getKiwoomConfig();
  if (!config) {
    return { ok: false, reason: "not_configured", message: "키움 앱키/시크릿 미설정." };
  }
  const tokenRes = await getAccessToken();
  if (!tokenRes.ok) {
    return { ok: false, reason: "auth", message: tokenRes.message };
  }

  const baseDt = opts?.baseDt ?? todayKST();
  const adjusted = opts?.adjusted ?? true;

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/api/dostk/chart`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=UTF-8",
        authorization: `Bearer ${tokenRes.token.token}`,
        "api-id": "ka10081",
      },
      body: JSON.stringify({
        stk_cd: stkCd,
        base_dt: baseDt,
        upd_stkpc_tp: adjusted ? "1" : "0",
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: "network", message: e instanceof Error ? e.message : "network" };
  }

  if (!res.ok) {
    return { ok: false, reason: "http_error", message: `HTTP ${res.status}` };
  }

  const data = (await res.json().catch(() => ({}))) as {
    return_code?: number;
    return_msg?: string;
    stk_dt_pole_chart_qry?: ChartRow[];
  };

  if (data.return_code !== 0) {
    return { ok: false, reason: "api_error", message: data.return_msg || "조회 실패" };
  }

  const rows = data.stk_dt_pole_chart_qry ?? [];
  const candles: Candle[] = rows
    .map((r) => ({
      date: fmtDate(r.dt ?? ""),
      open: num(r.open_pric),
      high: num(r.high_pric),
      low: num(r.low_pric),
      close: num(r.cur_prc),
      volume: num(r.trde_qty),
    }))
    .filter((c) => c.date && c.close > 0)
    .reverse(); // 최신→과거 를 과거→현재 로

  const count = opts?.count;
  const sliced = count && count > 0 ? candles.slice(-count) : candles;
  return { ok: true, candles: sliced };
}
