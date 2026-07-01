"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";
import styles from "./Topbar.module.css";

/**
 * 테마 토글. next-themes는 마운트 전 테마를 알 수 없으므로
 * hydration mismatch 방지를 위해 마운트 후에만 현재 상태를 반영한다.
 */
export function ThemeToggle() {
  const t = useTranslations("common.theme");
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={t("toggle")}
      title={t("toggle")}
      suppressHydrationWarning
    >
      {mounted ? (isDark ? "☾" : "☀") : "☾"}
    </button>
  );
}
