import type { Candle, StrategyDSL } from "@ats/strategy-engine";

/**
 * 결정적(seed 고정) 샘플 캔들 — 데모 전용.
 * ⚠️ 실제 시장 데이터가 아니다. 성과 화면에 "샘플 데이터(데모)"로 반드시 표기한다(P3).
 * 실데이터 벤더 연동은 Phase 2(블로커).
 */

// 간단한 결정적 PRNG (mulberry32)
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * 문서(docs/04)의 눌림목 패턴을 주기적으로 심은 결정적 일봉 생성.
 * 사이클: 랜덤워크 → 기준캔들(장대양봉) → 상승 2봉(고거래량) →
 *         눌림 3봉(몸통중앙까지, 거래량 감소) → 회복 4봉 → 하락 1봉(청산 유도).
 * 이렇게 해야 데모에서 실제 진입/청산 트레이드가 생성된다.
 */
export function makeSampleCandles(bars = 250, seed = 42): Candle[] {
  const rand = mulberry32(seed);
  const candles: Candle[] = [];
  const start = Date.UTC(2023, 0, 2);
  let price = 10000;
  let prevVol = 1_000_000;

  const push = (o: number, h: number, l: number, c: number, v: number) => {
    const date = new Date(start + candles.length * 86400000)
      .toISOString()
      .slice(0, 10);
    candles.push({
      date,
      open: round(o),
      high: round(h),
      low: round(l),
      close: round(c),
      volume: Math.round(v),
    });
    price = c;
    prevVol = v;
  };

  // 랜덤워크 n봉
  const walk = (n: number) => {
    for (let k = 0; k < n; k++) {
      const o = price;
      const c = o * (1 + (rand() - 0.48) * 0.018);
      push(
        o,
        Math.max(o, c) * (1 + rand() * 0.01),
        Math.min(o, c) * (1 - rand() * 0.01),
        c,
        prevVol * (0.6 + rand() * 0.7),
      );
    }
  };

  const pullbackCycle = () => {
    // 기준캔들: 시가대비 +24%, 종가 고가근처, 전일 6배 거래량
    const o = price;
    const c = o * 1.24;
    const spikeVol = prevVol * 6;
    push(o, c * 1.01, o * 0.995, c, spikeVol);
    const bodyMid = (o + c) / 2;

    // 상승 2봉 (고거래량 유지)
    push(price, price * 1.03, price * 0.99, price * 1.02, spikeVol * 0.9);
    push(price, price * 1.02, price * 0.985, price * 1.005, spikeVol * 0.8);

    // 눌림 3봉: bodyMid 부근까지 하락, 거래량 감소
    const rise = price;
    const step = (rise - bodyMid) / 3;
    for (let k = 1; k <= 3; k++) {
      const target = k === 3 ? bodyMid : rise - step * k;
      push(
        price,
        price * 1.005,
        target * 0.99,
        target,
        spikeVol * (0.3 - k * 0.05),
      );
    }

    // 회복 4봉 (진입 후 상승)
    for (let k = 0; k < 4; k++) {
      push(price, price * 1.04, price * 0.99, price * 1.03, prevVol * 1.2);
    }

    // 하락 1봉 (트레일링/이평이탈 청산 유도)
    push(price, price * 1.005, price * 0.9, price * 0.92, prevVol * 1.5);
  };

  while (candles.length < bars) {
    walk(12);
    if (candles.length < bars) pullbackCycle();
  }
  return candles.slice(0, bars);
}

function round(v: number): number {
  return Math.round(v);
}

/** 데모용 기본 전략 DSL(문서 예시값). */
export const SAMPLE_DSL: StrategyDSL = {
  universe: { market: "KR" },
  referenceCandle: {
    highGainFromOpen: 0.2,
    closeNearHighPct: 0.05,
    volMultVsPrev: 5,
    lookbackDays: 20,
  },
  entry: {
    pullback: {
      toBodyMid: { tolerance: 0.03 },
      nearMA: { period: 10, pct: 0.05 },
    },
    volumeHealth: { decayRatio: 0.7 },
  },
  exit: {
    trailing: { type: "pct", mult: 0.08 },
    maExit: { period: 5 },
    stop: { basis: "refCandleLow", buffer: 0 },
  },
};
