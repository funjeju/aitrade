/**
 * 전략 구간(zone) 계산 — 차트 근거 오버레이용 순수 함수.
 * docs/03 §3.3 차트 주석 토큰, docs/04 §4.4 DSL.
 *
 * ⚠️ P1: 이 구간들은 "지금 사라"는 지시가 아니라, 사용자가 정의한 전략의
 *    매수/손절 구간을 시각적 "근거"로 표시하기 위한 계산 결과다.
 */
import type { ReferenceCandle, StrategyDSL } from "./types";

export type PriceBand = {
  /** i18n 키 힌트 (bodyMid | open | stop | refHigh) */
  kind: "bodyMid" | "open" | "stop" | "refHigh";
  /** 중심 가격 */
  price: number;
  /** 허용오차 비율(밴드 반폭). 없으면 0(선). */
  tolerance: number;
};

export type StrategyZones = {
  bodyMid: number;
  open: number;
  refLow: number;
  refHigh: number;
  stop: number;
  /** 분할 매수 구간(눌림 목표) */
  buyBands: PriceBand[];
  /** 손절 밴드 */
  stopBand: PriceBand;
};

/** 기준 캔들 + DSL로부터 매수/손절 구간 가격대를 계산. */
export function strategyZones(
  ref: ReferenceCandle,
  dsl: StrategyDSL,
): StrategyZones {
  const pb = dsl.entry.pullback;
  const buyBands: PriceBand[] = [];
  if (pb.toBodyMid) {
    buyBands.push({ kind: "bodyMid", price: ref.bodyMid, tolerance: pb.toBodyMid.tolerance });
  }
  if (pb.toOpen) {
    buyBands.push({ kind: "open", price: ref.open, tolerance: pb.toOpen.tolerance });
  }

  const buffer = dsl.exit.stop?.buffer ?? 0;
  const stop = ref.low * (1 - buffer);

  return {
    bodyMid: ref.bodyMid,
    open: ref.open,
    refLow: ref.low,
    refHigh: ref.high,
    stop,
    buyBands,
    stopBand: { kind: "stop", price: stop, tolerance: 0 },
  };
}
