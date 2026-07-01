import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { WatchList } from "@/components/alerts/WatchList";
import styles from "../page.module.css";

export default async function AlertsPage({
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
  const p = useTranslations("pages.alerts");
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{nav("alerts")}</h1>
        <p className={styles.subtitle}>{p("desc")}</p>
      </div>
      <WatchList />
    </div>
  );
}
