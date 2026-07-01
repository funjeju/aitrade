import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  type Firestore,
} from "firebase/firestore";
import type { BacktestMetrics, WalkForwardResult } from "@ats/strategy-engine";

/**
 * 백테스트 결과 저장/조회 (클라이언트 Firestore).
 * docs/05 §5.4: strategies/{id}/versions/{v}/backtests/{id}. 불변.
 * P2/P3: in/out-of-sample 지표와 검증방식·기간·표본을 함께 저장한다.
 */

export type BacktestSource = "sample" | "kiwoom";

export type SavedBacktest = {
  id: string;
  period: { from: string; to: string };
  method: string;
  inSampleBars: number;
  outOfSampleBars: number;
  inSample: BacktestMetrics;
  outOfSample: BacktestMetrics;
  source: BacktestSource;
  symbol: string | null;
  reoptimizationCount: number;
  createdAt: number | null;
};

async function currentVersion(db: Firestore, strategyId: string): Promise<string> {
  const sdoc = await getDoc(doc(db, "strategies", strategyId));
  if (!sdoc.exists()) throw new Error("strategy not found");
  return (sdoc.data().currentVersion as string) ?? "v1";
}

export async function saveBacktest(
  db: Firestore,
  strategyId: string,
  wf: WalkForwardResult,
  meta: { source: BacktestSource; symbol?: string },
): Promise<void> {
  const version = await currentVersion(db, strategyId);
  const ref = doc(
    collection(db, "strategies", strategyId, "versions", version, "backtests"),
  );
  await setDoc(ref, {
    period: wf.period,
    method: wf.method,
    split: wf.split,
    metrics: wf.inSample, // in-sample
    outOfSampleMetrics: wf.outOfSample, // 별도 기록(P2)
    assumptions: wf.assumptions,
    reoptimizationCount: wf.reoptimizationCount,
    universeHadDelisted: wf.universeHadDelisted,
    warnings: wf.warnings,
    source: meta.source,
    symbol: meta.symbol ?? null,
    status: "done",
    createdAt: serverTimestamp(),
  });
}

export async function listBacktests(
  db: Firestore,
  strategyId: string,
): Promise<SavedBacktest[]> {
  const version = await currentVersion(db, strategyId);
  const q = query(
    collection(db, "strategies", strategyId, "versions", version, "backtests"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const at = data.createdAt as { toMillis?: () => number } | undefined;
    const split = (data.split as { inSampleBars?: number; outOfSampleBars?: number }) ?? {};
    return {
      id: d.id,
      period: (data.period as { from: string; to: string }) ?? { from: "", to: "" },
      method: (data.method as string) ?? "walk_forward",
      inSampleBars: split.inSampleBars ?? 0,
      outOfSampleBars: split.outOfSampleBars ?? 0,
      inSample: data.metrics as BacktestMetrics,
      outOfSample: data.outOfSampleMetrics as BacktestMetrics,
      source: (data.source as BacktestSource) ?? "sample",
      symbol: (data.symbol as string) ?? null,
      reoptimizationCount: (data.reoptimizationCount as number) ?? 0,
      createdAt: at?.toMillis ? at.toMillis() : null,
    };
  });
}
