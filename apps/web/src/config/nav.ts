import type { Role } from "@/lib/auth/roles";

/**
 * 사이드바 내비게이션 정의 (docs/03 §3.5 레이아웃).
 * label은 i18n 키("nav.*")로만 참조한다(하드코딩 문자열 금지).
 * requiresRole가 있으면 해당 역할 이상만 노출.
 */
export type NavItem = {
  key: string;
  href: string;
  labelKey: string;
  requiresRole?: Role;
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", href: "/", labelKey: "nav.dashboard" },
  { key: "strategies", href: "/strategies", labelKey: "nav.strategies" },
  { key: "aiChat", href: "/ai-chat", labelKey: "nav.aiChat" },
  { key: "backtest", href: "/backtest", labelKey: "nav.backtest" },
  { key: "scanner", href: "/scanner", labelKey: "nav.scanner" },
  { key: "alerts", href: "/alerts", labelKey: "nav.alerts" },
  { key: "trades", href: "/trades", labelKey: "nav.trades" },
  { key: "marketplace", href: "/marketplace", labelKey: "nav.marketplace" },
  { key: "admin", href: "/admin", labelKey: "nav.admin", requiresRole: "admin" },
  { key: "settings", href: "/settings", labelKey: "nav.settings" },
];
