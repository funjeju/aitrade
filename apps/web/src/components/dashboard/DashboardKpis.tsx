"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { listStrategies } from "@/lib/strategy/strategies";
import { listBacktests } from "@/lib/strategy/backtests";
import type { BacktestMetrics } from "@ats/strategy-engine";
import styles from "@/app/[locale]/(app)/page.module.css";

type Agg = {
  strategyCount: number;
  backtestCount: number;
  winRate: number | null;
  avgReturn: number | null;
  mdd: number | null; // worst
  holdingBars: number | null;
};

type PerfRow = {
  id: string;
  name: string;
  winRate: number;
  avgReturn: number;
  tradeCount: number;
};

type State =
  | { status: "guest" }
  | { status: "loading" }
  | { status: "ready"; agg: Agg; rows: PerfRow[] }
  | { status: "error" };

export function DashboardKpis() {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const { configured, loading, user } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (loading) return;
    if (!configured || !user) {
      setState({ status: "guest" });
      return;
    }
    const db = getFirebaseDb();
    if (!db) {
      setState({ status: "error" });
      return;
    }
    let alive = true;
    (async () => {
      const strategies = await listStrategies(db, user.uid);
      // 전략별 최신 백테스트의 out-of-sample 지표 수집
      const latest: BacktestMetrics[] = [];
      const rows: PerfRow[] = [];
      for (const s of strategies) {
        const bts = await listBacktests(db, s.id).catch(() => []);
        const oos = bts[0]?.outOfSample;
        if (oos) {
          latest.push(oos);
          rows.push({
            id: s.id,
            name: s.name,
            winRate: oos.winRate,
            avgReturn: oos.avgReturn,
            tradeCount: oos.tradeCount,
          });
        }
      }
      const n = latest.length;
      const mean = (f: (m: BacktestMetrics) => number) =>
        n === 0 ? null : latest.reduce((a, m) => a + f(m), 0) / n;
      const agg: Agg = {
        strategyCount: strategies.length,
        backtestCount: n,
        winRate: mean((m) => m.winRate),
        avgReturn: mean((m) => m.avgReturn),
        mdd: n === 0 ? null : Math.min(...latest.map((m) => m.mdd)),
        holdingBars: mean((m) => m.avgHoldingBars),
      };
      rows.sort((a, b) => b.winRate - a.winRate);
      if (alive) setState({ status: "ready", agg, rows });
    })().catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [loading, configured, user]);

  const pf = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });

  const dash = "—";
  const agg = state.status === "ready" ? state.agg : null;
  const rows = state.status === "ready" ? state.rows : [];

  const cards: Array<{ key: string; value: string }> = [
    { key: "strategies", value: agg ? String(agg.strategyCount) : dash },
    { key: "winRate", value: agg?.winRate != null ? pf.format(agg.winRate) : dash },
    { key: "avgReturn", value: agg?.avgReturn != null ? pf.format(agg.avgReturn) : dash },
    { key: "mdd", value: agg?.mdd != null ? pf.format(agg.mdd) : dash },
    { key: "holdingDays", value: agg?.holdingBars != null ? nf.format(agg.holdingBars) : dash },
  ];

  const showEmpty = agg != null && agg.strategyCount === 0;

  return (
    <>
      <section className={styles.kpiRow} aria-label={t("title")}>
        {cards.map((c) => (
          <div key={c.key} className={styles.kpiCard}>
            <span className={styles.kpiLabel}>{t(`kpi.${c.key}`)}</span>
            <span className={`${styles.kpiValue} tabular`}>{c.value}</span>
          </div>
        ))}
      </section>

      {state.status === "guest" && <p className={styles.kpiMeta}>{t("guestHint")}</p>}
      {agg != null && agg.backtestCount > 0 && (
        <p className={styles.kpiMeta}>{t("kpiMeta", { n: agg.backtestCount })}</p>
      )}
      {agg != null && agg.strategyCount > 0 && agg.backtestCount === 0 && (
        <p className={styles.kpiMeta}>{t("kpiNoBacktest")}</p>
      )}

      {rows.length > 0 && (
        <section className={styles.perf}>
          <div className={styles.perfHead}>{t("perfTitle")}</div>
          {rows.map((r) => (
            <Link key={r.id} href={`/strategies/${r.id}`} className={styles.perfRow}>
              <span className={styles.perfName}>{r.name}</span>
              <span className={styles.perfBarWrap}>
                <span
                  className={styles.perfBar}
                  style={{ width: `${Math.round(r.winRate * 100)}%` }}
                />
              </span>
              <span className={`${styles.perfWin} tabular`}>{pf.format(r.winRate)}</span>
              <span className={`${styles.perfMeta} tabular`}>
                {t("perfReturn")} {pf.format(r.avgReturn)} · {r.tradeCount} {t("perfTrades")}
              </span>
            </Link>
          ))}
        </section>
      )}

      {agg != null && agg.strategyCount > 0 && (
        <nav className={styles.quick} aria-label={t("quickLinks")}>
          <Link href="/scanner" className={styles.quickLink}>
            {t("goScanner")}
          </Link>
          <Link href="/ai-chat" className={styles.quickLink}>
            {t("goChat")}
          </Link>
          <Link href="/alerts" className={styles.quickLink}>
            {t("goWatch")}
          </Link>
        </nav>
      )}

      {(state.status === "guest" || showEmpty) && (
        <section className={styles.empty}>
          <h2 className={styles.emptyTitle}>{t("empty.title")}</h2>
          <p className={styles.emptyBody}>{t("empty.body")}</p>
          <Link href="/ai-chat" className={styles.cta}>
            {t("empty.cta")}
          </Link>
        </section>
      )}
    </>
  );
}
