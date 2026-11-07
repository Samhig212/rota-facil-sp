import { describe, it, expect, beforeEach } from "vitest";
import {
  getAdminToken,
  setAdminToken,
  clearAdminToken,
  getCurrentUser,
  isCurrentUserAdmin,
  hasWriteAuthorization,
} from "./api";

// Mock localStorage para execução em ambiente node do vitest
const storageMap = new Map<string, string>();
const localStorageMock = {
  getItem: (k: string) => storageMap.get(k) ?? null,
  setItem: (k: string, v: string) => { storageMap.set(k, String(v)); },
  removeItem: (k: string) => { storageMap.delete(k); },
  clear: () => { storageMap.clear(); },
};

Object.defineProperty(globalThis, "window", {
  value: {
    dispatchEvent: () => true,
  },
  writable: true,
});

Object.defineProperty(globalThis, "localStorage", {
  value: localStorageMock,
  writable: true,
});

describe("API Auth & Admin Token Helpers", () => {
  beforeEach(() => {
    localStorageMock.clear();
  });

  it("handles admin token storage correctly", () => {
    expect(getAdminToken()).toBeNull();
    setAdminToken("ADMIN123");
    expect(getAdminToken()).toBe("ADMIN123");
    clearAdminToken();
    expect(getAdminToken()).toBeNull();
  });

  it("identifies user permissions based on role and admin token", () => {
    // 1. Guest
    expect(getCurrentUser()).toBeNull();
    expect(isCurrentUserAdmin()).toBe(false);
    expect(hasWriteAuthorization()).toBe(false);

    // 2. Regular user without admin token
    localStorageMock.setItem(
      "rf_auth_user",
      JSON.stringify({ id: "u-12", email: "sam12@gmail.com", nome: "Sam", role: "user" })
    );
    expect(isCurrentUserAdmin()).toBe(false);
    expect(hasWriteAuthorization()).toBe(false);

    // 3. Regular user WITH admin token
    setAdminToken("ADMIN123");
    expect(isCurrentUserAdmin()).toBe(false);
    expect(hasWriteAuthorization()).toBe(true);

    // 4. Admin user has direct permission even without explicit token
    clearAdminToken();
    localStorageMock.setItem(
      "rf_auth_user",
      JSON.stringify({ id: "u-admin", email: "operacao@rotafacil.com.br", nome: "Gestor", role: "admin" })
    );
    expect(isCurrentUserAdmin()).toBe(true);
    expect(hasWriteAuthorization()).toBe(true);
  });
});
