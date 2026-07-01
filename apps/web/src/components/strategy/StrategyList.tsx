"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { listStrategies, type StrategySummary } from "@/lib/strategy/strategies";
import styles from "./StrategyList.module.css";

type LoadState =
  | { status: "loading" }
  | { status: "ready"; items: StrategySummary[] }
  | { status: "error" };

export function StrategyList() {
  const t = useTranslations("pages.strategies");
  const locale = useLocale();
  const { configured, loading, user } = useAuth();
  const [state, setState] = useState<LoadState>({ status: "loading" });

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const db = getFirebaseDb();
    if (!db) {
      setState({ status: "error" });
      return;
    }
    let alive = true;
    listStrategies(db, user.uid)
      .then((items) => alive && setState({ status: "ready", items }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [loading, user]);

  if (!configured || (!loading && !user)) {
    return (
      <div className={styles.info}>
        <span>{t("needLogin")}</span>
        <Link href="/login" className={styles.cta}>
          {t("needLogin")}
        </Link>
      </div>
    );
  }

  if (loading || state.status === "loading") {
    return <div className={styles.info}>{t("loading")}</div>;
  }

  if (state.status === "error") {
    return <p className={styles.err}>{t("loadFailed")}</p>;
  }

  if (state.items.length === 0) {
    return (
      <div className={styles.empty}>
        <span>{t("empty")}</span>
        <Link href="/ai-chat" className={styles.cta}>
          {t("goChat")}
        </Link>
      </div>
    );
  }

  const fmt = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className={styles.list}>
      {state.items.map((s) => (
        <div key={s.id} className={styles.item}>
          <div>
            <div className={styles.name}>{s.name}</div>
            <div className={styles.meta}>
              {s.description && <span>{s.description}</span>}
              {s.updatedAt && (
                <span>
                  {t("updated")} {fmt.format(s.updatedAt)}
                </span>
              )}
            </div>
          </div>
          <span className={styles.badge}>
            {t("version")} {s.currentVersion}
          </span>
        </div>
      ))}
    </div>
  );
}
