import { describe, expect, it } from "vitest";
import { strategyZones } from "./zones";
import type { ReferenceCandle, StrategyDSL } from "./types";

const ref: ReferenceCandle = {
  index: 1,
  date: "d1",
  open: 100,
  high: 125,
  low: 99,
  close: 124,
  volume: 6000,
  bodyMid: 112,
};

const dsl: StrategyDSL = {
  universe: { market: "KR" },
  referenceCandle: { highGainFromOpen: 0.2, closeNearHighPct: 0.05, volMultVsPrev: 5, lookbackDays: 20 },
  entry: {
    pullback: { toBodyMid: { tolerance: 0.02 }, toOpen: { tolerance: 0.03 } },
  },
  exit: { stop: { basis: "refCandleLow", buffer: 0.01 } },
};

describe("strategyZones", () => {
  it("몸통중앙·시가 매수밴드와 손절밴드를 계산한다", () => {
    const z = strategyZones(ref, dsl);
    expect(z.bodyMid).toBe(112);
    expect(z.open).toBe(100);
    expect(z.buyBands).toHaveLength(2);
    expect(z.buyBands[0]).toMatchObject({ kind: "bodyMid", price: 112, tolerance: 0.02 });
    expect(z.buyBands[1]).toMatchObject({ kind: "open", price: 100, tolerance: 0.03 });
    // stop = low * (1 - buffer) = 99 * 0.99
    expect(z.stop).toBeCloseTo(99 * 0.99, 10);
  });

  it("toBodyMid만 있으면 매수밴드 1개", () => {
    const d2 = { ...dsl, entry: { pullback: { toBodyMid: { tolerance: 0.02 } } } };
    const z = strategyZones(ref, d2);
    expect(z.buyBands).toHaveLength(1);
  });
});
