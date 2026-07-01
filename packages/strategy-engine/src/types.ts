/**
 * 전략 엔진 핵심 타입 (docs/04, docs/05 §4.4 DSL).
 * 계산은 raw 값으로, 표시 단위 분리(CLAUDE.md §6).
 */

/** OHLCV 캔들. date는 ISO(YYYY-MM-DD) 또는 정렬 가능한 문자열. */
export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

/** 기준 캔들 상태 스냅샷 (스캐너가 종목별로 기억, docs/04 §4.1). */
export type ReferenceCandle = {
  index: number;
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  /** 몸통 중앙 = (open+close)/2 */
  bodyMid: number;
};

// ---- Strategy DSL (docs/04 §4.4) ----

export type Market = "KR" | "US";

export type StrategyDSL = {
  universe: {
    market: Market;
    sectorFilter?: { state?: string };
  };
  leader?: {
    rankBy: string[];
    topN: number;
  };
  referenceCandle: {
    highGainFromOpen: number; // (high-open)/open 임계
    closeNearHighPct: number; // (high-close)/high 임계
    volMultVsPrev: number; // volume >= prevVolume * n
    lookbackDays: number;
  };
  entry: {
    pullback: {
      toBodyMid?: { tolerance: number };
      toOpen?: { tolerance: number };
      nearMA?: { period: number; pct: number };
    };
    volumeHealth?: { decayRatio: number };
    maSlope?: { period: number; minSlope: number };
    splits?: Array<{ at: "bodyMid" | "open" | string; weight: number }>;
  };
  exit: {
    trailing?: { type: "atr" | "pct"; mult: number };
    maExit?: { period: number };
    stop?: { basis: "refCandleLow" | string; buffer: number };
  };
};
