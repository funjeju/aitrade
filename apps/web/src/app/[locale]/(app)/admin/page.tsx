import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";
import { canAccessAdmin } from "@/lib/auth/roles";
import styles from "../page.module.css";

/**
 * 어드민 (Phase 0: 자리표시).
 * Edge 미들웨어가 1차 가드하지만, 서버에서도 role을 재확인한다(defense in depth, docs/06).
 */
export default async function AdminPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const role = await getCurrentRole();

  if (!canAccessAdmin(role)) {
    return <AdminForbidden />;
  }
  return <AdminView />;
}

function AdminView() {
  const t = useTranslations("nav");
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("admin")}</h1>
      </div>
    </div>
  );
}

function AdminForbidden() {
  const t = useTranslations("errors");
  return (
    <div className={styles.page}>
      <div className={styles.empty}>
        <h2 className={styles.emptyTitle}>{t("forbidden")}</h2>
      </div>
    </div>
  );
}
