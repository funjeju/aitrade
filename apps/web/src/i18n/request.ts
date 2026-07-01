import { getRequestConfig } from "next-intl/server";
import { routing, type Locale } from "./routing";

/**
 * 요청별 로케일 확정 + 메시지 로딩.
 * 지원하지 않는 로케일이면 기본 로케일로 폴백한다.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && routing.locales.includes(requested as Locale)
      ? (requested as Locale)
      : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
