"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  walkForwardBacktest,
  type BacktestMetrics,
  type Candle,
  type WalkForwardResult,
} from "@ats/strategy-engine";
import { makeSampleCandles, SAMPLE_DSL } from "@/lib/backtest/sampleData";
import styles from "./BacktestPanel.module.css";

type Source = "sample" | "kiwoom";

/**
 * 백테스트 실행 패널. 순수 엔진은 클라이언트에서 실행.
 * 데이터 소스: 샘플(데모) 또는 키움 실데이터(일봉 API).
 * in/out-of-sample 지표를 나란히, 검증방식·기간·표본·가정과 함께 표시(backtest-guard #6).
 */
export function BacktestPanel() {
  const t = useTranslations("pages.backtest");
  const [source, setSource] = useState<Source>("sample");
  const [symbol, setSymbol] = useState("005930");
  const [result, setResult] = useState<WalkForwardResult | null>(null);
  const [busy, setBusy] = useState<false | "fetching" | "running">(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setError(null);
    setResult(null);
    let candles: Candle[];

    if (source === "kiwoom") {
      const code = symbol.replace(/\D/g, "");
      if (code.length !== 6) {
        setError(t("fetchFailed"));
        return;
      }
      setBusy("fetching");
      try {
        const res = await fetch(`/api/kiwoom/candles?code=${code}&count=400`);
        const data = await res.json();
        if (!res.ok) {
          setError(data?.message || t("fetchFailed"));
          setBusy(false);
          return;
        }
        candles = data.candles as Candle[];
      } catch {
        setError(t("fetchFailed"));
        setBusy(false);
        return;
      }
    } else {
      candles = makeSampleCandles(250, 42);
    }

    setBusy("running");
    const wf = walkForwardBacktest(candles, SAMPLE_DSL, {
      inSampleRatio: 0.7,
      universeHadDelisted: false,
    });
    setResult(wf);
    setBusy(false);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <div className={styles.sourceGroup} role="group">
          <button
            type="button"
            className={`${styles.sourceBtn} ${source === "sample" ? styles.sourceActive : ""}`}
            onClick={() => setSource("sample")}
          >
            {t("sourceSample")}
          </button>
          <button
            type="button"
            className={`${styles.sourceBtn} ${source === "kiwoom" ? styles.sourceActive : ""}`}
            onClick={() => setSource("kiwoom")}
          >
            {t("sourceKiwoom")}
          </button>
        </div>

        {source === "kiwoom" && (
          <input
            className={styles.symbolInput}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder={t("symbolPlaceholder")}
            aria-label={t("symbol")}
            inputMode="numeric"
            maxLength={6}
          />
        )}

        <button className={styles.runBtn} onClick={() => void run()} disabled={Boolean(busy)}>
          {busy === "fetching" ? t("fetching") : busy === "running" ? t("running") : t("run")}
        </button>

        <span className={source === "kiwoom" ? styles.realBadge : styles.sampleBadge}>
          {source === "kiwoom" ? t("realBadge") : t("sampleBadge")}
        </span>
      </div>

      <p className={styles.note}>{source === "kiwoom" ? t("realNote") : t("sampleNote")}</p>
      {error && <p className={styles.err}>{error}</p>}

      {result && <Results result={result} source={source} symbol={symbol} />}
    </div>
  );
}

function Results({
  result,
  source,
  symbol,
}: {
  result: WalkForwardResult;
  source: Source;
  symbol: string;
}) {
  const t = useTranslations("pages.backtest");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  return (
    <>
      <div className={styles.metaRow}>
        <span>
          {source === "kiwoom" ? t("sourceKiwoom") : t("sourceSample")}
          {source === "kiwoom" ? <b> · {symbol}</b> : null}
        </span>
        <span>
          {t("method")}: <b>{t("walkForward")}</b>
        </span>
        <span>
          {t("period")}: <b>{result.period.from} ~ {result.period.to}</b>
        </span>
        <span>
          {t("assumptions")}: <b>
            {t("fee")} {(result.assumptions.feeRate * 100).toFixed(3)}% · {t("slippage")}{" "}
            {(result.assumptions.slippageRate * 100).toFixed(2)}%
          </b>
        </span>
      </div>

      <div className={styles.cols}>
        <MetricCard
          title={t("inSample")}
          bars={result.split.inSampleBars}
          metrics={result.inSample}
        />
        <MetricCard
          title={t("outOfSample")}
          bars={result.split.outOfSampleBars}
          metrics={result.outOfSample}
          highlight
        />
      </div>

      {result.warnings.length > 0 && (
        <div className={styles.warnBox}>
          {t("warnings")}:
          <ul>
            {result.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <p className={styles.disclaimer}>{t("disclaimer")}</p>
    </>
  );

  function MetricCard({
    title,
    bars,
    metrics,
    highlight,
  }: {
    title: string;
    bars: number;
    metrics: BacktestMetrics;
    highlight?: boolean;
  }) {
    const rows: Array<[string, string, "pos" | "neg" | "none"]> = [
      [t("metricWinRate"), `${nf.format(metrics.winRate * 100)}%`, "none"],
      [
        t("metricAvgReturn"),
        `${nf.format(metrics.avgReturn * 100)}%`,
        metrics.avgReturn >= 0 ? "pos" : "neg",
      ],
      [t("metricMdd"), `${nf.format(metrics.mdd * 100)}%`, "neg"],
      [t("metricHolding"), nf.format(metrics.avgHoldingBars), "none"],
      [t("metricTrades"), String(metrics.tradeCount), "none"],
      [t("samples"), `${bars}`, "none"],
    ];
    return (
      <div className={styles.card}>
        <div className={`${styles.cardHead} ${highlight ? styles.cardHeadOut : ""}`}>
          {title}
        </div>
        {rows.map(([label, value, tone]) => (
          <div key={label} className={styles.metric}>
            <span className={styles.metricLabel}>{label}</span>
            <span
              className={`${styles.metricValue} ${
                tone === "pos" ? styles.pos : tone === "neg" ? styles.neg : ""
              }`}
            >
              {value}
            </span>
          </div>
        ))}
      </div>
    );
  }
}
