"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  validateStrategyDSL,
  type Candle,
  type ScanResult,
  type StrategyDSL,
} from "@ats/strategy-engine";
import { SAMPLE_DSL } from "@/lib/backtest/sampleData";
import { ChartPreview } from "@/components/chart/ChartPreview";
import { StockPicker } from "./StockPicker";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  listStrategies,
  getCurrentDsl,
  type StrategySummary,
} from "@/lib/strategy/strategies";
import { saveScanMatch } from "@/lib/scan/scanMatches";
import styles from "./ScannerPanel.module.css";

type ScanRow = ScanResult & { code: string };

const DEFAULT_CODES = ["005930", "000660", "035420", "035720", "247540"];
const DEFAULT_NAMES: Record<string, string> = {
  "005930": "삼성전자",
  "000660": "SK하이닉스",
  "035420": "NAVER",
  "035720": "카카오",
  "247540": "에코프로비엠",
};

export function ScannerPanel() {
  const t = useTranslations("pages.scanner");
  const locale = useLocale();
  const { user } = useAuth();

  const [strategyId, setStrategyId] = useState("sample");
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [codes, setCodes] = useState<string[]>(DEFAULT_CODES);
  const [names, setNames] = useState<Record<string, string>>(DEFAULT_NAMES);
  const [rows, setRows] = useState<ScanRow[] | null>(null);
  const [scannedAt, setScannedAt] = useState<string | null>(null);
  const [failCount, setFailCount] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 선택 종목 차트
  const [usedDsl, setUsedDsl] = useState<StrategyDSL | null>(null);
  const [usedStrategyName, setUsedStrategyName] = useState("");
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [chartCandles, setChartCandles] = useState<Candle[] | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [savedCodes, setSavedCodes] = useState<Set<string>>(new Set());

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
    const codeList = codes.filter((c) => /^\d{6}$/.test(c));
    if (codeList.length === 0) return;

    setBusy(true);
    setSelectedCode(null);
    setChartCandles(null);
    setSavedCodes(new Set());
    setUsedStrategyName(
      strategyId === "sample"
        ? t("sampleStrategy")
        : (strategies.find((s) => s.id === strategyId)?.name ?? strategyId),
    );
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
        setUsedDsl(dsl);
      }
    } catch {
      setError(t("runFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function saveMatch(row: ScanRow) {
    if (!user) return;
    const db = getFirebaseDb();
    if (!db) return;
    try {
      await saveScanMatch(db, user.uid, {
        code: row.code,
        name: names[row.code] ?? row.code,
        result: row,
        strategyName: usedStrategyName,
      });
      setSavedCodes((prev) => new Set(prev).add(row.code));
    } catch {
      /* 무시 — 저장만 실패 */
    }
  }

  async function selectRow(code: string) {
    if (selectedCode === code) {
      setSelectedCode(null);
      return;
    }
    setSelectedCode(code);
    setChartCandles(null);
    setChartLoading(true);
    try {
      const res = await fetch(`/api/kiwoom/candles?code=${code}&count=120`);
      const data = await res.json();
      if (res.ok) setChartCandles(data.candles as Candle[]);
    } catch {
      /* 무시 — 차트만 안 뜸 */
    } finally {
      setChartLoading(false);
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
        <StockPicker
          value={codes}
          names={names}
          onChange={(c, n) => {
            setCodes(c);
            setNames(n);
          }}
          max={20}
        />
        <button
          className={styles.runBtn}
          onClick={() => void run()}
          disabled={busy || codes.length === 0}
        >
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
                    <th>{t("colSave")}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr
                      key={r.code}
                      className={`${styles.rowClickable} ${selectedCode === r.code ? styles.rowSelected : ""}`}
                      onClick={() => void selectRow(r.code)}
                    >
                      <td className={styles.sym}>
                        {names[r.code] ? `${names[r.code]} (${r.code})` : r.code}
                      </td>
                      <td>{nf.format(r.price)}</td>
                      <td className={r.changePct >= 0 ? styles.up : styles.down}>
                        {pf.format(r.changePct)}
                      </td>
                      <td>{nf.format(r.volume)}</td>
                      <td>{mf.format(r.matchScore)}</td>
                      <td>
                        <SignalBadge signal={r.signal} />
                      </td>
                      <td>
                        {!user ? (
                          <span className={styles.saveDisabled}>{t("saveNeedLogin")}</span>
                        ) : savedCodes.has(r.code) ? (
                          <span className={styles.savedTag}>✓ {t("saved")}</span>
                        ) : (
                          <button
                            type="button"
                            className={styles.saveBtn}
                            onClick={(e) => {
                              e.stopPropagation();
                              void saveMatch(r);
                            }}
                          >
                            {t("save")}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {selectedCode && (
        <div>
          {chartLoading && <p className={styles.meta}>{t("colSymbol")} {selectedCode} · …</p>}
          {chartCandles && usedDsl && (
            <ChartPreview candles={chartCandles} dsl={usedDsl} />
          )}
        </div>
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
