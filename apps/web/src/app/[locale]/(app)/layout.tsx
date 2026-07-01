import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import { Sidebar } from "@/components/shell/Sidebar";
import { Topbar } from "@/components/shell/Topbar";
import { PrefsSync } from "@/components/prefs/PrefsSync";
import { getCurrentRole } from "@/lib/auth/getCurrentRole";

/**
 * 앱 셸: 사이드바 + 탑바 (docs/03 §3.5).
 * 어드민 UI도 같은 셸/토큰을 쓴다(별도 스타일 금지, docs/06).
 */
export default async function AppLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const role = await getCurrentRole();

  return (
    <div className="app-shell">
      <PrefsSync />
      <Sidebar role={role} />
      <div>
        <Topbar role={role} />
        <main>{children}</main>
      </div>
    </div>
  );
}
