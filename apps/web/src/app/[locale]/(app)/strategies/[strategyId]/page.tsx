import { setRequestLocale } from "next-intl/server";
import { StrategyDetail } from "@/components/strategy/StrategyDetail";

export default async function StrategyDetailPage({
  params,
}: {
  params: Promise<{ locale: string; strategyId: string }>;
}) {
  const { locale, strategyId } = await params;
  setRequestLocale(locale);
  return <StrategyDetail strategyId={strategyId} />;
}
