import { useTranslations } from "next-intl";
import styles from "./PhasePage.module.css";
import pageStyles from "@/app/[locale]/(app)/page.module.css";

/**
 * 아직 완성되지 않은 화면의 일관된 자리표시.
 * 404 대신 셸 안에서 제대로 렌더링되고, 어느 Phase 기능인지 정직하게 표기한다.
 */
export function PhasePage({
  title,
  desc,
  phase,
  note,
}: {
  title: string;
  desc: string;
  phase: string;
  note?: string;
}) {
  const t = useTranslations("pages");
  return (
    <div className={pageStyles.page}>
      <div className={pageStyles.header}>
        <div className={styles.titleRow}>
          <h1 className={pageStyles.title}>{title}</h1>
          <span className={styles.badge}>{t("phaseBadge", { n: phase })}</span>
          <span className={styles.soon}>{t("comingSoon")}</span>
        </div>
        <p className={pageStyles.subtitle}>{desc}</p>
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </div>
  );
}
