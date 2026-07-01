import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { BacktestPanel } from "@/components/backtest/BacktestPanel";
import styles from "../page.module.css";

export default async function BacktestPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <View />;
}

function View() {
  const nav = useTranslations("nav");
  const p = useTranslations("pages.backtest");
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{nav("backtest")}</h1>
        <p className={styles.subtitle}>{p("desc")}</p>
      </div>
      <BacktestPanel />
    </div>
  );
}
