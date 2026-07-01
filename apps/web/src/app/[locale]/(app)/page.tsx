import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { DashboardKpis } from "@/components/dashboard/DashboardKpis";
import styles from "./page.module.css";

/**
 * 대시보드. KPI는 로그인 사용자의 전략·저장된 백테스트(out-of-sample)를 집계한다.
 * 성과 수치에는 검증방식·표본을 병기한다(P3, docs/07 완료기준 6).
 */
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

      <DashboardKpis />

      <p className={styles.disclaimer}>{t("disclaimer")}</p>
    </div>
  );
}
