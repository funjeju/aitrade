import { NextResponse } from "next/server";
import { getKiwoomConfig } from "@/lib/kiwoom/config";
import { getAccessToken } from "@/lib/kiwoom/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * 키움 연결 상태.
 * GET  → 설정 여부/환경만 (토큰 발급 안 함, 가벼움).
 * POST → 실제 토큰 발급으로 연결 테스트(forceRefresh).
 *
 * ⚠️ appKey/secret은 절대 응답에 포함하지 않는다.
 */

export function GET() {
  const config = getKiwoomConfig();
  return NextResponse.json({
    configured: Boolean(config),
    env: config?.env ?? null,
  });
}

export async function POST() {
  const result = await getAccessToken(true);
  if (result.ok) {
    return NextResponse.json({
      configured: true,
      connected: true,
      env: result.token.env,
      tokenType: result.token.tokenType,
      expiresAt: result.token.expiresAt,
    });
  }

  const httpStatus = result.reason === "not_configured" ? 400 : 502;
  return NextResponse.json(
    {
      configured: result.reason !== "not_configured",
      connected: false,
      reason: result.reason,
      message: result.message,
    },
    { status: httpStatus },
  );
}
