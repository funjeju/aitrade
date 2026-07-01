"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { StrategyDSL } from "@ats/strategy-engine";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  getStrategy,
  getCurrentDsl,
  listVersions,
  type StrategyVersion,
} from "@/lib/strategy/strategies";
import { listBacktests, type SavedBacktest } from "@/lib/strategy/backtests";
import pageStyles from "@/app/[locale]/(app)/page.module.css";
import styles from "./StrategyDetail.module.css";

type Data = {
  name: string;
  currentVersion: string;
  versions: StrategyVersion[];
  dsl: StrategyDSL | null;
  backtests: SavedBacktest[];
};

type State =
  | { status: "loading" }
  | { status: "notfound" }
  | { status: "ready"; data: Data };

export function StrategyDetail({ strategyId }: { strategyId: string }) {
  const t = useTranslations("pages.strategies");
  const locale = useLocale();
  const { loading, user } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (loading || !user) return;
    const db = getFirebaseDb();
    if (!db) {
      setState({ status: "notfound" });
      return;
    }
    let alive = true;
    (async () => {
      const meta = await getStrategy(db, strategyId);
      if (!meta || meta.ownerUid !== user.uid) {
        if (alive) setState({ status: "notfound" });
        return;
      }
      const [versions, dsl, backtests] = await Promise.all([
        listVersions(db, strategyId),
        getCurrentDsl(db, strategyId),
        listBacktests(db, strategyId).catch(() => []),
      ]);
      if (alive)
        setState({
          status: "ready",
          data: { name: meta.name, currentVersion: meta.currentVersion, versions, dsl, backtests },
        });
    })().catch(() => alive && setState({ status: "notfound" }));
    return () => {
      alive = false;
    };
  }, [loading, user, strategyId]);

  const df = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });
  const pf = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });

  if (state.status === "loading") {
    return <p className={styles.info}>{t("loading")}</p>;
  }
  if (state.status === "notfound") {
    return (
      <div className={styles.wrap}>
        <Link href="/strategies" className={styles.back}>
          {t("back")}
        </Link>
        <p className={styles.info}>{t("notFound")}</p>
      </div>
    );
  }

  const { data } = state;

  return (
    <div className={pageStyles.page}>
      <Link href="/strategies" className={styles.back}>
        {t("back")}
      </Link>
      <div className={pageStyles.header}>
        <h1 className={pageStyles.title}>{data.name}</h1>
      </div>

      <div className={styles.wrap}>
        <div className={styles.section}>
          <span className={styles.sectionTitle}>{t("versionHistory")}</span>
          <div className={styles.timeline}>
            {data.versions.map((v) => (
              <div key={v.version} className={styles.vItem}>
                <span
                  className={`${styles.vBadge} ${v.version === data.currentVersion ? styles.vCurrent : ""}`}
                >
                  {v.version}
                  {v.version === data.currentVersion ? ` · ${t("current")}` : ""}
                </span>
                <span className={styles.vBody}>
                  <span className={styles.vSummary}>{v.changeSummary}</span>
                  <span className={styles.vMeta}>
                    {v.parentVersion ? t("parentOf", { v: v.parentVersion }) + " · " : ""}
                    {v.createdAt ? df.format(v.createdAt) : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <span className={styles.sectionTitle}>{t("backtestsTitle")}</span>
          {data.backtests.length === 0 ? (
            <span className={styles.muted}>{t("noBacktests")}</span>
          ) : (
            data.backtests.map((b) => (
              <div key={b.id} className={styles.btRow}>
                <span>{b.createdAt ? df.format(b.createdAt) : "—"}</span>
                <span>{b.source === "kiwoom" ? (b.symbol ?? "kiwoom") : "sample"}</span>
                <span>
                  {t("btOut")}: <b>{pf.format(b.outOfSample?.winRate ?? 0)}</b> · {t("btTrades")}{" "}
                  {b.outOfSample?.tradeCount ?? 0}
                </span>
              </div>
            ))
          )}
        </div>

        {data.dsl && (
          <div className={styles.section}>
            <span className={styles.sectionTitle}>{t("dslTitle")}</span>
            <pre className={styles.code}>{JSON.stringify(data.dsl, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}
