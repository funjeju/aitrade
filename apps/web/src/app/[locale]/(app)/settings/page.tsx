import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { getKiwoomConfig } from "@/lib/kiwoom/config";
import { KiwoomPanel } from "@/components/settings/KiwoomPanel";
import { PriceColorToggle } from "@/components/settings/PriceColorToggle";
import styles from "../page.module.css";

/**
 * 설정 페이지. Phase 0/2 골격: 키움 연동 상태/테스트.
 * 설정 여부는 서버에서 판단(키 자체는 클라이언트로 안 넘김).
 */
export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const config = getKiwoomConfig();
  return (
    <SettingsView configured={Boolean(config)} env={config?.env ?? "mock"} />
  );
}

function SettingsView({
  configured,
  env,
}: {
  configured: boolean;
  env: "mock" | "real";
}) {
  const t = useTranslations("settings");
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
      </div>
      <PriceColorToggle />
      <KiwoomPanel configured={configured} env={env} />
    </div>
  );
}
