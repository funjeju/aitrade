"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import styles from "./Topbar.module.css";

export function UserMenu() {
  const t = useTranslations();
  const { configured, loading, user, role, signOut } = useAuth();

  if (!configured) {
    return (
      <div className={styles.user}>
        <span className={styles.avatar} aria-hidden>
          G
        </span>
        <span className={styles.userMeta}>
          <span className={styles.userName}>{t("auth.guest")}</span>
          <span className={styles.userRole}>{t("auth.role.user")}</span>
        </span>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.user}>
        <span className={styles.userMeta}>
          <span className={styles.userRole}>{t("common.loading")}</span>
        </span>
      </div>
    );
  }

  if (!user) {
    return (
      <Link href="/login" className={styles.authAction}>
        {t("auth.signIn")}
      </Link>
    );
  }

  const label = user.isAnonymous
    ? t("auth.anonymous")
    : (user.email ?? t("auth.guest"));
  const initial = (user.email ?? "A").charAt(0).toUpperCase();
  const roleLabel = role ? t(`auth.role.${role}`) : t("auth.role.user");

  return (
    <div className={styles.user}>
      <span className={styles.avatar} aria-hidden>
        {initial}
      </span>
      <span className={styles.userMeta}>
        <span className={styles.userName}>{label}</span>
        <span className={styles.userRole}>{roleLabel}</span>
      </span>
      <button
        type="button"
        className={`${styles.authAction} ${styles.signOut}`}
        onClick={() => void signOut()}
      >
        {t("auth.signOut")}
      </button>
    </div>
  );
}
