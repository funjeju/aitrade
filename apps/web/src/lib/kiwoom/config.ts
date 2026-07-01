import "server-only";

/**
 * 키움증권 REST API 설정 (서버 전용).
 *
 * ⚠️ 앱키/시크릿은 절대 브라우저에 노출하지 않는다(NEXT_PUBLIC_ 금지).
 *    이 모듈은 "server-only"로 클라이언트 번들 유입을 강제 차단한다.
 * ⚠️ 규제(P1): 브로커 API는 "사용자가 정의한 조건 충족 시 주문만 집행"하는
 *    시스템트레이딩 용도. 이 파일은 Phase 2/3 연동을 위한 자격증명 로딩 골격일 뿐이며,
 *    실주문 경로는 규제 검토(docs/07 Phase 3 블로커) 완료 전 열지 않는다.
 */

export type KiwoomEnv = "mock" | "real";

const BASE_URLS: Record<KiwoomEnv, string> = {
  real: "https://api.kiwoom.com",
  mock: "https://mockapi.kiwoom.com",
};

export type KiwoomConfig = {
  env: KiwoomEnv;
  appKey: string;
  appSecret: string;
  baseUrl: string;
};

function resolveEnv(raw: string | undefined): KiwoomEnv {
  return raw === "real" ? "real" : "mock"; // 기본은 안전한 모의투자
}

export function isKiwoomConfigured(): boolean {
  return Boolean(process.env.KIWOOM_APP_KEY && process.env.KIWOOM_APP_SECRET);
}

/**
 * 설정을 읽어 반환. 키가 없으면 null(자격증명 없이도 앱이 뜨게).
 */
export function getKiwoomConfig(): KiwoomConfig | null {
  const appKey = process.env.KIWOOM_APP_KEY;
  const appSecret = process.env.KIWOOM_APP_SECRET;
  if (!appKey || !appSecret) return null;

  const env = resolveEnv(process.env.KIWOOM_ENV);
  return { env, appKey, appSecret, baseUrl: BASE_URLS[env] };
}
