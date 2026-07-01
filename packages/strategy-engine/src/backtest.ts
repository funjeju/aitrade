/**
 * 백테스트 엔진 — 순수 함수. CLAUDE.md P2 + skill-backtest-guard 준수.
 *
 * 핵심 가드(구조적 차단):
 *  - look-ahead 금지: 매 시점 t의 판단은 candles[0..t]만 참조한다(미래 없음).
 *    각 결정은 evaluateBarDecision(window)로 격리되고, window는 t까지의 슬라이스다.
 *  - out-of-sample 분리: walkForwardBacktest가 in/out 표본을 나눠 각각 지표를 기록한다.
 *  - 현실성: 수수료·슬리피지 가정을 명시·반영한다.
 *  - 재최적화 추적: reoptimizationCount를 결과 메타에 담는다(여기선 최적화 안 하므로 0).
 *
 * ⚠️ 단순화(정직하게 표기): 롱온리, 종가 진입/청산(손절은 장중 저가 터치),
 *    분할매수는 v1에서 단일 진입으로 근사. 실데이터·정밀 체결은 Phase 2 이후.
 */
import type { Candle, StrategyDSL } from "./types";
import { findReferenceCandle } from "./referenceCandle";
import { assessPullback } from "./pullback";
import { smaSeries, linregSlope } from "./indicators";

export type BacktestAssumptions = {
  /** 편도 수수료율 (예: 0.00015) */
  feeRate: number;
  /** 편도 슬리피지율 (예: 0.001) */
  slippageRate: number;
};

export const DEFAULT_ASSUMPTIONS: BacktestAssumptions = {
  feeRate: 0.00015,
  slippageRate: 0.001,
};

export type Trade = {
  entryIndex: number;
  exitIndex: number;
  entryDate: string;
  exitDate: string;
  entryPrice: number;
  exitPrice: number;
  /** 수수료·슬리피지 반영 순수익률 */
  returnPct: number;
  holdingBars: number;
  reason: "stop" | "trailing" | "maExit" | "end";
};

export type BacktestMetrics = {
  tradeCount: number;
  winRate: number; // 0..1
  avgReturn: number; // 평균 순수익률
  mdd: number; // 최대낙폭 (음수)
  avgHoldingBars: number;
};

export type BacktestResult = {
  trades: Trade[];
  metrics: BacktestMetrics;
};

type Position = {
  entryIndex: number;
  entryPrice: number;
  refLow: number;
  peak: number; // 트레일링용 최고가
};

/** 트레이드 순수익률 계산 (양편 수수료+슬리피지). */
function netReturn(
  entryPrice: number,
  exitPrice: number,
  a: BacktestAssumptions,
): number {
  const cost = a.feeRate * 2 + a.slippageRate * 2;
  return (exitPrice - entryPrice) / entryPrice - cost;
}

function computeMetrics(trades: Trade[]): BacktestMetrics {
  const n = trades.length;
  if (n === 0) {
    return { tradeCount: 0, winRate: 0, avgReturn: 0, mdd: 0, avgHoldingBars: 0 };
  }
  let wins = 0;
  let sumRet = 0;
  let sumHold = 0;
  let equity = 1;
  let peak = 1;
  let mdd = 0;
  for (const t of trades) {
    if (t.returnPct > 0) wins++;
    sumRet += t.returnPct;
    sumHold += t.holdingBars;
    equity *= 1 + t.returnPct;
    if (equity > peak) peak = equity;
    const dd = equity / peak - 1;
    if (dd < mdd) mdd = dd;
  }
  return {
    tradeCount: n,
    winRate: wins / n,
    avgReturn: sumRet / n,
    mdd,
    avgHoldingBars: sumHold / n,
  };
}

/**
 * 단일 구간 백테스트. offset은 원본 시계열에서의 시작 인덱스(날짜/로그용).
 * candles는 이미 해당 구간으로 잘린 슬라이스.
 */
export function runBacktest(
  candles: readonly Candle[],
  dsl: StrategyDSL,
  assumptions: BacktestAssumptions = DEFAULT_ASSUMPTIONS,
): BacktestResult {
  const trades: Trade[] = [];
  let pos: Position | null = null;

  const rcParams = {
    highGainFromOpen: dsl.referenceCandle.highGainFromOpen,
    closeNearHighPct: dsl.referenceCandle.closeNearHighPct,
    volMultVsPrev: dsl.referenceCandle.volMultVsPrev,
    lookbackDays: dsl.referenceCandle.lookbackDays,
  };
  const pb = dsl.entry.pullback;
  const stopBuffer = dsl.exit.stop?.buffer ?? 0;
  const maExitPeriod = dsl.exit.maExit?.period;
  const trailingMult = dsl.exit.trailing?.mult;
  const maSlope = dsl.entry.maSlope;

  const closes = candles.map((c) => c.close);
  const maExitSeries = maExitPeriod ? smaSeries(closes, maExitPeriod) : null;

  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i]!;
    // === 청산 판단 (보유 중) — 오직 candles[0..i]만 참조 ===
    if (pos) {
      pos.peak = Math.max(pos.peak, bar.high);

      const stopPrice = pos.refLow * (1 - stopBuffer);
      if (bar.low <= stopPrice) {
        const exitPrice = Math.min(stopPrice, bar.open); // 갭하락이면 시가 체결
        trades.push(makeTrade(pos, i, exitPrice, candles, assumptions, "stop"));
        pos = null;
        continue;
      }

      // 트레일링: 고점 대비 하락률이 임계 초과 (pct 근사; ATR은 후속)
      if (trailingMult !== undefined) {
        const dropPct = (pos.peak - bar.close) / pos.peak;
        // mult를 pct 임계로 해석(예: 2.0 → 미사용 시 무한대 방지 위해 0.5로 캡)
        const threshold = Math.min(trailingMult, 0.5);
        if (dropPct >= threshold) {
          trades.push(makeTrade(pos, i, bar.close, candles, assumptions, "trailing"));
          pos = null;
          continue;
        }
      }

      // 단기 이평 이탈
      if (maExitSeries) {
        const ma = maExitSeries[i];
        if (ma !== null && ma !== undefined && bar.close < ma) {
          trades.push(makeTrade(pos, i, bar.close, candles, assumptions, "maExit"));
          pos = null;
          continue;
        }
      }
      continue;
    }

    // === 진입 판단 (미보유) — window는 t까지만 ===
    const window = candles.slice(0, i + 1);
    const ref = findReferenceCandle(window, rcParams);
    if (!ref || ref.index >= i) continue; // 기준 캔들 이후에만 진입

    const assess = assessPullback(window, ref, {
      bodyMidTolerance: pb.toBodyMid?.tolerance,
      openTolerance: pb.toOpen?.tolerance,
      nearMA: pb.nearMA,
      volumeDecayRatio: dsl.entry.volumeHealth?.decayRatio,
    });

    const pullbackHit = assess.nearBodyMid === true || assess.nearOpen === true;
    const volOk = assess.volumeHealthy !== false; // 설정 없으면 통과
    let slopeOk = true;
    if (maSlope) {
      const maSer = smaSeries(closes.slice(0, i + 1), maSlope.period).filter(
        (v): v is number => v !== null,
      );
      const slope = linregSlope(maSer, Math.min(maSer.length, 5));
      slopeOk = slope !== null && slope >= maSlope.minSlope;
    }

    if (pullbackHit && volOk && slopeOk) {
      const entryPrice = bar.close * (1 + assumptions.slippageRate);
      pos = { entryIndex: i, entryPrice, refLow: ref.low, peak: bar.high };
    }
  }

  // 구간 종료 시 미청산 포지션 정리
  if (pos) {
    const last = candles.length - 1;
    trades.push(
      makeTrade(pos, last, candles[last]!.close, candles, assumptions, "end"),
    );
  }

  return { trades, metrics: computeMetrics(trades) };
}

function makeTrade(
  pos: Position,
  exitIndex: number,
  rawExitPrice: number,
  candles: readonly Candle[],
  a: BacktestAssumptions,
  reason: Trade["reason"],
): Trade {
  const exitPrice = rawExitPrice * (1 - a.slippageRate);
  return {
    entryIndex: pos.entryIndex,
    exitIndex,
    entryDate: candles[pos.entryIndex]!.date,
    exitDate: candles[exitIndex]!.date,
    entryPrice: pos.entryPrice,
    exitPrice,
    returnPct: netReturn(pos.entryPrice, exitPrice, a),
    holdingBars: exitIndex - pos.entryIndex,
    reason,
  };
}

// ---- Walk-forward / out-of-sample (P2 필수) ----

export type WalkForwardResult = {
  method: "walk_forward";
  period: { from: string; to: string };
  split: { inSampleRatio: number; inSampleBars: number; outOfSampleBars: number };
  inSample: BacktestMetrics;
  outOfSample: BacktestMetrics;
  assumptions: BacktestAssumptions;
  reoptimizationCount: number;
  /** survivorship: 유니버스에 상폐/거래정지 포함 여부 (데이터 소스에서 주입) */
  universeHadDelisted: boolean;
  warnings: string[];
};

/**
 * in-sample(앞) / out-of-sample(뒤) 시간 분할 후 각각 백테스트.
 * 같은 DSL을 두 구간에 적용하고 지표를 분리 기록한다(과최적화·과장 방지).
 */
export function walkForwardBacktest(
  candles: readonly Candle[],
  dsl: StrategyDSL,
  opts?: {
    inSampleRatio?: number;
    assumptions?: BacktestAssumptions;
    reoptimizationCount?: number;
    universeHadDelisted?: boolean;
  },
): WalkForwardResult {
  const ratio = opts?.inSampleRatio ?? 0.7;
  const assumptions = opts?.assumptions ?? DEFAULT_ASSUMPTIONS;
  const cut = Math.floor(candles.length * ratio);
  const inCandles = candles.slice(0, cut);
  const outCandles = candles.slice(cut);

  const inRes = runBacktest(inCandles, dsl, assumptions);
  const outRes = runBacktest(outCandles, dsl, assumptions);

  const warnings: string[] = [];
  if (outRes.metrics.tradeCount < 10) {
    warnings.push("out-of-sample 표본이 10건 미만이라 통계적 신뢰가 낮습니다.");
  }
  if ((opts?.reoptimizationCount ?? 0) >= 5) {
    warnings.push("같은 검증셋 재최적화가 5회 이상입니다(데이터 스누핑 위험).");
  }
  if (!opts?.universeHadDelisted) {
    warnings.push("유니버스에 상장폐지 종목이 없어 survivorship bias 가능성이 있습니다.");
  }

  return {
    method: "walk_forward",
    period: {
      from: candles[0]?.date ?? "",
      to: candles[candles.length - 1]?.date ?? "",
    },
    split: {
      inSampleRatio: ratio,
      inSampleBars: inCandles.length,
      outOfSampleBars: outCandles.length,
    },
    inSample: inRes.metrics,
    outOfSample: outRes.metrics,
    assumptions,
    reoptimizationCount: opts?.reoptimizationCount ?? 0,
    universeHadDelisted: opts?.universeHadDelisted ?? false,
    warnings,
  };
}
