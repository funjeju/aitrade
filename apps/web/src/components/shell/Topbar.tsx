import { useTranslations } from "next-intl";
import type { Role } from "@/lib/auth/roles";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import styles from "./Topbar.module.css";

export function Topbar({ role }: { role: Role | null }) {
  const t = useTranslations();
  const roleLabel = role ? t(`auth.role.${role}`) : t("auth.guest");

  return (
    <header className={styles.topbar}>
      <div className={styles.search}>
        <span aria-hidden>⌕</span>
        <input
          className={styles.searchInput}
          type="search"
          placeholder={t("common.search")}
          aria-label={t("common.search")}
        />
      </div>
      <div className={styles.spacer} />
      <div className={styles.actions}>
        <LanguageToggle />
        <ThemeToggle />
        <div className={styles.user}>
          <span className={styles.avatar} aria-hidden>
            G
          </span>
          <span className={styles.userMeta}>
            <span className={styles.userName}>{t("auth.guest")}</span>
            <span className={styles.userRole}>{roleLabel}</span>
          </span>
        </div>
      </div>
    </header>
  );
}
