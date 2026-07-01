import { doc, getDoc, setDoc, type Firestore } from "firebase/firestore";
import type { PriceColorMode } from "@/lib/prefs/priceColor";

/**
 * 사용자 프로필/환경설정 (docs/05 §5.2). 본인만 read/write(firestore.rules).
 * 로컬 우선 + Firestore 동기화(로그인 시 read-back).
 */
export type UserPrefs = {
  priceColorMode?: PriceColorMode;
  theme?: "dark" | "light";
  locale?: string;
};

export async function getUserProfile(
  db: Firestore,
  uid: string,
): Promise<UserPrefs | null> {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;
  const data = snap.data();
  return {
    priceColorMode: data.priceColorMode as PriceColorMode | undefined,
    theme: data.theme as "dark" | "light" | undefined,
    locale: data.locale as string | undefined,
  };
}

export async function setUserPref(
  db: Firestore,
  uid: string,
  partial: UserPrefs,
): Promise<void> {
  await setDoc(doc(db, "users", uid), partial, { merge: true });
}
