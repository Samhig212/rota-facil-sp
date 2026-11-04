import { useEffect, useState } from "react";

export interface DriverProfile {
  foto?: string | undefined;
  cnhFoto?: string | undefined;
  cnhCategoria?: string | undefined;
  cnhValidade?: string | undefined;
  observacoes?: string | undefined;
}

const STORAGE_KEY = "rotafacil_driver_profiles_v1";

// Perfis pré-definidos para motoristas iniciais de demonstração do sistema
const INITIAL_PROFILES: Record<string, DriverProfile> = {
  "04512398712": {
    foto: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    cnhCategoria: "D",
    cnhValidade: "2028-05-15",
    observacoes: "Motorista sênior habilitado para caminhões e carga pesada.",
  },
  "09876543210": {
    foto: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80",
    cnhCategoria: "B",
    cnhValidade: "2027-11-20",
    observacoes: "Especialista em entregas urbanas expressas de van e furgão.",
  },
  "01234567890": {
    foto: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    cnhCategoria: "E",
    cnhValidade: "2029-02-10",
    observacoes: "Condutor especializado em carretas e distribuição metropolitana.",
  },
};

function readStorage(): Record<string, DriverProfile> {
  if (typeof window === "undefined") return INITIAL_PROFILES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_PROFILES));
      return INITIAL_PROFILES;
    }
    const parsed = JSON.parse(raw);
    return { ...INITIAL_PROFILES, ...parsed };
  } catch {
    return INITIAL_PROFILES;
  }
}

function writeStorage(data: Record<string, DriverProfile>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    window.dispatchEvent(new CustomEvent("rotafacil:driver-profiles-updated"));
  } catch (err) {
    console.error("Erro ao salvar perfil do motorista:", err);
  }
}

export function getDriverProfile(idOrCnh?: string | null): DriverProfile | null {
  if (!idOrCnh) return null;
  const storage = readStorage();
  return storage[idOrCnh] || null;
}

export function saveDriverProfile(id: string, profile: DriverProfile, cnh?: string) {
  const storage = readStorage();
  const existing = storage[id] || (cnh ? storage[cnh] : null) || {};
  const updated = {
    ...storage,
    [id]: {
      ...existing,
      ...profile,
    },
  };
  if (cnh && cnh !== id) {
    updated[cnh] = {
      ...existing,
      ...profile,
    };
  }
  writeStorage(updated);
}

export function useDriverProfile(idOrCnh?: string | null) {
  const [profile, setProfile] = useState<DriverProfile | null>(() => getDriverProfile(idOrCnh));

  useEffect(() => {
    function refresh() {
      setProfile(getDriverProfile(idOrCnh));
    }
    refresh();
    window.addEventListener("rotafacil:driver-profiles-updated", refresh);
    return () => window.removeEventListener("rotafacil:driver-profiles-updated", refresh);
  }, [idOrCnh]);

  return profile;
}
