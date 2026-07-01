"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

/**
 * 테마 프로바이더.
 * - attribute="data-theme" → :root[data-theme="dark"] 토큰 오버라이드와 연결(docs/03).
 * - 다크 기본(트레이딩 툴 관행). 라이트 완전 지원.
 * - next-themes가 SSR flash 방지 스크립트를 주입한다(html에 suppressHydrationWarning 필요).
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider
      attribute="data-theme"
      defaultTheme="dark"
      enableSystem={false}
      themes={["light", "dark"]}
    >
      {children}
    </NextThemesProvider>
  );
}
