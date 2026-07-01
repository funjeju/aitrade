import { describe, expect, it } from "vitest";
import { runBacktest, walkForwardBacktest, DEFAULT_ASSUMPTIONS } from "./backtest";
import type { Candle, StrategyDSL } from "./types";

/** 기준캔들→상승→눌림→회복 시나리오를 만드는 헬퍼. */
function scenario(): Candle[] {
  const cs: Candle[] = [];
  const push = (
    o: number,
    h: number,
    l: number,
    c: number,
    v: number,
  ) => cs.push({ date: `d${cs.length}`, open: o, high: h, low: l, close: c, volume: v });

  push(100, 101, 99, 100, 1000); // 0
  push(100, 125, 99, 124, 6000); // 1 기준캔들(+25%, 종가 고가근처, 6x)
  push(124, 127, 121, 122, 2500); // 2 상승 마무리
  push(122, 123, 118, 120, 1500); // 3 조정
  push(121, 122, 118, 120, 800); // 4 눌림(bodyMid=112? ref bodyMid=(100+124)/2=112)
  push(120, 121, 110, 112, 700); // 5 몸통중앙(112) 근접 → 진입 후보
  push(113, 130, 112, 128, 3000); // 6 회복
  push(128, 135, 126, 134, 3200); // 7 상승
  push(134, 136, 120, 121, 3000); // 8 급락(트레일링/이평이탈 청산 유도)
  return cs;
}

const dsl: StrategyDSL = {
  universe: { market: "KR" },
  referenceCandle: {
    highGainFromOpen: 0.2,
    closeNearHighPct: 0.05,
    volMultVsPrev: 5,
    lookbackDays: 20,
  },
  entry: {
    pullback: { toBodyMid: { tolerance: 0.05 } },
  },
  exit: {
    trailing: { type: "pct", mult: 0.08 },
    maExit: { period: 3 },
    stop: { basis: "refCandleLow", buffer: 0 },
  },
};

describe("runBacktest", () => {
  it("눌림 진입 후 청산까지 트레이드를 생성한다", () => {
    const res = runBacktest(scenario(), dsl);
    expect(res.trades.length).toBeGreaterThanOrEqual(1);
    const t = res.trades[0]!;
    expect(t.entryIndex).toBeLessThan(t.exitIndex);
    expect(["stop", "trailing", "maExit", "end"]).toContain(t.reason);
  });

  it("수수료·슬리피지가 순수익률에 반영된다", () => {
    const noCost = runBacktest(scenario(), dsl, { feeRate: 0, slippageRate: 0 });
    const withCost = runBacktest(scenario(), dsl, DEFAULT_ASSUMPTIONS);
    if (noCost.trades.length && withCost.trades.length) {
      expect(withCost.trades[0]!.returnPct).toBeLessThan(noCost.trades[0]!.returnPct);
    }
  });

  it("metrics: winRate/mdd 범위가 유효하다", () => {
    const { metrics } = runBacktest(scenario(), dsl);
    expect(metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(metrics.winRate).toBeLessThanOrEqual(1);
    expect(metrics.mdd).toBeLessThanOrEqual(0);
  });
});

describe("look-ahead 가드 (회귀테스트)", () => {
  /**
   * 핵심: 시점 t의 진입/청산 결정은 candles[0..t]에만 의존해야 한다.
   * 전체 시계열로 돌린 결과와, 각 트레이드 시점까지만 잘라서 돌린 결과의
   * "그 시점까지의 트레이드"가 동일해야 한다. 미래 데이터가 새면 달라진다.
   */
  it("미래 데이터를 잘라내도 과거 결정이 바뀌지 않는다", () => {
    const full = scenario();
    const fullRes = runBacktest(full, dsl);

    for (const t of fullRes.trades) {
      // 청산 시점까지만 자른 시계열
      const truncated = full.slice(0, t.exitIndex + 1);
      const truncRes = runBacktest(truncated, dsl);
      const match = truncRes.trades.find((x) => x.entryIndex === t.entryIndex);
      expect(match, `entryIndex=${t.entryIndex} 트레이드가 잘린 시계열에도 존재해야 함`).toBeDefined();
      // 진입가·청산가·사유가 동일해야(미래 미참조)
      expect(match!.entryPrice).toBeCloseTo(t.entryPrice, 10);
      expect(match!.exitPrice).toBeCloseTo(t.exitPrice, 10);
      expect(match!.reason).toBe(t.reason);
    }
  });
});

describe("walkForwardBacktest (out-of-sample 분리)", () => {
  it("in/out 지표를 분리 기록하고 메타를 채운다", () => {
    const long = [...scenario(), ...scenario().map((c, i) => ({ ...c, date: `e${i}` }))];
    const wf = walkForwardBacktest(long, dsl, { inSampleRatio: 0.6 });
    expect(wf.method).toBe("walk_forward");
    expect(wf.split.inSampleBars + wf.split.outOfSampleBars).toBe(long.length);
    expect(wf.inSample).toBeDefined();
    expect(wf.outOfSample).toBeDefined();
    expect(wf.reoptimizationCount).toBe(0);
  });

  it("survivorship 미처리 시 경고를 남긴다", () => {
    const wf = walkForwardBacktest(scenario(), dsl, { universeHadDelisted: false });
    expect(wf.warnings.some((w) => w.includes("survivorship"))).toBe(true);
  });
});
