import { describe, expect, it } from "vitest";
import { canAccessAdmin, canManageRoles, isRole } from "./roles";

describe("roles", () => {
  it("isRole는 유효한 역할만 통과시킨다", () => {
    expect(isRole("user")).toBe(true);
    expect(isRole("admin")).toBe(true);
    expect(isRole("superadmin")).toBe(true);
    expect(isRole("root")).toBe(false);
    expect(isRole(undefined)).toBe(false);
    expect(isRole(null)).toBe(false);
  });

  it("어드민 접근은 admin/superadmin만 허용한다", () => {
    expect(canAccessAdmin(null)).toBe(false);
    expect(canAccessAdmin("user")).toBe(false);
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("superadmin")).toBe(true);
  });

  it("role 관리는 superadmin만 허용한다", () => {
    expect(canManageRoles("admin")).toBe(false);
    expect(canManageRoles("superadmin")).toBe(true);
    expect(canManageRoles(null)).toBe(false);
  });
});
