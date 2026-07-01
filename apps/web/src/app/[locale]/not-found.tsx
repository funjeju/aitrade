import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import styles from "./status.module.css";

/**
 * 로케일 내 404. [locale]/layout의 프로바이더 안에서 렌더되어 i18n·토큰을 쓴다.
 */
export default function NotFound() {
  const t = useTranslations();
  return (
    <div className={styles.screen}>
      <span className={styles.code}>404</span>
      <p className={styles.message}>{t("errors.notFound")}</p>
      <div className={styles.actions}>
        <Link href="/" className={styles.primary}>
          {t("nav.dashboard")}
        </Link>
      </div>
    </div>
  );
}
