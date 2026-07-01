import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/**
 * 로케일을 자동으로 붙여 주는 내비게이션 헬퍼.
 * 앱 내부 링크/라우팅은 반드시 이걸 쓴다(next/link 직접 사용 금지).
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
