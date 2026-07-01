"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import styles from "./status.module.css";

/**
 * 로케일 내 에러 바운더리. 예기치 못한 렌더/데이터 오류를 잡아 복구 UI를 보인다.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    // 실서비스에선 여기서 관측 로그로 전송(관측 인프라 도입 시).
    console.error(error);
  }, [error]);

  return (
    <div className={styles.screen}>
      <span className={styles.code}>!</span>
      <p className={styles.message}>{t("generic")}</p>
      <div className={styles.actions}>
        <button type="button" className={styles.primary} onClick={() => reset()}>
          {t("retry")}
        </button>
      </div>
    </div>
  );
}
