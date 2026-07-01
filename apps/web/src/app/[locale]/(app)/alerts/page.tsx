import { setRequestLocale } from "next-intl/server";
import { useTranslations } from "next-intl";
import { PhasePage } from "@/components/common/PhasePage";

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
  return <PhasePage title={nav("alerts")} desc={p("desc")} phase={p("phase")} />;
}
