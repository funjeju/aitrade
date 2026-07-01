"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import {
  walkForwardBacktest,
  type BacktestMetrics,
  type WalkForwardResult,
} from "@ats/strategy-engine";
import { makeSampleCandles, SAMPLE_DSL } from "@/lib/backtest/sampleData";
import styles from "./BacktestPanel.module.css";

/**
 * 백테스트 실행 패널 (샘플 데이터, 클라이언트에서 순수 엔진 실행).
 * in/out-of-sample 지표를 나란히, 검증방식·기간·표본·가정과 함께 표시(backtest-guard #6).
 */
export function BacktestPanel() {
  const t = useTranslations("pages.backtest");
  const [result, setResult] = useState<WalkForwardResult | null>(null);
  const [busy, setBusy] = useState(false);

  function run() {
    setBusy(true);
    // 결정적 샘플 데이터 → 순수 엔진. (setTimeout으로 버튼 상태 반영)
    setTimeout(() => {
      const candles = makeSampleCandles(250, 42);
      const wf = walkForwardBacktest(candles, SAMPLE_DSL, {
        inSampleRatio: 0.7,
        universeHadDelisted: false,
      });
      setResult(wf);
      setBusy(false);
    }, 10);
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.controls}>
        <button className={styles.runBtn} onClick={run} disabled={busy}>
          {busy ? t("running") : t("run")}
        </button>
        <span className={styles.sampleBadge}>{t("sampleBadge")}</span>
      </div>
      <p className={styles.note}>{t("sampleNote")}</p>

      {result && <Results result={result} />}
    </div>
  );
}

function Results({ result }: { result: WalkForwardResult }) {
  const t = useTranslations("pages.backtest");
  const locale = useLocale();
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });

  return (
    <>
      <div className={styles.metaRow}>
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
