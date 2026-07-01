import { describe, expect, it } from "vitest";
import { assessPullback } from "./pullback";
import { validateStrategyDSL } from "./dsl";
import type { Candle, ReferenceCandle, StrategyDSL } from "./types";

function c(date: string, close: number, volume: number): Candle {
  return { date, open: close, high: close, low: close, close, volume };
}

describe("assessPullback", () => {
  const ref: ReferenceCandle = {
    index: 0,
    date: "d1",
    open: 100,
    high: 150,
    low: 99,
    close: 140,
    volume: 9000,
    bodyMid: 120, // (100+140)/2
  };

  it("현재가가 몸통 중앙 근처면 nearBodyMid=true", () => {
    const candles: Candle[] = [c("d1", 140, 9000), c("d2", 121, 3000)];
    const a = assessPullback(candles, ref, { bodyMidTolerance: 0.02 });
    expect(a.nearBodyMid).toBe(true); // |121-120|/120 ≈ 0.008 ≤ 0.02
  });

  it("현재가가 몸통 중앙에서 멀면 nearBodyMid=false", () => {
    const candles: Candle[] = [c("d1", 140, 9000), c("d2", 135, 3000)];
    const a = assessPullback(candles, ref, { bodyMidTolerance: 0.02 });
    expect(a.nearBodyMid).toBe(false);
  });

  it("거래량 조정구간이 상승구간보다 작으면 volumeHealthy=true", () => {
    // ref.index=0, after=[d2..d5] 앞절반 상승(고거래량) 뒤절반 조정(저거래량)
    const candles: Candle[] = [
      c("d1", 140, 9000),
      c("d2", 135, 8000),
      c("d3", 130, 7000),
      c("d4", 125, 2000),
      c("d5", 121, 1000),
    ];
    const a = assessPullback(candles, ref, { volumeDecayRatio: 0.6 });
    expect(a.volumeHealthy).toBe(true);
    expect(a.volRatio).not.toBeNull();
    expect(a.volRatio!).toBeLessThan(0.6);
  });

  it("파라미터 미지정이면 해당 판정은 null", () => {
    const candles: Candle[] = [c("d1", 140, 9000), c("d2", 121, 3000)];
    const a = assessPullback(candles, ref, {});
    expect(a.nearBodyMid).toBeNull();
    expect(a.nearOpen).toBeNull();
    expect(a.nearMA).toBeNull();
    expect(a.volumeHealthy).toBeNull();
  });
});

describe("validateStrategyDSL", () => {
  const valid: StrategyDSL = {
    universe: { market: "KR" },
    referenceCandle: {
      highGainFromOpen: 0.2,
      closeNearHighPct: 0.05,
      volMultVsPrev: 5,
      lookbackDays: 20,
    },
    entry: { pullback: { toBodyMid: { tolerance: 0.02 } } },
    exit: { stop: { basis: "refCandleLow", buffer: 0 } },
  };

  it("유효 DSL 통과", () => {
    const r = validateStrategyDSL(valid);
    expect(r.ok).toBe(true);
  });

  it("손절 없으면 실패", () => {
    const bad = { ...valid, exit: {} };
    const r = validateStrategyDSL(bad);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.issues.some((i) => i.path === "exit.stop")).toBe(true);
  });

  it("범위 벗어난 값 실패", () => {
    const bad = {
      ...valid,
      referenceCandle: { ...valid.referenceCandle, closeNearHighPct: 2 },
    };
    const r = validateStrategyDSL(bad);
    expect(r.ok).toBe(false);
  });
});
