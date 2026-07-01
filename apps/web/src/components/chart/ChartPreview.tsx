import { useTranslations } from "next-intl";
import {
  findReferenceCandle,
  strategyZones,
  type Candle,
  type StrategyDSL,
} from "@ats/strategy-engine";
import styles from "./ChartPreview.module.css";

/**
 * 캔들 차트 + 전략 근거 오버레이 (순수 SVG, 색은 chart/price 토큰).
 * 기준 캔들 하이라이트 + 매수/손절 구간을 "근거로서" 표시(P1: 지시 아님).
 */
const W = 820;
const H = 360;
const PAD = { l: 8, r: 62, t: 14, b: 22 };

export function ChartPreview({
  candles,
  dsl,
  count = 60,
}: {
  candles: Candle[];
  dsl: StrategyDSL;
  count?: number;
}) {
  const t = useTranslations("chart");
  const visible = candles.slice(-count);
  if (visible.length < 2) return <p className={styles.empty}>{t("noData")}</p>;

  const ref = findReferenceCandle(visible, {
    highGainFromOpen: dsl.referenceCandle.highGainFromOpen,
    closeNearHighPct: dsl.referenceCandle.closeNearHighPct,
    volMultVsPrev: dsl.referenceCandle.volMultVsPrev,
    lookbackDays: Math.max(dsl.referenceCandle.lookbackDays, count),
  });
  const zones = ref ? strategyZones(ref, dsl) : null;

  // 가격 범위 (구간 가격 포함)
  let min = Infinity;
  let max = -Infinity;
  for (const c of visible) {
    if (c.low < min) min = c.low;
    if (c.high > max) max = c.high;
  }
  if (zones) {
    min = Math.min(min, zones.stop);
    for (const b of zones.buyBands) min = Math.min(min, b.price * (1 - b.tolerance));
  }
  const pad = (max - min) * 0.04 || 1;
  min -= pad;
  max += pad;

  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const slot = plotW / visible.length;
  const bodyW = Math.min(slot * 0.6, 10);
  const yFor = (p: number) => PAD.t + ((max - p) / (max - min)) * plotH;
  const xFor = (i: number) => PAD.l + (i + 0.5) * slot;

  const gridPrices = [0, 0.25, 0.5, 0.75, 1].map((f) => min + (max - min) * f);

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.svg} role="img" aria-label={t("title")}>
        {/* 가격 그리드 */}
        {gridPrices.map((p, i) => (
          <g key={i}>
            <line x1={PAD.l} x2={PAD.l + plotW} y1={yFor(p)} y2={yFor(p)} className={styles.grid} />
            <text x={PAD.l + plotW + 6} y={yFor(p) + 3} className={styles.axis}>
              {Math.round(p).toLocaleString()}
            </text>
          </g>
        ))}

        {/* 손절 구간 */}
        {zones && (
          <rect
            x={PAD.l}
            width={plotW}
            y={yFor(Math.max(...visible.map((c) => c.low).filter((l) => l <= zones.refLow), zones.refLow))}
            height={Math.max(0, yFor(zones.stop) - yFor(zones.refLow))}
            fill="var(--chart-stop-zone)"
          />
        )}
        {/* 매수 구간 밴드 */}
        {zones?.buyBands.map((b, i) => {
          const top = yFor(b.price * (1 + b.tolerance));
          const bottom = yFor(b.price * (1 - b.tolerance));
          return (
            <g key={b.kind}>
              <rect
                x={PAD.l}
                width={plotW}
                y={top}
                height={Math.max(2, bottom - top)}
                fill={i === 0 ? "var(--chart-buy-zone-1)" : "var(--chart-buy-zone-2)"}
              />
              <line
                x1={PAD.l}
                x2={PAD.l + plotW}
                y1={yFor(b.price)}
                y2={yFor(b.price)}
                className={styles.zoneLine}
              />
            </g>
          );
        })}

        {/* 캔들 */}
        {visible.map((c, i) => {
          const up = c.close >= c.open;
          const color = up ? "var(--price-up)" : "var(--price-down)";
          const x = xFor(i);
          const bodyTop = yFor(Math.max(c.open, c.close));
          const bodyH = Math.max(1, Math.abs(yFor(c.open) - yFor(c.close)));
          const isRef = ref?.index === i;
          return (
            <g key={i}>
              <line x1={x} x2={x} y1={yFor(c.high)} y2={yFor(c.low)} stroke={color} strokeWidth={1} />
              <rect
                x={x - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                height={bodyH}
                fill={color}
              />
              {isRef && (
                <rect
                  x={x - bodyW / 2 - 2}
                  y={yFor(c.high) - 2}
                  width={bodyW + 4}
                  height={yFor(c.low) - yFor(c.high) + 4}
                  fill="none"
                  stroke="var(--chart-base-candle)"
                  strokeWidth={1.5}
                  rx={2}
                />
              )}
            </g>
          );
        })}
      </svg>

      <div className={styles.legend}>
        {ref ? (
          <>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swBase}`} />
              {`${t("refCandle")} (${ref.date})`}
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swBuy}`} />
              {t("buyZone")}
            </span>
            <span className={styles.legendItem}>
              <span className={`${styles.swatch} ${styles.swStop}`} />
              {t("stopZone")}
            </span>
          </>
        ) : (
          <span className={styles.noRef}>{t("noRef")}</span>
        )}
      </div>
      <p className={styles.note}>{t("evidenceNote")}</p>
    </div>
  );
}
