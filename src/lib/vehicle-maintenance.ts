import { useEffect, useState } from "react";
import type { Vehicle } from "./fleet";

export type MaintenanceType =
  | "oleo_filtros"
  | "vistoria"
  | "freios"
  | "pneus"
  | "revisao_geral"
  | "suspensao"
  | "outro";

export const MAINTENANCE_TYPE_LABELS: Record<MaintenanceType, string> = {
  oleo_filtros: "Troca de Óleo e Filtros",
  vistoria: "Vistoria / Inspeção Veicular",
  freios: "Freios e Pastilhas",
  pneus: "Pneus, Rodízio e Alinhamento",
  revisao_geral: "Revisão Geral Preventiva",
  suspensao: "Suspensão e Amortecedores",
  outro: "Outro Reparo / Preventiva",
};

export interface MaintenanceRecord {
  id: string;
  vehicleId: string;
  tipo: MaintenanceType;
  descricao: string;
  kmRegistro: number;
  kmProxima?: number | null | undefined;
  intervaloKm?: number | undefined;
  dataRegistro: string;
  dataValidadeVistoria?: string | null | undefined;
  custo?: number | undefined;
  oficina?: string | undefined;
  observacoes?: string | undefined;
}

const STORAGE_KEY = "rotafacil_vehicle_maintenance_v1";

// Registros de demonstração iniciais
const INITIAL_RECORDS: MaintenanceRecord[] = [
  {
    id: "m-001",
    vehicleId: "v-001", // Fiat Fiorino (KM 48210)
    tipo: "oleo_filtros",
    descricao: "Troca de óleo 5W30 sintético e filtro de óleo/ar",
    kmRegistro: 40000,
    kmProxima: 50000,
    intervaloKm: 10000,
    dataRegistro: "2026-08-15",
    oficina: "Auto Mecânica Barra Funda",
    custo: 380,
    observacoes: "Próxima troca em 50.000 KM.",
  },
  {
    id: "m-002",
    vehicleId: "v-001",
    tipo: "vistoria",
    descricao: "Vistoria veicular anual e emissão de laudo técnico",
    kmRegistro: 42000,
    dataRegistro: "2026-09-01",
    dataValidadeVistoria: "2027-09-01",
    oficina: "Posto de Vistoria Detran SP",
    custo: 210,
    observacoes: "Veículo 100% aprovado sem apontamentos.",
  },
  {
    id: "m-002-v2",
    vehicleId: "v-002", // VW Delivery (KM 112540)
    tipo: "revisao_geral",
    descricao: "Revisão periódica pesada de 100.000 KM",
    kmRegistro: 100000,
    kmProxima: 110000, // VENCIDA (KM atual é 112540)
    intervaloKm: 10000,
    dataRegistro: "2026-06-10",
    dataValidadeVistoria: "2026-11-20", // prestes a vencer
    oficina: "Concessionária VW Caminhões",
    custo: 1850,
    observacoes: "ATENÇÃO: Ultrapassou o limite de 110.000 KM para revisão preventiva dos bicos e fluidos.",
  },
  {
    id: "m-003",
    vehicleId: "v-003", // Renault Master (KM 76300)
    tipo: "freios",
    descricao: "Troca de pastilhas dianteiras e sangria de fluido",
    kmRegistro: 65000,
    kmProxima: 85000,
    intervaloKm: 20000,
    dataRegistro: "2026-07-20",
    dataValidadeVistoria: "2027-07-20",
    oficina: "Master Freios Express",
    custo: 740,
    observacoes: "Em dia. Faltam ~8.700 KM para a próxima checagem.",
  },
];

function readStorage(): MaintenanceRecord[] {
  if (typeof window === "undefined") return INITIAL_RECORDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_RECORDS));
      return INITIAL_RECORDS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_RECORDS;
  }
}

function writeStorage(records: MaintenanceRecord[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    window.dispatchEvent(new CustomEvent("rotafacil:maintenance-updated"));
  } catch (err) {
    console.error("Erro ao salvar manutenções:", err);
  }
}

export function getMaintenanceRecords(vehicleId?: string): MaintenanceRecord[] {
  const all = readStorage();
  if (!vehicleId) return all;
  return all.filter((r) => r.vehicleId === vehicleId);
}

export function addMaintenanceRecord(
  rec: Omit<MaintenanceRecord, "id" | "dataRegistro">,
): MaintenanceRecord {
  const all = readStorage();
  const newRec: MaintenanceRecord = {
    ...rec,
    id: `m-${Date.now()}`,
    dataRegistro: new Date().toISOString().split("T")[0]!,
  };
  const updated = [newRec, ...all];
  writeStorage(updated);
  return newRec;
}

export function deleteMaintenanceRecord(id: string): void {
  const all = readStorage();
  const updated = all.filter((r) => r.id !== id);
  writeStorage(updated);
}

export interface VehicleMaintenanceHealth {
  status: "em_dia" | "proxima" | "vencida";
  kmAtual: number;
  proximoKmMenor?: number | undefined;
  kmFaltantesMenor?: number | undefined;
  diasValidadeVistoriaMenor?: number | undefined;
  servicosVencidos: string[];
  servicosProximos: string[];
  recordsCount: number;
}

export function evaluateVehicleMaintenance(
  vehicle: Vehicle,
  allRecords?: MaintenanceRecord[],
): VehicleMaintenanceHealth {
  const records = allRecords || getMaintenanceRecords(vehicle.id);
  const vehicleRecords = records.filter((r) => r.vehicleId === vehicle.id);

  const servicosVencidos: string[] = [];
  const servicosProximos: string[] = [];
  let proximoKmMenor: number | undefined = undefined;
  let kmFaltantesMenor: number | undefined = undefined;
  let diasValidadeVistoriaMenor: number | undefined = undefined;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const r of vehicleRecords) {
    const nomeServico = MAINTENANCE_TYPE_LABELS[r.tipo] || r.descricao || "Manutenção";

    // Checagem por KM
    if (r.kmProxima != null && r.kmProxima > 0) {
      const diff = r.kmProxima - vehicle.km_atual;
      if (proximoKmMenor === undefined || r.kmProxima < proximoKmMenor) {
        proximoKmMenor = r.kmProxima;
        kmFaltantesMenor = diff;
      }

      if (diff <= 0) {
        servicosVencidos.push(`${nomeServico} (venceu há ${Math.abs(diff).toLocaleString("pt-BR")} km)`);
      } else if (diff <= 1500) {
        servicosProximos.push(`${nomeServico} (em ${diff.toLocaleString("pt-BR")} km)`);
      }
    }

    // Checagem por Data de Vistoria
    if (r.dataValidadeVistoria) {
      try {
        const valDate = new Date(r.dataValidadeVistoria + "T00:00:00");
        const diffTime = valDate.getTime() - today.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diasValidadeVistoriaMenor === undefined || diffDays < diasValidadeVistoriaMenor) {
          diasValidadeVistoriaMenor = diffDays;
        }

        if (diffDays < 0) {
          servicosVencidos.push(`Vistoria Vencida (${Math.abs(diffDays)} dias atrás)`);
        } else if (diffDays <= 30) {
          servicosProximos.push(`Vistoria a vencer em ${diffDays} dias`);
        }
      } catch {
        // formato de data inválido ignorado
      }
    }
  }

  let status: "em_dia" | "proxima" | "vencida" = "em_dia";
  if (servicosVencidos.length > 0) {
    status = "vencida";
  } else if (servicosProximos.length > 0) {
    status = "proxima";
  }

  return {
    status,
    kmAtual: vehicle.km_atual,
    proximoKmMenor,
    kmFaltantesMenor,
    diasValidadeVistoriaMenor,
    servicosVencidos,
    servicosProximos,
    recordsCount: vehicleRecords.length,
  };
}

export function getAllMaintenanceAlerts(vehicles: Vehicle[]) {
  const records = getMaintenanceRecords();
  const alerts: Array<{
    vehicle: Vehicle;
    tipo: "vencida" | "proxima";
    titulo: string;
    detalhes: string[];
    kmAtual: number;
  }> = [];

  for (const v of vehicles) {
    if (!v.ativo) continue;
    const health = evaluateVehicleMaintenance(v, records);
    if (health.status === "vencida") {
      alerts.push({
        vehicle: v,
        tipo: "vencida",
        titulo: `Manutenção VENCIDA: ${v.placa} (${v.modelo})`,
        detalhes: health.servicosVencidos,
        kmAtual: v.km_atual,
      });
    } else if (health.status === "proxima") {
      alerts.push({
        vehicle: v,
        tipo: "proxima",
        titulo: `Manutenção Próxima: ${v.placa} (${v.modelo})`,
        detalhes: health.servicosProximos,
        kmAtual: v.km_atual,
      });
    }
  }

  const urgentCount = alerts.filter((a) => a.tipo === "vencida").length;
  const warningCount = alerts.filter((a) => a.tipo === "proxima").length;

  return { alerts, urgentCount, warningCount, totalCount: alerts.length };
}

export function useVehicleMaintenance() {
  const [records, setRecords] = useState<MaintenanceRecord[]>(() => readStorage());

  useEffect(() => {
    function refresh() {
      setRecords(readStorage());
    }
    window.addEventListener("rotafacil:maintenance-updated", refresh);
    return () => window.removeEventListener("rotafacil:maintenance-updated", refresh);
  }, []);

  return {
    records,
    addRecord: addMaintenanceRecord,
    deleteRecord: deleteMaintenanceRecord,
  };
}
