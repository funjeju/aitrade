import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { routing } from "./i18n/routing";
import { readSessionRole } from "./lib/auth/session";

const intlMiddleware = createMiddleware(routing);

/**
 * 로케일 라우팅(next-intl) + /admin 역할 가드.
 *
 * P1/규제: role은 클라이언트가 못 바꾼다. 여기서는 세션 토큰의 claim(role)만 확인해
 * /admin 접근을 차단한다. 부여/회수는 Cloud Function 전용(docs/06).
 *
 * NOTE: 실제 토큰 검증(firebase-admin)은 Node 런타임 Route Handler에서 수행한다.
 * Edge 미들웨어에서는 세션 쿠키 존재/역할 힌트만으로 1차 가드하고, 민감 데이터 접근은
 * 서버에서 재검증한다(defense in depth).
 */
function isAdminPath(pathname: string): boolean {
  // /{locale}/admin or /{locale}/admin/...
  return routing.locales.some(
    (l) => pathname === `/${l}/admin` || pathname.startsWith(`/${l}/admin/`),
  );
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isAdminPath(pathname)) {
    const role = readSessionRole(request);
    if (role !== "admin" && role !== "superadmin") {
      const locale = pathname.split("/")[1] || routing.defaultLocale;
      const url = new URL(`/${locale}`, request.url);
      url.searchParams.set("denied", "admin");
      return NextResponse.redirect(url);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  // 로케일 라우팅 대상. 정적/내부 경로는 제외.
  matcher: ["/", "/((?!api|_next|_vercel|.*\\..*).*)"],
};
