import {
  collection,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
  query,
  where,
  orderBy,
  type Firestore,
} from "firebase/firestore";
import type { StrategyDSL } from "@ats/strategy-engine";

/**
 * 전략 저장/조회 (클라이언트 Firestore).
 * docs/05 §5.3: strategies/{id} + versions/{v}. 불변 버전 모델.
 * 소유권은 보안 규칙(ownerUid == auth.uid)으로 강제 — firestore.rules 참조.
 */

export type StrategySummary = {
  id: string;
  name: string;
  description: string;
  currentVersion: string;
  updatedAt: number | null;
};

/**
 * 새 전략을 저장한다(v1 버전 동시 생성). 반환: strategyId.
 * 배치로 strategy 문서 + 첫 버전 문서를 원자적으로 쓴다.
 */
export async function createStrategy(
  db: Firestore,
  ownerUid: string,
  input: { name: string; description?: string; dsl: StrategyDSL },
): Promise<string> {
  const strategyRef = doc(collection(db, "strategies"));
  const versionId = "v1";
  const versionRef = doc(
    collection(db, "strategies", strategyRef.id, "versions"),
    versionId,
  );

  const batch = writeBatch(db);
  batch.set(strategyRef, {
    ownerUid,
    name: input.name,
    description: input.description ?? "",
    currentVersion: versionId,
    createdFrom: "chat",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  batch.set(versionRef, {
    version: versionId,
    parentVersion: null,
    dsl: input.dsl,
    changeSummary: "최초 생성",
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
  });
  await batch.commit();
  return strategyRef.id;
}

/** 내 전략 목록(최근 수정순). */
export async function listStrategies(
  db: Firestore,
  ownerUid: string,
): Promise<StrategySummary[]> {
  const q = query(
    collection(db, "strategies"),
    where("ownerUid", "==", ownerUid),
    orderBy("updatedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const updated = data.updatedAt as { toMillis?: () => number } | undefined;
    return {
      id: d.id,
      name: (data.name as string) ?? "(이름 없음)",
      description: (data.description as string) ?? "",
      currentVersion: (data.currentVersion as string) ?? "v1",
      updatedAt: updated?.toMillis ? updated.toMillis() : null,
    };
  });
}
