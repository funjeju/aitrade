import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { ScannerPanel } from "@/components/scanner/ScannerPanel";
import styles from "../page.module.css";

export default async function ScannerPage({
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
  const p = useTranslations("pages.scanner");
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{nav("scanner")}</h1>
        <p className={styles.subtitle}>{p("desc")}</p>
      </div>
      <ScannerPanel />
    </div>
  );
}
