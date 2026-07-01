import { notFound } from "next/navigation";

/**
 * 로케일 하위 미매칭 경로 catch-all → [locale]/not-found 로 보낸다.
 * (next-intl 구조에서 커스텀 404가 [locale]/layout 안에서 렌더되도록 보장)
 */
export default function CatchAll() {
  notFound();
}
