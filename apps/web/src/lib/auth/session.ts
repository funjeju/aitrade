import type { NextRequest } from "next/server";
import { isRole, type Role } from "./roles";

/**
 * Edge에서 세션 쿠키의 role 힌트를 읽는다(1차 가드용).
 *
 * ⚠️ 이 값은 신뢰의 최종 근거가 아니다. Edge 미들웨어는 UX용 1차 차단만 하고,
 * 실제 데이터 접근은 Node 런타임에서 firebase-admin으로 ID 토큰을 재검증한다.
 * (docs/02 §2.1, docs/06 §6.1 — defense in depth)
 *
 * Phase 0: 세션 로그인 파이프라인이 붙기 전까지 쿠키는 비어 있고 role은 null이다.
 */
export const SESSION_COOKIE = "__session";
export const ROLE_HINT_COOKIE = "__role";

export function readSessionRole(request: NextRequest): Role | null {
  const hint = request.cookies.get(ROLE_HINT_COOKIE)?.value;
  return isRole(hint) ? hint : null;
}
