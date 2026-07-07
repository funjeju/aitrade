import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  serverTimestamp,
  query,
  where,
  orderBy,
  limit,
  type Firestore,
} from "firebase/firestore";

/**
 * AI 전략 대화 세션 저장/조회 (Firestore, per-uid).
 * 대화가 기기·브라우저 상관없이 유지되고, 과거 대화도 여러 개 보관된다.
 * thread는 임의 JSON(사용자/AI 메시지 배열) — undefined 제거 후 저장한다.
 */

export type ChatSessionSummary = {
  id: string;
  title: string;
  updatedAt: number | null;
};

/** Firestore는 undefined를 못 넣으므로 JSON 왕복으로 정리. */
function clean<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function titleFrom(thread: unknown[]): string {
  const firstUser = thread.find(
    (it) => (it as { kind?: string }).kind === "user",
  ) as { text?: string } | undefined;
  const text = firstUser?.text ?? "새 대화";
  return text.length > 40 ? text.slice(0, 40) + "…" : text;
}

/**
 * 세션 upsert. sessionId가 없으면 새로 만들고 id를 반환한다.
 */
export async function saveSession(
  db: Firestore,
  ownerUid: string,
  sessionId: string | null,
  thread: unknown[],
): Promise<string> {
  const ref = sessionId
    ? doc(db, "chatSessions", sessionId)
    : doc(collection(db, "chatSessions"));
  await setDoc(
    ref,
    {
      ownerUid,
      title: titleFrom(thread),
      thread: clean(thread),
      updatedAt: serverTimestamp(),
      ...(sessionId ? {} : { createdAt: serverTimestamp() }),
    },
    { merge: true },
  );
  return ref.id;
}

export async function listSessions(
  db: Firestore,
  ownerUid: string,
  max = 20,
): Promise<ChatSessionSummary[]> {
  const q = query(
    collection(db, "chatSessions"),
    where("ownerUid", "==", ownerUid),
    orderBy("updatedAt", "desc"),
    limit(max),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const data = d.data();
    const at = data.updatedAt as { toMillis?: () => number } | undefined;
    return {
      id: d.id,
      title: (data.title as string) ?? "대화",
      updatedAt: at?.toMillis ? at.toMillis() : null,
    };
  });
}

export async function getSessionThread(
  db: Firestore,
  sessionId: string,
): Promise<unknown[] | null> {
  const snap = await getDoc(doc(db, "chatSessions", sessionId));
  if (!snap.exists()) return null;
  const thread = snap.data().thread;
  return Array.isArray(thread) ? thread : [];
}

export async function deleteSession(db: Firestore, sessionId: string): Promise<void> {
  await deleteDoc(doc(db, "chatSessions", sessionId));
}
