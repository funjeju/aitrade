import "server-only";
import {
  initializeApp,
  getApps,
  getApp,
  cert,
  type App,
} from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Firebase Admin SDK (Node 런타임 전용) — ID 토큰 검증 / role claim 관리.
 * Edge에서 import 금지("server-only"로 강제).
 *
 * 자격증명이 없으면 null을 반환한다 → Phase 0에서 서비스 계정 없이도 빌드가 통과한다.
 */
function readServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

let cachedApp: App | null = null;

export function getAdminApp(): App | null {
  const sa = readServiceAccount();
  if (!sa) return null;
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length
    ? getApp()
    : initializeApp({ credential: cert(sa) });
  return cachedApp;
}

export function getAdminAuth(): Auth | null {
  const app = getAdminApp();
  return app ? getAuth(app) : null;
}
