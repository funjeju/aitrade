import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import styles from "./page.module.css";

/**
 * 대시보드 (Phase 0: 빈 상태).
 * KPI는 아직 데이터가 없어 "—"로 표시한다. 성과 수치가 실제로 들어오면
 * 기간·표본·검증방식을 함께 표기해야 한다(P3, docs/07 완료기준 6).
 */
const KPI_KEYS = [
  "strategies",
  "winRate",
  "avgReturn",
  "mdd",
  "holdingDays",
] as const;

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardView />;
}

function DashboardView() {
  const t = useTranslations("dashboard");

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>

      <section className={styles.kpiRow} aria-label={t("title")}>
        {KPI_KEYS.map((key) => (
          <div key={key} className={styles.kpiCard}>
            <span className={styles.kpiLabel}>{t(`kpi.${key}`)}</span>
            <span className={`${styles.kpiValue} tabular`}>—</span>
          </div>
        ))}
      </section>

      <section className={styles.empty}>
        <h2 className={styles.emptyTitle}>{t("empty.title")}</h2>
        <p className={styles.emptyBody}>{t("empty.body")}</p>
        <button type="button" className={styles.cta}>
          {t("empty.cta")}
        </button>
      </section>

      <p className={styles.disclaimer}>{t("disclaimer")}</p>
    </div>
  );
}
