/**
 * i18n 누락 키 검사 (CI 강제).
 * 기준 로케일(ko)의 모든 키가 다른 로케일에도 존재하는지 확인한다.
 * 빠진 키가 있으면 비정상 종료(exit 1)해서 빌드를 실패시킨다(docs/06 §번역 운영).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { locales, defaultLocale } from "../src/i18n/routing";

const here = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(here, "..", "messages");

function loadKeys(locale: string): Set<string> {
  const raw = readFileSync(join(messagesDir, `${locale}.json`), "utf8");
  const json = JSON.parse(raw) as Record<string, unknown>;
  const keys = new Set<string>();
  const walk = (obj: unknown, prefix: string) => {
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      for (const [k, v] of Object.entries(obj)) {
        walk(v, prefix ? `${prefix}.${k}` : k);
      }
    } else {
      keys.add(prefix);
    }
  };
  walk(json, "");
  return keys;
}

const base = loadKeys(defaultLocale);
let hasError = false;

for (const locale of locales) {
  if (locale === defaultLocale) continue;
  const keys = loadKeys(locale);
  const missing = [...base].filter((k) => !keys.has(k));
  const extra = [...keys].filter((k) => !base.has(k));
  if (missing.length) {
    hasError = true;
    console.error(`\n[${locale}] 누락된 키 (${missing.length}):`);
    for (const k of missing) console.error(`  - ${k}`);
  }
  if (extra.length) {
    console.warn(`\n[${locale}] 기준(${defaultLocale})에 없는 키 (${extra.length}):`);
    for (const k of extra) console.warn(`  + ${k}`);
  }
}

if (hasError) {
  console.error("\n✗ i18n 검사 실패: 누락된 번역 키가 있습니다.");
  process.exit(1);
}
console.log("✓ i18n 검사 통과: 모든 로케일 키 일치.");
