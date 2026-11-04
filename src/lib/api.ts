/**
 * Cliente HTTP unificado para a API Flask (RotaFacil SP).
 * Utiliza a variável de ambiente VITE_API_URL com fallback para http://localhost:5000
 */

export const API_BASE_URL = (
  (typeof import.meta !== "undefined" && import.meta.env?.["VITE_API_URL"]) ||
  "http://localhost:5000"
).replace(/\/$/, "");

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

function getAuthHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = localStorage.getItem("rf_auth_token");
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = endpoint.startsWith("http") ? endpoint : `${API_BASE_URL}${endpoint}`;
  
  const headers = {
    "Content-Type": "application/json",
    ...getAuthHeader(),
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

  // Módulo de Autenticação
  auth: {
    async login(email: string, password: string) {
      const res = await api.post<{ user: any; token: string }>("/api/auth/login", { email, password });
      if (typeof window !== "undefined" && res.token) {
        localStorage.setItem("rf_auth_token", res.token);
        localStorage.setItem("rf_auth_user", JSON.stringify(res.user));
      }
      return res;
    },
    async register(email: string, password: string) {
      const res = await api.post<{ user: any; token: string }>("/api/auth/register", { email, password });
      if (typeof window !== "undefined" && res.token) {
        localStorage.setItem("rf_auth_token", res.token);
        localStorage.setItem("rf_auth_user", JSON.stringify(res.user));
      }
      return res;
    },
    async me() {
      try {
        const res = await api.get<{ user: any }>("/api/auth/me");
        return res.user;
      } catch {
        if (typeof window !== "undefined") {
          const raw = localStorage.getItem("rf_auth_user");
          if (raw) return JSON.parse(raw);
        }
        return { id: "guest", email: "operacao@rotafacil.com.br", nome: "Operador Logístico" };
      }
    },
    logout() {
      if (typeof window !== "undefined") {
        localStorage.removeItem("rf_auth_token");
        localStorage.removeItem("rf_auth_user");
      }
    },
  },

  // Módulo de Veículos
  vehicles: {
    list: () => api.get<any[]>("/api/vehicles"),
    create: (data: { placa: string; modelo?: string | undefined; km_atual?: number | undefined }) =>
      api.post<any>("/api/vehicles", data),
    update: (id: string, data: Partial<{ placa: string; modelo: string; km_atual: number; ativo: boolean }>) =>
      api.patch<any>(`/api/vehicles/${id}`, data),
  },

  // Módulo de Motoristas
  drivers: {
    list: () => api.get<any[]>("/api/drivers"),
    create: (data: {
      nome: string;
      cnh?: string | undefined;
      telefone?: string | undefined;
      foto?: string | undefined;
      cnh_foto?: string | undefined;
      cnh_categoria?: string | undefined;
      cnh_validade?: string | undefined;
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

  // Módulo de Rotas
  routes: {
    list: () => api.get<any[]>("/api/routes"),
    create: (data: { vehicle_id: string; driver_id: string; km_inicial?: number | undefined }) =>
      api.post<any>("/api/routes", data),
    close: (id: string, km_final: number) =>
      api.post<any>(`/api/routes/${id}/close`, { km_final }),
  },
};
