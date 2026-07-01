import {
  collection,
  doc,
  deleteDoc,
  getDocs,
  serverTimestamp,
  setDoc,
  query,
  where,
  orderBy,
  type Firestore,
} from "firebase/firestore";
import type { ScanResult } from "@ats/strategy-engine";

/**
 * 스캔 매치(관심종목) 저장/조회 (클라이언트 Firestore).
 * docs/05 §5.5 scanMatches. 소유권은 firestore.rules(ownerUid)로 강제.
 * 스캔 시점 스냅샷 = 불변(근거 context 포함).
 */

export type SavedMatch = {
  id: string;
  code: string;
  name: string;
  signal: ScanResult["signal"];
  matchScore: number;
  price: number;
  changePct: number;
  strategyName: string;
  context: ScanResult["context"];
  scannedAt: number | null;
};

export async function saveScanMatch(
  db: Firestore,
  ownerUid: string,
  input: {
    code: string;
    name: string;
    result: ScanResult;
    strategyName: string;
  },
): Promise<void> {
  // code+uid를 문서 id로 → 같은 종목 재저장 시 최신 스냅샷으로 덮어씀(중복 방지).
  const id = `${ownerUid}_${input.code}`;
  await setDoc(doc(db, "scanMatches", id), {
    ownerUid,
    code: input.code,
    name: input.name,
    signal: input.result.signal,
    matchScore: input.result.matchScore,
    price: input.result.price,
    changePct: input.result.changePct,
    strategyName: input.strategyName,
    context: input.result.context,
    scannedAt: serverTimestamp(),
  });
}

export async function listScanMatches(
  db: Firestore,
  ownerUid: string,
): Promise<SavedMatch[]> {
  const q = query(
    collection(db, "scanMatches"),
    where("ownerUid", "==", ownerUid),
    orderBy("scannedAt", "desc"),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const at = data.scannedAt as { toMillis?: () => number } | undefined;
    return {
      id: d.id,
      code: (data.code as string) ?? "",
      name: (data.name as string) ?? "",
      signal: (data.signal as ScanResult["signal"]) ?? "NONE",
      matchScore: (data.matchScore as number) ?? 0,
      price: (data.price as number) ?? 0,
      changePct: (data.changePct as number) ?? 0,
      strategyName: (data.strategyName as string) ?? "",
      context: (data.context as ScanResult["context"]) ?? null,
      scannedAt: at?.toMillis ? at.toMillis() : null,
    };
  });
}

export async function deleteScanMatch(db: Firestore, id: string): Promise<void> {
  await deleteDoc(doc(db, "scanMatches", id));
}
