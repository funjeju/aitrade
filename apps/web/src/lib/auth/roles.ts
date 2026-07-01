/**
 * 역할 모델 — Firebase custom claims 기반 (docs/06).
 * 클라이언트는 role을 못 바꾼다. 부여/회수는 Cloud Function 전용.
 */
export const ROLES = ["user", "admin", "superadmin"] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** 어드민 영역 접근 가능 여부. */
export function canAccessAdmin(role: Role | null): boolean {
  return role === "admin" || role === "superadmin";
}

/** role 부여/회수 가능 여부 (superadmin 전용). */
export function canManageRoles(role: Role | null): boolean {
  return role === "superadmin";
}
