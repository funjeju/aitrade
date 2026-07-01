import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { StrategyList } from "@/components/strategy/StrategyList";
import styles from "../page.module.css";

export default async function StrategiesPage({
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
  const p = useTranslations("pages.strategies");
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{nav("strategies")}</h1>
        <p className={styles.subtitle}>{p("desc")}</p>
      </div>
      <StrategyList />
    </div>
  );
}
