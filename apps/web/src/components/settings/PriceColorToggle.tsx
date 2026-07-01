"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { doc, setDoc } from "firebase/firestore";
import {
  applyPriceColor,
  getPriceColor,
  type PriceColorMode,
} from "@/lib/prefs/priceColor";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import styles from "./PriceColorToggle.module.css";

/**
 * 등락색 모드 설정. 로컬 우선(localStorage) + 로그인 시 Firestore write-through.
 * data-price 속성 교체로 --price-up/--price-down 토큰이 바뀐다.
 */
export function PriceColorToggle() {
  const t = useTranslations("settings.priceColor");
  const { user } = useAuth();
  const [mode, setMode] = useState<PriceColorMode>("kr");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMode(getPriceColor());
    setMounted(true);
  }, []);

  function choose(next: PriceColorMode) {
    setMode(next);
    applyPriceColor(next);
    if (user) {
      const db = getFirebaseDb();
      if (db) {
        void setDoc(
          doc(db, "users", user.uid),
          { priceColorMode: next },
          { merge: true },
        ).catch(() => {});
      }
    }
  }

  const options: Array<{ key: PriceColorMode; label: string }> = [
    { key: "kr", label: t("kr") },
    { key: "us", label: t("us") },
  ];

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t("title")}</h2>
        <p className={styles.desc}>{t("desc")}</p>
      </div>

      <div className={styles.options}>
        {options.map((o) => {
          const active = mounted && mode === o.key;
          return (
            <button
              key={o.key}
              type="button"
              className={`${styles.option} ${active ? styles.optionActive : ""}`}
              onClick={() => choose(o.key)}
              aria-pressed={active}
            >
              {o.label}
              {active && <span className={styles.check}>✓</span>}
            </button>
          );
        })}
      </div>

      <div className={styles.preview}>
        <span className={styles.previewLabel}>{t("preview")}</span>
        <span className={`${styles.up} tabular`}>{t("up")}</span>
        <span className={`${styles.down} tabular`}>{t("down")}</span>
      </div>
    </div>
  );
}
