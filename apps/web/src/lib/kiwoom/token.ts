import "server-only";
import { getKiwoomConfig, type KiwoomConfig } from "./config";

/**
 * 키움 REST API 접근토큰 발급/캐시 (서버 전용).
 *
 * 키움 스펙:
 *  POST {baseUrl}/oauth2/token
 *  body(JSON): { grant_type: "client_credentials", appkey, secretkey }
 *  resp(JSON): { token_type, token, expires_dt("YYYYMMDDHHmmss"), return_code, return_msg }
 *
 * ⚠️ 이 모듈은 인증 토큰만 다룬다(주문 아님). 실주문 경로는 규제 검토 전 열지 않는다(P1).
 */

type KiwoomTokenResponse = {
  token_type?: string;
  token?: string;
  expires_dt?: string;
  return_code?: number;
  return_msg?: string;
};

export type AccessToken = {
  token: string;
  tokenType: string;
  expiresAt: number; // epoch ms
  env: KiwoomConfig["env"];
};

export type TokenResult =
  | { ok: true; token: AccessToken }
  | { ok: false; reason: "not_configured" | "http_error" | "api_error" | "network"; message: string };

// 만료 60초 전이면 새로 발급 (경계 안전마진)
const EXPIRY_SKEW_MS = 60_000;

// 모듈 메모리 캐시. env별로 분리. (서버리스에서 인스턴스 간 공유 안 됨 — 인스턴스 로컬 캐시)
const cache = new Map<KiwoomConfig["env"], AccessToken>();

/** "YYYYMMDDHHmmss"(KST) → epoch ms */
function parseExpiresDt(raw: string | undefined): number {
  if (!raw || raw.length < 14) return Date.now() + 60 * 60 * 1000; // 정보 없으면 1h 보수적
  const y = Number(raw.slice(0, 4));
  const mo = Number(raw.slice(4, 6));
  const d = Number(raw.slice(6, 8));
  const h = Number(raw.slice(8, 10));
  const mi = Number(raw.slice(10, 12));
  const s = Number(raw.slice(12, 14));
  // 키움 시각은 KST(UTC+9). UTC epoch로 환산.
  return Date.UTC(y, mo - 1, d, h - 9, mi, s);
}

function isFresh(token: AccessToken): boolean {
  return token.expiresAt - EXPIRY_SKEW_MS > Date.now();
}

/**
 * 접근토큰 획득. 캐시가 유효하면 재사용, 아니면 발급.
 * forceRefresh=true면 캐시 무시하고 재발급(연결 테스트용).
 */
export async function getAccessToken(forceRefresh = false): Promise<TokenResult> {
  const config = getKiwoomConfig();
  if (!config) {
    return { ok: false, reason: "not_configured", message: "키움 앱키/시크릿이 설정되지 않았습니다." };
  }

  if (!forceRefresh) {
    const cached = cache.get(config.env);
    if (cached && isFresh(cached)) {
      return { ok: true, token: cached };
    }
  }

  let res: Response;
  try {
    res = await fetch(`${config.baseUrl}/oauth2/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json;charset=UTF-8" },
      body: JSON.stringify({
        grant_type: "client_credentials",
        appkey: config.appKey,
        secretkey: config.appSecret,
      }),
      cache: "no-store",
    });
  } catch (e) {
    return { ok: false, reason: "network", message: e instanceof Error ? e.message : "네트워크 오류" };
  }

  if (!res.ok) {
    return { ok: false, reason: "http_error", message: `HTTP ${res.status}` };
  }

  const data = (await res.json().catch(() => ({}))) as KiwoomTokenResponse;

  // 키움은 성공 시 return_code=0. 토큰 문자열도 확인.
  if (data.return_code !== 0 || !data.token) {
    return {
      ok: false,
      reason: "api_error",
      message: data.return_msg || `발급 실패 (return_code=${data.return_code ?? "?"})`,
    };
  }

  const token: AccessToken = {
    token: data.token,
    tokenType: data.token_type ?? "bearer",
    expiresAt: parseExpiresDt(data.expires_dt),
    env: config.env,
  };
  cache.set(config.env, token);
  return { ok: true, token };
}
