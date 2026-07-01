/**
 * 스캐너 — "사용자 전략 조건에 부합하는 종목" 판정 (순수 함수).
 *
 * ⚠️ P1: 시스템이 종목을 "추천"하는 게 아니라, 사용자가 정의한 전략 조건에
 *    현재 부합하는지 계산해 신호(BUY/WATCH)와 그 근거(context)를 제시할 뿐이다.
 *    matchScore/근거는 어떤 계산에서 나왔는지 투명하게 반환한다(P4).
 *
 * look-ahead 없음: 마지막 봉 시점까지의 데이터만 사용.
 */
import type { Candle, StrategyDSL } from "./types";
import { findReferenceCandle } from "./referenceCandle";
import { assessPullback } from "./pullback";
import { smaSeries, linregSlope } from "./indicators";

export type ScanSignal = "BUY" | "WATCH" | "NONE";

export type ScanContext = {
  refCandleDate: string | null;
  /** |현재가-몸통중앙|/몸통중앙 */
  bodyMidDistance: number | null;
  /** |현재가-MA|/MA (nearMA 설정 시) */
  maDistance: number | null;
  volumeHealthy: boolean | null;
  pullbackHit: boolean;
  slopeOk: boolean;
};

export type ScanResult = {
  signal: ScanSignal;
  /** 0~1, 진입 조건 근접도(휴리스틱, 근거는 context 참조). */
  matchScore: number;
  price: number;
  /** 전일 종가 대비 등락률 */
  changePct: number;
  volume: number;
  context: ScanContext;
};

/**
 * 한 종목의 최신 시점이 전략 조건에 부합하는지 평가.
 * - 기준 캔들이 없으면 NONE.
 * - 기준 캔들 이후 진입 조건(눌림+거래량+기울기) 모두 충족 → BUY.
 * - 기준 캔들은 있으나 진입 미충족 → WATCH(관찰).
 */
export function scanSymbol(
  candles: readonly Candle[],
  dsl: StrategyDSL,
): ScanResult {
  const n = candles.length;
  const last = candles[n - 1];
  const prev = candles[n - 2];
  const price = last?.close ?? 0;
  const volume = last?.volume ?? 0;
  const changePct =
    last && prev && prev.close !== 0 ? (last.close - prev.close) / prev.close : 0;

  const empty: ScanResult = {
    signal: "NONE",
    matchScore: 0,
    price,
    changePct,
    volume,
    context: {
      refCandleDate: null,
      bodyMidDistance: null,
      maDistance: null,
      volumeHealthy: null,
      pullbackHit: false,
      slopeOk: false,
    },
  };
  if (n < 2 || !last) return empty;

  const ref = findReferenceCandle(candles, {
    highGainFromOpen: dsl.referenceCandle.highGainFromOpen,
    closeNearHighPct: dsl.referenceCandle.closeNearHighPct,
    volMultVsPrev: dsl.referenceCandle.volMultVsPrev,
    lookbackDays: dsl.referenceCandle.lookbackDays,
  });
  if (!ref || ref.index >= n - 1) return empty;

  const pb = dsl.entry.pullback;
  const assess = assessPullback(candles, ref, {
    bodyMidTolerance: pb.toBodyMid?.tolerance,
    openTolerance: pb.toOpen?.tolerance,
    nearMA: pb.nearMA,
    volumeDecayRatio: dsl.entry.volumeHealth?.decayRatio,
  });

  const pullbackHit = assess.nearBodyMid === true || assess.nearOpen === true;
  const volOk = assess.volumeHealthy !== false;

  let slopeOk = true;
  if (dsl.entry.maSlope) {
    const closes = candles.map((c) => c.close);
    const maSer = smaSeries(closes, dsl.entry.maSlope.period).filter(
      (v): v is number => v !== null,
    );
    const slope = linregSlope(maSer, Math.min(maSer.length, 5));
    slopeOk = slope !== null && slope >= dsl.entry.maSlope.minSlope;
  }

  const context: ScanContext = {
    refCandleDate: ref.date,
    bodyMidDistance: assess.bodyMidDistance,
    maDistance: assess.maDistance,
    volumeHealthy: assess.volumeHealthy,
    pullbackHit,
    slopeOk,
  };

  const entryMet = pullbackHit && volOk && slopeOk;

  // matchScore: 몸통중앙 근접도 기반 휴리스틱(투명성: context.bodyMidDistance 참조).
  const tol = pb.toBodyMid?.tolerance ?? 0.03;
  const proximity = Math.max(0, 1 - assess.bodyMidDistance / (tol * 4));

  if (entryMet) {
    return { signal: "BUY", matchScore: 0.7 + 0.3 * proximity, price, changePct, volume, context };
  }
  return { signal: "WATCH", matchScore: 0.3 + 0.4 * proximity, price, changePct, volume, context };
}
