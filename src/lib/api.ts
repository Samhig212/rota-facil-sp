/**
 * Cliente HTTP unificado para a API Flask (RotaFacil SP).
 * Suporta autenticação multiusuário, isolamento de workspace e token de modificação de administrador.
 */

export const API_BASE_URL = (
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_API_URL"]) ||
  "http://localhost:5000"
).replace(/\/$/, "");

export interface AuthUser {
  id: string;
  email: string;
  nome: string;
  role: "admin" | "user";
}

export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Helpers para token de modificação do administrador
export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("rf_admin_token");
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem("rf_admin_token", token.trim());
  window.dispatchEvent(new CustomEvent("rf:admin-token-change"));
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem("rf_admin_token");
  window.dispatchEvent(new CustomEvent("rf:admin-token-change"));
}

export function getCurrentUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem("rf_auth_user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function isCurrentUserAdmin(): boolean {
  const user = getCurrentUser();
  return user?.role === "admin";
}

export function hasWriteAuthorization(): boolean {
  return isCurrentUserAdmin() || Boolean(getAdminToken());
}

/**
 * Solicita autorização de administrador.
 * Se o usuário for admin ou já tiver o token salvo, retorna true imediatamente.
 * Caso contrário, abre o modal de inserção de token e aguarda a validação.
 */
export function ensureAdminAuthorization(actionDescription = "salvar alterações"): Promise<boolean> {
  if (hasWriteAuthorization()) {
    return Promise.resolve(true);
  }

  return new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    window.dispatchEvent(
      new CustomEvent("rf:open-admin-token-dialog", {
        detail: { actionDescription, resolve },
      })
    );
  });
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const headers: Record<string, string> = {};
  const token = localStorage.getItem("rf_auth_token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const adminToken = getAdminToken();
  if (adminToken) {
    headers["X-Admin-Token"] = adminToken;
  }
  return headers;
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeaders(),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!response.ok) {
    const errorMsg = data?.error || data?.message || `Erro na requisição (${response.status})`;
    
    // Se o backend exigir o token de modificação do admin (403), emite evento para a UI
    if (response.status === 403 && data?.error === "admin_token_required") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("rf:admin-token-required"));
      }
    }

    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: "GET", ...(options || {}) }),

  post: <T>(endpoint: string, body?: unknown, options?: RequestInit) => {
    const init: RequestInit = { method: "POST", ...(options || {}) };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return request<T>(endpoint, init);
  },

  patch: <T>(endpoint: string, body?: unknown, options?: RequestInit) => {
    const init: RequestInit = { method: "PATCH", ...(options || {}) };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
    }
    return request<T>(endpoint, init);
  },

  delete: <T>(endpoint: string, options?: RequestInit) =>
    request<T>(endpoint, { method: "DELETE", ...(options || {}) }),

  // Módulo de Autenticação e Permissões
  auth: {
    async login(email: string, password: string) {
      const res = await api.post<{ user: AuthUser; token: string }>("/api/auth/login", { email, password });
      if (typeof window !== "undefined" && res.token) {
        localStorage.setItem("rf_auth_token", res.token);
        localStorage.setItem("rf_auth_user", JSON.stringify(res.user));
      }
      return res;
    },

    async register(email: string, password: string, nome?: string, adminToken?: string) {
      const payload: Record<string, string> = { email, password };
      if (nome) payload["nome"] = nome;
      if (adminToken) payload["admin_token"] = adminToken;

      const res = await api.post<{ user: AuthUser; token: string }>("/api/auth/register", payload);
      if (typeof window !== "undefined" && res.token) {
        localStorage.setItem("rf_auth_token", res.token);
        localStorage.setItem("rf_auth_user", JSON.stringify(res.user));
        if (adminToken && res.user.role === "admin") {
          setAdminToken(adminToken);
        }
      }
      return res;
    },

    async verifyAdminToken(token: string) {
      return await api.post<{ valid: boolean; message?: string }>("/api/auth/verify-admin-token", { token });
    },

    async me(): Promise<AuthUser | null> {
      try {
        const res = await api.get<{ user: AuthUser }>("/api/auth/me");
        if (typeof window !== "undefined" && res.user) {
          localStorage.setItem("rf_auth_user", JSON.stringify(res.user));
        }
        return res.user;
      } catch {
        return null;
      }
    },

    logout() {
      if (typeof window !== "undefined") {
        localStorage.removeItem("rf_auth_token");
        localStorage.removeItem("rf_auth_user");
        localStorage.removeItem("rf_admin_token");
      }
    },
  },

  // Módulo de Veículos
  vehicles: {
    list: () => api.get<any[]>("/api/vehicles"),
    create: (data: { placa: string; modelo?: string; km_atual?: number }) =>
      api.post<any>("/api/vehicles", data),
    update: (id: string, data: Partial<{ placa: string; modelo: string; km_atual: number; ativo: boolean }>) =>
      api.patch<any>(`/api/vehicles/${id}`, data),
  },

  // Módulo de Motoristas
  drivers: {
    list: () => api.get<any[]>("/api/drivers"),
    create: (data: {
      nome: string;
      cnh?: string;
      telefone?: string;
      foto?: string;
      cnh_foto?: string;
      cnh_categoria?: string;
      cnh_validade?: string;
    }) => api.post<any>("/api/drivers", data),
    update: (id: string, data: Record<string, any>) =>
      api.patch<any>(`/api/drivers/${id}`, data),
  },

  // Módulo de Notas Fiscais
  invoices: {
    list: () => api.get<any[]>("/api/invoices"),
    create: (data: any) => api.post<any>("/api/invoices", data),
    batch: (invoices: any[]) => api.post<any>("/api/invoices/batch", { invoices }),
    update: (id: string, data: any) => api.patch<any>(`/api/invoices/${id}`, data),
    delete: (id: string) => api.delete<any>(`/api/invoices/${id}`),
  },

  // Módulo de Rotas & Despacho
  routes: {
    list: () => api.get<any[]>("/api/routes"),
    create: (data: { vehicle_id: string; driver_id: string; km_inicial?: number }) =>
      api.post<any>("/api/routes", data),
    close: (id: string, km_final: number) =>
      api.post<any>(`/api/routes/${id}/close`, { km_final }),
  },
};
