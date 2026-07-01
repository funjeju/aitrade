"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import styles from "./KiwoomPanel.module.css";

type Props = {
  configured: boolean;
  env: "mock" | "real" | null;
};

type TestState =
  | { status: "idle" }
  | { status: "testing" }
  | { status: "ok"; expiresAt: number }
  | { status: "fail"; message: string };

export function KiwoomPanel({ configured, env }: Props) {
  const t = useTranslations("settings.kiwoom");
  const locale = useLocale();
  const [state, setState] = useState<TestState>({ status: "idle" });

  async function runTest() {
    setState({ status: "testing" });
    try {
      const res = await fetch("/api/kiwoom/status", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.connected) {
        setState({ status: "ok", expiresAt: data.expiresAt });
      } else {
        setState({ status: "fail", message: data.message ?? `HTTP ${res.status}` });
      }
    } catch (e) {
      setState({ status: "fail", message: e instanceof Error ? e.message : "error" });
    }
  }

  const envLabel = env === "real" ? t("envReal") : t("envMock");

  return (
    <div className={styles.card}>
      <div className={styles.head}>
        <h2 className={styles.title}>{t("title")}</h2>
        <p className={styles.desc}>{t("desc")}</p>
      </div>

      <div className={styles.rows}>
        <div className={styles.row}>
          <span className={styles.label}>{t("env")}</span>
          <span className={`${styles.badge} ${styles.badgeEnv}`}>{envLabel}</span>
        </div>
        <div className={styles.row}>
          <span className={styles.label}>{t("status")}</span>
          {configured ? (
            <span className={`${styles.badge} ${styles.badgeOk}`}>{t("configured")}</span>
          ) : (
            <span className={`${styles.badge} ${styles.badgeWarn}`}>{t("notConfigured")}</span>
          )}
        </div>
      </div>

      {configured ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={runTest}
            disabled={state.status === "testing"}
          >
            {state.status === "testing" ? t("testing") : t("test")}
          </button>
          {state.status === "ok" && (
            <span className={`${styles.result} ${styles.resultOk}`}>
              ✓ {t("connected")} · {t("expiresAt")}{" "}
              <span className={styles.mono}>
                {new Intl.DateTimeFormat(locale, {
                  dateStyle: "short",
                  timeStyle: "short",
                }).format(state.expiresAt)}
              </span>
            </span>
          )}
          {state.status === "fail" && (
            <span className={`${styles.result} ${styles.resultFail}`}>
              ✗ {t("failed")} · {state.message}
            </span>
          )}
        </div>
      ) : (
        <p className={styles.help}>{t("notConfiguredHelp")}</p>
      )}
    </div>
  );
}
