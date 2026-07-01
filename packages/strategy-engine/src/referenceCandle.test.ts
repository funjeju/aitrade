import { describe, expect, it } from "vitest";
import { findReferenceCandle, isReferenceCandle } from "./referenceCandle";
import type { Candle } from "./types";

const params = {
  highGainFromOpen: 0.2,
  closeNearHighPct: 0.05,
  volMultVsPrev: 5,
  lookbackDays: 20,
};

function c(
  date: string,
  open: number,
  high: number,
  low: number,
  close: number,
  volume: number,
): Candle {
  return { date, open, high, low, close, volume };
}

describe("referenceCandle", () => {
  it("세 조건 모두 만족하면 기준 캔들", () => {
    const prev = c("d1", 100, 101, 99, 100, 1000);
    // open=100 high=125(+25%) close=124((125-124)/125=0.008≤5%) vol=6000(=6x)
    const big = c("d2", 100, 125, 99, 124, 6000);
    expect(isReferenceCandle(big, prev, params)).toBe(true);
  });

  it("거래량 미달이면 탈락", () => {
    const prev = c("d1", 100, 101, 99, 100, 1000);
    const weakVol = c("d2", 100, 125, 99, 124, 4000); // 4x < 5x
    expect(isReferenceCandle(weakVol, prev, params)).toBe(false);
  });

  it("종가가 고가에서 멀면 탈락", () => {
    const prev = c("d1", 100, 101, 99, 100, 1000);
    const farClose = c("d2", 100, 125, 99, 110, 6000); // (125-110)/125=0.12 > 5%
    expect(isReferenceCandle(farClose, prev, params)).toBe(false);
  });

  it("직전 봉 없으면 false", () => {
    const big = c("d2", 100, 125, 99, 124, 6000);
    expect(isReferenceCandle(big, undefined, params)).toBe(false);
  });

  it("lookback 내 가장 최근 기준 캔들 반환", () => {
    const candles: Candle[] = [
      c("d1", 100, 101, 99, 100, 1000),
      c("d2", 100, 125, 99, 124, 6000), // 기준 캔들 #1 (index 1)
      c("d3", 124, 126, 120, 122, 2000),
      c("d4", 122, 123, 118, 120, 1500),
      c("d5", 120, 150, 119, 149, 9000), // 기준 캔들 #2 (index 4, 더 최근)
    ];
    const ref = findReferenceCandle(candles, params);
    expect(ref?.index).toBe(4);
    expect(ref?.bodyMid).toBeCloseTo((120 + 149) / 2, 10);
  });

  it("기준 캔들 없으면 null", () => {
    const candles: Candle[] = [
      c("d1", 100, 101, 99, 100, 1000),
      c("d2", 100, 102, 99, 101, 1100),
    ];
    expect(findReferenceCandle(candles, params)).toBeNull();
  });
});
