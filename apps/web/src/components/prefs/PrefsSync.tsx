"use client";

import { useEffect, useRef } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { getUserProfile, setUserPref } from "@/lib/user/profile";
import { applyPriceColor, getPriceColor } from "@/lib/prefs/priceColor";

/**
 * 사용자 환경설정 동기화(렌더 없음).
 * - 로그인 시: Firestore 프로필을 읽어 등락색·테마를 적용(read-back, 크로스 디바이스).
 * - 로그인 상태에서 테마 변경 시: 프로필에 write-through.
 * 로컬 우선 원칙(docs/06): 저장값이 있으면 그것을 적용한다.
 */
export function PrefsSync() {
  const { user } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const loadedFor = useRef<string | null>(null);

  // read-back on login
  useEffect(() => {
    if (!user || loadedFor.current === user.uid) return;
    const db = getFirebaseDb();
    if (!db) return;
    loadedFor.current = user.uid;
    getUserProfile(db, user.uid)
      .then((prefs) => {
        if (!prefs) return;
        if (prefs.priceColorMode && prefs.priceColorMode !== getPriceColor()) {
          applyPriceColor(prefs.priceColorMode);
        }
        if (prefs.theme && prefs.theme !== resolvedTheme) {
          setTheme(prefs.theme);
        }
      })
      .catch(() => {});
    // resolvedTheme intentionally excluded: only run on login, not theme flips
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // write-through theme changes (only after initial load, only when signed in)
  useEffect(() => {
    if (!user || loadedFor.current !== user.uid) return;
    if (resolvedTheme !== "dark" && resolvedTheme !== "light") return;
    const db = getFirebaseDb();
    if (!db) return;
    void setUserPref(db, user.uid, { theme: resolvedTheme }).catch(() => {});
  }, [resolvedTheme, user]);

  return null;
}
