import { defineRouting } from "next-intl/routing";

/**
 * 로케일 설정 — 단일 소스.
 * N개 언어 확장 가능하게 배열로 관리한다(2개 하드코딩 가정 금지, docs/06).
 * 기본 ko, 2차 en.
 */
export const locales = ["ko", "en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "ko";

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: "always",
});
