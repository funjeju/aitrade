import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { isLlmConfigured } from "@/lib/llm/openai";
import { ChatPanel } from "@/components/chat/ChatPanel";
import styles from "../page.module.css";

export default async function AiChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <AiChatView configured={isLlmConfigured()} />;
}

function AiChatView({ configured }: { configured: boolean }) {
  const t = useTranslations("aiChat");
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>{t("title")}</h1>
        <p className={styles.subtitle}>{t("subtitle")}</p>
      </div>
      <ChatPanel configured={configured} />
    </div>
  );
}
