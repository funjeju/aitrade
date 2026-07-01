"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import styles from "./Topbar.module.css";

/**
 * 언어 토글. 로케일 목록은 routing에서 온다(2개 하드코딩 금지, docs/06).
 * 현재 경로를 유지한 채 로케일만 교체한다.
 */
export function LanguageToggle() {
  const t = useTranslations("common.language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className={styles.langGroup} role="group" aria-label={t("toggle")}>
      {routing.locales.map((l) => (
        <button
          key={l}
          type="button"
          className={`${styles.langButton} ${l === locale ? styles.langActive : ""}`}
          onClick={() => router.replace(pathname, { locale: l })}
          aria-current={l === locale ? "true" : undefined}
        >
          {t(l)}
        </button>
      ))}
    </div>
  );
}
