/**
 * 기준 캔들(장대양봉) 인식 — docs/04 §4.2.
 * 세 조건을 모두 만족하는 봉을 기준 캔들로 승격한다.
 * 순수 함수. look-ahead 없음(각 봉은 자신+직전 봉만 참조).
 */
import type { Candle, ReferenceCandle } from "./types";

export type ReferenceCandleParams = {
  /** (high-open)/open ≥ 이 값 (예: 0.20) */
  highGainFromOpen: number;
  /** (high-close)/high ≤ 이 값 (예: 0.05) */
  closeNearHighPct: number;
  /** volume ≥ prevVolume * 이 값 (예: 5.0) */
  volMultVsPrev: number;
  /** 최근 이 거래일 이내에서만 탐색 (예: 20) */
  lookbackDays: number;
};

/** 단일 봉이 기준 캔들 조건을 만족하는지 (직전 봉 대비 거래량 포함). */
export function isReferenceCandle(
  candle: Candle,
  prev: Candle | undefined,
  params: ReferenceCandleParams,
): boolean {
  if (!prev) return false;
  if (candle.open <= 0 || candle.high <= 0) return false;

  const highGain = (candle.high - candle.open) / candle.open;
  const closeNearHigh = (candle.high - candle.close) / candle.high;
  const volOk = candle.volume >= prev.volume * params.volMultVsPrev;

  return (
    highGain >= params.highGainFromOpen &&
    closeNearHigh <= params.closeNearHighPct &&
    volOk
  );
}

function toReference(candle: Candle, index: number): ReferenceCandle {
  return {
    index,
    date: candle.date,
    open: candle.open,
    high: candle.high,
    low: candle.low,
    close: candle.close,
    volume: candle.volume,
    bodyMid: (candle.open + candle.close) / 2,
  };
}

/**
 * lookbackDays 이내에서 **가장 최근** 기준 캔들을 찾는다. 없으면 null.
 * candles는 과거→현재 정렬 가정.
 */
export function findReferenceCandle(
  candles: readonly Candle[],
  params: ReferenceCandleParams,
): ReferenceCandle | null {
  const n = candles.length;
  const start = Math.max(1, n - params.lookbackDays);
  for (let i = n - 1; i >= start; i--) {
    if (isReferenceCandle(candles[i]!, candles[i - 1], params)) {
      return toReference(candles[i]!, i);
    }
  }
  return null;
}
