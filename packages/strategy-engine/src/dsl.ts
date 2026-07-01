/**
 * Strategy DSL 검증 (docs/04 §4.4, docs/05 §5.3).
 * 의존성 없는 경량 검증 — Function/서버/클라이언트 어디서나 동일 규칙 적용(P4).
 */
import type { StrategyDSL } from "./types";

export type ValidationIssue = { path: string; message: string };
export type ValidationResult =
  | { ok: true; dsl: StrategyDSL }
  | { ok: false; issues: ValidationIssue[] };

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function inRange(v: number, min: number, max: number): boolean {
  return v >= min && v <= max;
}

/**
 * DSL 스키마·타입·범위 검증. 실패 시 어떤 필드가 왜 막혔는지 반환(되묻기용).
 */
export function validateStrategyDSL(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = [];
  const obj = input as Record<string, unknown>;

  if (!obj || typeof obj !== "object") {
    return { ok: false, issues: [{ path: "", message: "DSL은 객체여야 합니다." }] };
  }

  // universe
  const universe = obj.universe as Record<string, unknown> | undefined;
  if (!universe || (universe.market !== "KR" && universe.market !== "US")) {
    issues.push({ path: "universe.market", message: "market은 'KR' 또는 'US'여야 합니다." });
  }

  // referenceCandle
  const rc = obj.referenceCandle as Record<string, unknown> | undefined;
  if (!rc) {
    issues.push({ path: "referenceCandle", message: "기준 캔들 정의가 필요합니다." });
  } else {
    if (!isNum(rc.highGainFromOpen) || !inRange(rc.highGainFromOpen, 0, 5))
      issues.push({ path: "referenceCandle.highGainFromOpen", message: "0~5 사이 비율이어야 합니다(예: 0.20)." });
    if (!isNum(rc.closeNearHighPct) || !inRange(rc.closeNearHighPct, 0, 1))
      issues.push({ path: "referenceCandle.closeNearHighPct", message: "0~1 사이여야 합니다(예: 0.05)." });
    if (!isNum(rc.volMultVsPrev) || rc.volMultVsPrev <= 0)
      issues.push({ path: "referenceCandle.volMultVsPrev", message: "양수여야 합니다(예: 5.0)." });
    if (!isNum(rc.lookbackDays) || rc.lookbackDays <= 0)
      issues.push({ path: "referenceCandle.lookbackDays", message: "양의 정수여야 합니다(예: 20)." });
  }

  // entry
  const entry = obj.entry as Record<string, unknown> | undefined;
  if (!entry || typeof entry !== "object") {
    issues.push({ path: "entry", message: "진입 조건이 필요합니다." });
  } else if (!entry.pullback || typeof entry.pullback !== "object") {
    issues.push({ path: "entry.pullback", message: "눌림 조건이 필요합니다." });
  }

  // exit — 손절 근거는 필수(P1: 명확한 자동 손절)
  const exit = obj.exit as Record<string, unknown> | undefined;
  if (!exit || typeof exit !== "object") {
    issues.push({ path: "exit", message: "청산 조건이 필요합니다." });
  } else if (!exit.stop) {
    issues.push({ path: "exit.stop", message: "손절 기준이 필요합니다(리스크 관리 필수)." });
  }

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, dsl: input as StrategyDSL };
}
