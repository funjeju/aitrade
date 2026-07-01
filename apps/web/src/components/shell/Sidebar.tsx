"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_ITEMS } from "@/config/nav";
import { canAccessAdmin, type Role } from "@/lib/auth/roles";
import styles from "./Sidebar.module.css";

export function Sidebar({ role }: { role: Role | null }) {
  const t = useTranslations();
  const pathname = usePathname();

  const items = NAV_ITEMS.filter((item) => {
    if (item.requiresRole === "admin") return canAccessAdmin(role);
    return true;
  });

  return (
    <aside className={styles.sidebar}>
      <div className={styles.brand}>
        <span className={styles.brandName}>{t("common.appName")}</span>
        <span className={styles.brandTagline}>{t("common.appTagline")}</span>
      </div>
      <nav className={styles.nav}>
        {items.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.key}
              href={item.href}
              className={`${styles.item} ${active ? styles.itemActive : ""}`}
              aria-current={active ? "page" : undefined}
            >
              <span className={styles.dot} aria-hidden />
              {t(item.labelKey)}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
