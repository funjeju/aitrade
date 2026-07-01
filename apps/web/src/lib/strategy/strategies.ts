import {
  collection,
  doc,
  getDoc,
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
  versionCount: number;
  updatedAt: number | null;
};

export type StrategyVersion = {
  version: string;
  parentVersion: string | null;
  changeSummary: string;
  createdAt: number | null;
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
    versionCount: 1,
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

/**
 * 기존 전략에 새 버전을 추가한다(불변 진화, docs/05 §5.3).
 * currentVersion을 parent로 기록하고 versionCount를 올린다. 반환: 새 버전 id.
 */
export async function addStrategyVersion(
  db: Firestore,
  ownerUid: string,
  strategyId: string,
  input: { dsl: StrategyDSL; changeSummary: string },
): Promise<string> {
  const strategyRef = doc(db, "strategies", strategyId);
  const sdoc = await getDoc(strategyRef);
  if (!sdoc.exists()) throw new Error("strategy not found");
  const data = sdoc.data();
  const parent = (data.currentVersion as string) ?? "v1";
  const count = (data.versionCount as number) ?? 1;
  const nextVersion = `v${count + 1}`;
  const versionRef = doc(
    collection(db, "strategies", strategyId, "versions"),
    nextVersion,
  );

  const batch = writeBatch(db);
  batch.set(versionRef, {
    version: nextVersion,
    parentVersion: parent,
    dsl: input.dsl,
    changeSummary: input.changeSummary || "변경 요약 없음",
    createdBy: ownerUid,
    createdAt: serverTimestamp(),
  });
  batch.update(strategyRef, {
    currentVersion: nextVersion,
    versionCount: count + 1,
    updatedAt: serverTimestamp(),
  });
  await batch.commit();
  return nextVersion;
}

/** 전략의 버전 이력(최신순). */
export async function listVersions(
  db: Firestore,
  strategyId: string,
): Promise<StrategyVersion[]> {
  const q = query(
    collection(db, "strategies", strategyId, "versions"),
    orderBy("createdAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const at = data.createdAt as { toMillis?: () => number } | undefined;
    return {
      version: (data.version as string) ?? d.id,
      parentVersion: (data.parentVersion as string | null) ?? null,
      changeSummary: (data.changeSummary as string) ?? "",
      createdAt: at?.toMillis ? at.toMillis() : null,
    };
  });
}

/** 전략의 현재 버전 DSL을 읽는다. 없으면 null. (백테스트용) */
export async function getCurrentDsl(
  db: Firestore,
  strategyId: string,
): Promise<StrategyDSL | null> {
  const sdoc = await getDoc(doc(db, "strategies", strategyId));
  if (!sdoc.exists()) return null;
  const version = (sdoc.data().currentVersion as string) ?? "v1";
  const vdoc = await getDoc(
    doc(db, "strategies", strategyId, "versions", version),
  );
  if (!vdoc.exists()) return null;
  return (vdoc.data().dsl as StrategyDSL) ?? null;
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
      versionCount: (data.versionCount as number) ?? 1,
      updatedAt: updated?.toMillis ? updated.toMillis() : null,
    };
  });
}
