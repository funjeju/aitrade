import { describe, expect, it } from "vitest";
import { scanSymbol } from "./scanner";
import type { Candle, StrategyDSL } from "./types";

const dsl: StrategyDSL = {
  universe: { market: "KR" },
  referenceCandle: {
    highGainFromOpen: 0.2,
    closeNearHighPct: 0.05,
    volMultVsPrev: 5,
    lookbackDays: 20,
  },
  entry: { pullback: { toBodyMid: { tolerance: 0.05 } } },
  exit: { stop: { basis: "refCandleLow", buffer: 0 } },
};

function c(date: string, o: number, h: number, l: number, cl: number, v: number): Candle {
  return { date, open: o, high: h, low: l, close: cl, volume: v };
}

describe("scanSymbol", () => {
  it("기준 캔들이 없으면 NONE", () => {
    const candles = [
      c("d0", 100, 101, 99, 100, 1000),
      c("d1", 100, 102, 99, 101, 1100),
      c("d2", 101, 103, 100, 102, 1050),
    ];
    const r = scanSymbol(candles, dsl);
    expect(r.signal).toBe("NONE");
    expect(r.matchScore).toBe(0);
  });

  it("기준 캔들 후 몸통중앙 눌림이면 BUY + 근거 반환", () => {
    // ref: open100 high125 close124 vol6000 → bodyMid=112
    const candles = [
      c("d0", 100, 101, 99, 100, 1000),
      c("d1", 100, 125, 99, 124, 6000), // 기준캔들
      c("d2", 124, 126, 120, 122, 2500),
      c("d3", 122, 123, 114, 113, 1200), // 몸통중앙(112) 근접 → BUY
    ];
    const r = scanSymbol(candles, dsl);
    expect(r.signal).toBe("BUY");
    expect(r.context.refCandleDate).toBe("d1");
    expect(r.context.pullbackHit).toBe(true);
    expect(r.matchScore).toBeGreaterThan(0.7);
  });

  it("기준 캔들은 있으나 아직 눌림 전이면 WATCH", () => {
    const candles = [
      c("d0", 100, 101, 99, 100, 1000),
      c("d1", 100, 125, 99, 124, 6000), // 기준캔들, bodyMid=112
      c("d2", 124, 130, 123, 129, 2500), // 고점 유지 → 눌림 아님 → WATCH
    ];
    const r = scanSymbol(candles, dsl);
    expect(r.signal).toBe("WATCH");
    expect(r.context.refCandleDate).toBe("d1");
    expect(r.context.pullbackHit).toBe(false);
  });

  it("전일 대비 등락률을 계산한다", () => {
    const candles = [
      c("d0", 100, 101, 99, 100, 1000),
      c("d1", 100, 106, 99, 105, 1100), // +5%
    ];
    const r = scanSymbol(candles, dsl);
    expect(r.changePct).toBeCloseTo(0.05, 10);
  });
});
