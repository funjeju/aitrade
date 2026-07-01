"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import styles from "./StockPicker.module.css";

type Stock = { code: string; name: string; sector: string; size: string };
type Market = "kospi" | "kosdaq";

/**
 * 종목 유니버스 검색·선택. 선택된 코드 배열을 상위로 보고한다(스캔 대상).
 * 원가상 스캔은 max개로 제한.
 */
export function StockPicker({
  value,
  names,
  onChange,
  max = 20,
}: {
  value: string[];
  names: Record<string, string>;
  onChange: (codes: string[], names: Record<string, string>) => void;
  max?: number;
}) {
  const t = useTranslations("pages.scanner.picker");
  const [market, setMarket] = useState<Market>("kospi");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLoading(true);
      fetch(`/api/kiwoom/universe?market=${market}&q=${encodeURIComponent(query)}&limit=40`)
        .then((r) => r.json())
        .then((d) => setResults(Array.isArray(d.stocks) ? d.stocks : []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [market, query]);

  function add(s: Stock) {
    if (value.includes(s.code) || value.length >= max) return;
    onChange([...value, s.code], { ...names, [s.code]: s.name });
  }
  function remove(code: string) {
    onChange(
      value.filter((c) => c !== code),
      names,
    );
  }

  const atMax = value.length >= max;

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{t("label", { max })}</span>

      <div className={styles.marketRow}>
        <div className={styles.marketGroup} role="group">
          {(["kospi", "kosdaq"] as const).map((m) => (
            <button
              key={m}
              type="button"
              className={`${styles.marketBtn} ${market === m ? styles.marketActive : ""}`}
              onClick={() => setMarket(m)}
            >
              {t(m)}
            </button>
          ))}
        </div>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search")}
        />
      </div>

      <div className={styles.results}>
        {loading ? (
          <p className={styles.status}>{t("searching")}</p>
        ) : results.length === 0 ? (
          <p className={styles.status}>{t("noHits")}</p>
        ) : (
          results.map((s) => (
            <div
              key={s.code}
              className={styles.hit}
              onClick={() => add(s)}
              aria-disabled={atMax || value.includes(s.code)}
            >
              <span className={styles.hitMain}>
                <span className={styles.hitName}>{s.name}</span>
                <span className={styles.hitMeta}>{s.code}</span>
              </span>
              <span className={styles.hitTags}>
                {[s.sector, s.size].filter(Boolean).join(" · ")}
              </span>
            </div>
          ))
        )}
      </div>

      {atMax && <span className={styles.note}>{t("max", { max })}</span>}

      <div className={styles.chips}>
        {value.length === 0 ? (
          <span className={styles.note}>{t("empty")}</span>
        ) : (
          value.map((code) => (
            <span key={code} className={styles.chip}>
              {names[code] ?? code} ({code})
              <button
                type="button"
                className={styles.chipX}
                onClick={() => remove(code)}
                aria-label="remove"
              >
                ×
              </button>
            </span>
          ))
        )}
      </div>
      <span className={styles.note}>{t("costNote", { max })}</span>
    </div>
  );
}
