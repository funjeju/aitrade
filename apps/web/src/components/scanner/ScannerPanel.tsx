"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  validateStrategyDSL,
  type ScanResult,
  type StrategyDSL,
} from "@ats/strategy-engine";
import { SAMPLE_DSL } from "@/lib/backtest/sampleData";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  listStrategies,
  getCurrentDsl,
  type StrategySummary,
} from "@/lib/strategy/strategies";
import styles from "./ScannerPanel.module.css";

type ScanRow = ScanResult & { code: string };

const DEFAULT_CODES = "005930, 000660, 035420, 035720, 247540";

export function ScannerPanel() {
  const t = useTranslations("pages.scanner");
  const locale = useLocale();
  const { user } = useAuth();

  const [strategyId, setStrategyId] = useState("sample");
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [codes, setCodes] = useState(DEFAULT_CODES);
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setStrategies([]);
      setStrategyId("sample");
      return;
    }
    const db = getFirebaseDb();
    if (!db) return;
    let alive = true;
    listStrategies(db, user.uid)
      .then((items) => alive && setStrategies(items))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  async function resolveDsl(): Promise<StrategyDSL | null> {
    if (strategyId === "sample") return SAMPLE_DSL;
    const db = getFirebaseDb();
    if (!db) return null;
    const dsl = await getCurrentDsl(db, strategyId);
    return dsl && validateStrategyDSL(dsl).ok ? dsl : null;
  }

  async function run() {
    setError(null);
    setRows(null);
    const dsl = await resolveDsl();
    if (!dsl) {
      setError(t("loadDslFailed"));
      return;
    }
    const codeList = codes
      .split(/[\s,]+/)
      .map((c) => c.replace(/\D/g, ""))
      .filter((c) => c.length === 6);
    if (codeList.length === 0) return;

    setBusy(true);
    try {
      const res = await fetch("/api/kiwoom/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codes: codeList, dsl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || t("runFailed"));
      } else {
        setRows(data.matches as ScanRow[]);
        setScannedAt(data.scannedAt);
        setFailCount(Array.isArray(data.errors) ? data.errors.length : 0);
      }
    } catch {
      setError(t("runFailed"));
    } finally {
      setBusy(false);
    }
  }

  const nf = new Intl.NumberFormat(locale);
  const pf = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 2,
    signDisplay: "exceptZero",
  });
  const mf = new Intl.NumberFormat(locale, {
    style: "percent",
    maximumFractionDigits: 0,
  });

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <div className={styles.row}>
          {strategies.length > 0 && (
            <select
              className={styles.select}
              value={strategyId}
              onChange={(e) => setStrategyId(e.target.value)}
              aria-label={t("strategyLabel")}
            >
              <option value="sample">{t("sampleStrategy")}</option>
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>
        <label className={styles.label} htmlFor="codes">
          {t("codesLabel")}
        </label>
        <textarea
          id="codes"
          className={styles.textarea}
          rows={2}
          value={codes}
          onChange={(e) => setCodes(e.target.value)}
        />
        <button className={styles.runBtn} onClick={() => void run()} disabled={busy}>
          {busy ? t("running") : t("run")}
        </button>
      </div>

      {error && <p className={styles.err}>{error}</p>}
      {failCount > 0 && <p className={styles.meta}>{t("errorsSome", { n: failCount })}</p>}

      {rows && (
        <>
          {scannedAt && (
            <p className={styles.meta}>
              {t("scannedAt")}:{" "}
              {new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "medium" }).format(
                new Date(scannedAt),
              )}
            </p>
          )}
          {rows.length === 0 ? (
            <p className={styles.meta}>{t("noResults")}</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>{t("colSymbol")}</th>
                    <th>{t("colPrice")}</th>
                    <th>{t("colChange")}</th>
                    <th>{t("colVolume")}</th>
                    <th>{t("colMatch")}</th>
                    <th>{t("colSignal")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.code}>
                      <td className={styles.sym}>{r.code}</td>
                      <td>{nf.format(r.price)}</td>
                      <td className={r.changePct >= 0 ? styles.up : styles.down}>
                        {pf.format(r.changePct)}
                      </td>
                      <td>{nf.format(r.volume)}</td>
                      <td>{mf.format(r.matchScore)}</td>
                      <td>
                        <SignalBadge signal={r.signal} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <p className={styles.disclaimer}>{t("disclaimer")}</p>
    </div>
  );
}

function SignalBadge({ signal }: { signal: ScanResult["signal"] }) {
  const t = useTranslations("pages.scanner");
  if (signal === "BUY")
    return <span className={`${styles.badge} ${styles.buy}`}>{t("signalBuy")}</span>;
  if (signal === "WATCH")
    return <span className={`${styles.badge} ${styles.watch}`}>{t("signalWatch")}</span>;
  return <span className={`${styles.badge} ${styles.none}`}>{t("signalNone")}</span>;
}
