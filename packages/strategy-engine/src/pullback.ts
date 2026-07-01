/**
 * 눌림목(Pullback) 정량화 — 기준 캔들 이후. docs/04 §4.2.
 * 순수 함수. 현재가/이평/거래량 근거를 투명하게 반환(P4).
 */
import type { Candle, ReferenceCandle } from "./types";
import { sma, mean } from "./indicators";

export type PullbackParams = {
  /** 몸통 절반 근접 허용오차 (|price-bodyMid|/bodyMid ≤ tol) */
  bodyMidTolerance?: number;
  /** 시가 부근 근접 허용오차 (|price-open|/open ≤ tol) */
  openTolerance?: number;
  /** 이평 근접: period와 pct (|price-ma|/ma ≤ pct) */
  nearMA?: { period: number; pct: number };
  /** 거래량 건강도: 조정구간 평균 / 상승구간 평균 ≤ ratio */
  volumeDecayRatio?: number;
};

/** 눌림 근거 스냅샷 — 차트 오버레이/설명용(P4 투명성, docs/05 scanMatches.context). */
export type PullbackAssessment = {
  price: number;
  bodyMid: number;
  /** |price-bodyMid|/bodyMid */
  bodyMidDistance: number;
  nearBodyMid: boolean | null;
  /** |price-open|/open */
  openDistance: number;
  nearOpen: boolean | null;
  ma: number | null;
  /** |price-ma|/ma */
  maDistance: number | null;
  nearMA: boolean | null;
  /** 조정/상승 거래량 비율 */
  volRatio: number | null;
  volumeHealthy: boolean | null;
};

function pct(a: number, b: number): number {
  return b === 0 ? NaN : Math.abs(a - b) / Math.abs(b);
}

/**
 * 기준 캔들 이후 캔들들과 현재가로 눌림 상태를 평가한다.
 * @param candles 전체 시계열(과거→현재)
 * @param ref 기준 캔들
 * @param params 파라미터(전략 DSL entry.pullback)
 */
export function assessPullback(
  candles: readonly Candle[],
  ref: ReferenceCandle,
  params: PullbackParams,
): PullbackAssessment {
  const last = candles[candles.length - 1]!;
  const price = last.close;

  const bodyMidDistance = pct(price, ref.bodyMid);
  const openDistance = pct(price, ref.open);

  // 이평 근접
  let ma: number | null = null;
  let maDistance: number | null = null;
  let nearMA: boolean | null = null;
  if (params.nearMA) {
    const closes = candles.map((c) => c.close);
    ma = sma(closes, params.nearMA.period);
    if (ma !== null && ma !== 0) {
      maDistance = Math.abs(price - ma) / ma;
      nearMA = maDistance <= params.nearMA.pct;
    }
  }

  // 거래량 건강도: 기준 캔들 이후 = 상승구간 시작. 조정구간(최근 절반) vs 상승구간(앞 절반).
  let volRatio: number | null = null;
  let volumeHealthy: boolean | null = null;
  if (params.volumeDecayRatio !== undefined) {
    const after = candles.slice(ref.index + 1).map((c) => c.volume);
    if (after.length >= 2) {
      const mid = Math.floor(after.length / 2);
      const riseVol = mean(after.slice(0, mid));
      const pullbackVol = mean(after.slice(mid));
      if (riseVol > 0) {
        volRatio = pullbackVol / riseVol;
        volumeHealthy = volRatio <= params.volumeDecayRatio;
      }
    }
  }

  return {
    price,
    bodyMid: ref.bodyMid,
    bodyMidDistance,
    nearBodyMid:
      params.bodyMidTolerance === undefined
        ? null
        : bodyMidDistance <= params.bodyMidTolerance,
    openDistance,
    nearOpen:
      params.openTolerance === undefined
        ? null
        : openDistance <= params.openTolerance,
    ma,
    maDistance,
    nearMA,
    volRatio,
    volumeHealthy,
  };
}
