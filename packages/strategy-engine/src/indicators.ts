/**
 * 지표 정량화 — 순수 함수만. (candles/values, params) → number|boolean.
 * 매직넘버 하드코딩 금지: 임계값은 전부 파라미터로 받는다(docs/04 §4.1, P4).
 *
 * look-ahead 방지: 모든 함수는 "주어진 배열의 마지막 원소까지"만 사용한다.
 * 호출자가 t 시점까지의 슬라이스를 넘길 책임이 있고, 여기서는 미래를 참조하지 않는다.
 */

/** 단순 평균. 빈 배열은 NaN. */
export function mean(values: readonly number[]): number {
  if (values.length === 0) return NaN;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** period 길이의 마지막 SMA. 데이터 부족 시 null. */
export function sma(values: readonly number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  return mean(values.slice(values.length - period));
}

/** 전체 구간의 SMA 시리즈(각 인덱스는 그 시점까지의 SMA, 앞쪽 부족분은 null). */
export function smaSeries(
  values: readonly number[],
  period: number,
): Array<number | null> {
  return values.map((_, i) =>
    i + 1 >= period ? mean(values.slice(i + 1 - period, i + 1)) : null,
  );
}

/** 마지막 EMA. 데이터 부족 시 null. seed는 첫 period의 SMA. */
export function ema(values: readonly number[], period: number): number | null {
  if (period <= 0 || values.length < period) return null;
  const k = 2 / (period + 1);
  let prev = mean(values.slice(0, period));
  for (let i = period; i < values.length; i++) {
    prev = values[i]! * k + prev * (1 - k);
  }
  return prev;
}

/**
 * 최근 window개 값에 대한 선형회귀 기울기(x=0..n-1).
 * 이평선 우상향 판정에 사용(docs/04 §4.2 감각지표). 데이터 부족 시 null.
 */
export function linregSlope(
  values: readonly number[],
  window: number,
): number | null {
  if (window <= 1 || values.length < window) return null;
  const ys = values.slice(values.length - window);
  const n = ys.length;
  const xMean = (n - 1) / 2;
  const yMean = mean(ys);
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    const dx = i - xMean;
    num += dx * (ys[i]! - yMean);
    den += dx * dx;
  }
  return den === 0 ? null : num / den;
}

/**
 * 거래량 자연 감소 비율: 최근 k봉 평균 / 직전 m봉 평균.
 * 값 ≤ decayRatio 이면 "건강한 감소"(docs/04 §4.2). 데이터 부족 시 null.
 */
export function volumeDecayRatio(
  volumes: readonly number[],
  recentK: number,
  priorM: number,
): number | null {
  if (volumes.length < recentK + priorM) return null;
  const n = volumes.length;
  const recent = volumes.slice(n - recentK);
  const prior = volumes.slice(n - recentK - priorM, n - recentK);
  const priorMean = mean(prior);
  if (priorMean === 0) return null;
  return mean(recent) / priorMean;
}

/** 양봉 몸통 크기 비율 (close-open)/open. */
export function bodySize(open: number, close: number): number {
  return open === 0 ? NaN : (close - open) / open;
}

/** 종가 위치 (close-low)/(high-low). 1에 가까울수록 고가 마감. */
export function closePosition(
  high: number,
  low: number,
  close: number,
): number {
  const range = high - low;
  return range === 0 ? 1 : (close - low) / range;
}

/** 윗꼬리 비율 (high-max(open,close))/(high-low). */
export function upperWickRatio(
  open: number,
  high: number,
  low: number,
  close: number,
): number {
  const range = high - low;
  return range === 0 ? 0 : (high - Math.max(open, close)) / range;
}
