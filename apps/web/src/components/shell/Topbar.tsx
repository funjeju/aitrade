import { useTranslations } from "next-intl";
import type { Role } from "@/lib/auth/roles";
import { ThemeToggle } from "./ThemeToggle";
import { LanguageToggle } from "./LanguageToggle";
import { UserMenu } from "./UserMenu";
import styles from "./Topbar.module.css";

export function Topbar({ role: _role }: { role: Role | null }) {
  const t = useTranslations();

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
        <UserMenu />
      </div>
    </header>
  );
}
