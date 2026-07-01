import { cookies } from "next/headers";
import { isRole, type Role } from "./roles";
import { ROLE_HINT_COOKIE } from "./session";

/**
 * RSC/서버에서 현재 사용자 role을 읽는다.
 *
 * Phase 0: 세션 로그인 파이프라인 전이라 쿠키 힌트만 읽는다(값 없으면 null=게스트).
 * TODO(Phase 0 마무리): firebase-admin으로 __session ID 토큰을 검증해 claim에서 role을
 * 확정한다. 지금 골격은 UI 렌더링/가드 흐름을 먼저 세우기 위한 것이다.
 */
export async function getCurrentRole(): Promise<Role | null> {
  const store = await cookies();
  const hint = store.get(ROLE_HINT_COOKIE)?.value;
  return isRole(hint) ? hint : null;
}
