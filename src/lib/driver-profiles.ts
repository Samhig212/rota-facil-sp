import { useEffect, useState } from "react";

export interface DriverProfile {
  foto?: string;
  cnhFoto?: string;
  cnhCategoria?: string;
  cnhValidade?: string;
  observacoes?: string;
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
  const data = readStorage();
  const cleanKey = idOrCnh.trim().replace(/\D/g, "");
  return data[idOrCnh] || (cleanKey ? data[cleanKey] : null) || null;
}

export function saveDriverProfile(
  primaryKey: string,
  profile: DriverProfile,
  secondaryKey?: string,
) {
  if (!primaryKey) return;
  const current = readStorage();
  const updated = { ...current };

  const existing = updated[primaryKey] || {};
  const merged = { ...existing, ...profile };

  updated[primaryKey] = merged;
  if (secondaryKey) {
    updated[secondaryKey] = merged;
    const cleanSec = secondaryKey.replace(/\D/g, "");
    if (cleanSec) updated[cleanSec] = merged;
  }

  const cleanPrimary = primaryKey.replace(/\D/g, "");
  if (cleanPrimary) updated[cleanPrimary] = merged;

  writeStorage(updated);
}

export function deleteDriverProfile(key: string) {
  const current = readStorage();
  delete current[key];
  const clean = key.replace(/\D/g, "");
  if (clean) delete current[clean];
  writeStorage(current);
}

export function useDriverProfile(idOrCnh?: string | null): DriverProfile | null {
  const [profile, setProfile] = useState<DriverProfile | null>(() => getDriverProfile(idOrCnh));

  useEffect(() => {
    setProfile(getDriverProfile(idOrCnh));
    const handleUpdate = () => {
      setProfile(getDriverProfile(idOrCnh));
    };
    window.addEventListener("rotafacil:driver-profiles-updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("rotafacil:driver-profiles-updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, [idOrCnh]);

  return profile;
}

