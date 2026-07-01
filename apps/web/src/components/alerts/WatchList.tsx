"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  listScanMatches,
  deleteScanMatch,
  type SavedMatch,
} from "@/lib/scan/scanMatches";
import styles from "./WatchList.module.css";

type State =
  | { status: "loading" }
  | { status: "ready"; items: SavedMatch[] }
  | { status: "error" };

export function WatchList() {
  const t = useTranslations("pages.alerts");
  const locale = useLocale();
  const { configured, loading, user } = useAuth();
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    if (loading || !user) return;
    const db = getFirebaseDb();
    if (!db) {
      setState({ status: "error" });
      return;
    }
    let alive = true;
    listScanMatches(db, user.uid)
      .then((items) => alive && setState({ status: "ready", items }))
      .catch(() => alive && setState({ status: "error" }));
    return () => {
      alive = false;
    };
  }, [loading, user]);

  async function remove(id: string) {
    const db = getFirebaseDb();
    if (!db || state.status !== "ready") return;
    await deleteScanMatch(db, id).catch(() => {});
    setState({ status: "ready", items: state.items.filter((i) => i.id !== id) });
  }

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
      <div className={styles.info}>
        <span>{t("empty")}</span>
        <Link href="/scanner" className={styles.cta}>
          {t("goScanner")}
        </Link>
      </div>
    );
  }

  const nf = new Intl.NumberFormat(locale);
  const mf = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 0 });
  const df = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short" });

  return (
    <div className={styles.wrap}>
      <p className={styles.pushNote}>{t("pushSoon")}</p>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{t("colSymbol")}</th>
              <th>{t("colSignal")}</th>
              <th>{t("colMatch")}</th>
              <th>{t("colStrategy")}</th>
              <th>{t("colRef")}</th>
              <th>{t("colSaved")}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {state.items.map((m) => (
              <tr key={m.id}>
                <td className={styles.sym}>
                  {m.name ? `${m.name} (${m.code})` : m.code}
                </td>
                <td>
                  <SignalBadge signal={m.signal} />
                </td>
                <td>{mf.format(m.matchScore)}</td>
                <td>{m.strategyName}</td>
                <td>{m.context?.refCandleDate ?? "—"}</td>
                <td>{m.scannedAt ? df.format(m.scannedAt) : "—"}</td>
                <td>
                  <button className={styles.removeBtn} onClick={() => void remove(m.id)}>
                    {t("remove")}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SignalBadge({ signal }: { signal: SavedMatch["signal"] }) {
  const t = useTranslations("pages.scanner");
  if (signal === "BUY")
    return <span className={`${styles.badge} ${styles.buy}`}>{t("signalBuy")}</span>;
  if (signal === "WATCH")
    return <span className={`${styles.badge} ${styles.watch}`}>{t("signalWatch")}</span>;
  return <span className={`${styles.badge} ${styles.none}`}>{t("signalNone")}</span>;
}
