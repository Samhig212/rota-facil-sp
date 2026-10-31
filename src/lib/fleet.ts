import { queryOptions } from "@tanstack/react-query";
import { api } from "@/lib/api";

export type Vehicle = {
  id: string;
  placa: string;
  modelo: string;
  km_atual: number;
  ativo: boolean;
  created_at: string;
};

export type Driver = {
  id: string;
  nome: string;
  cnh: string;
  telefone: string;
  foto?: string | null;
  cnh_foto?: string | null;
  cnh_categoria?: string;
  cnh_validade?: string;
  ativo: boolean;
  created_at: string;
};

export type Invoice = {
  id: string;
  numero: string;
  serie: string;
  chave: string;
  destinatario: string;
  cep: string;
  logradouro: string;
  numero_endereco: string;
  bairro: string;
  cidade: string;
  valor: number;
  volumes: number;
  lat: number | null;
  lng: number | null;
  status: string;
  motivo_devolucao: string | null;
  route_id: string | null;
  ordem: number | null;
  created_at: string;
};

export type RouteRow = {
  id: string;
  vehicle_id: string;
  driver_id: string;
  data: string;
  km_inicial: number;
  km_final: number | null;
  status: string;
  closed_at: string | null;
  created_at: string;
};

export type RouteWithRefs = RouteRow & {
  vehicles: Pick<Vehicle, "placa" | "modelo"> | null;
  drivers: Pick<Driver, "nome"> | null;
};

export type InvoiceStatus = "pendente" | "em_rota" | "entregue" | "devolvida";

export const STATUS_LABEL: Record<InvoiceStatus, string> = {
  pendente: "Pendente",
  em_rota: "Em rota",
  entregue: "Entregue",
  devolvida: "Devolvida",
};

export const MOTIVOS_DEVOLUCAO = [
  "Destinatário ausente",
  "Endereço não localizado",
  "Recusa do destinatário",
  "Mercadoria avariada",
  "Divergência de pedido",
  "Estabelecimento fechado",
  "Outro",
];

export const vehiclesQuery = queryOptions({
  queryKey: ["vehicles"],
  queryFn: async (): Promise<Vehicle[]> => {
    return await api.vehicles.list();
  },
});

export const driversQuery = queryOptions({
  queryKey: ["drivers"],
  queryFn: async (): Promise<Driver[]> => {
    return await api.drivers.list();
  },
});

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: async (): Promise<Invoice[]> => {
    return await api.invoices.list();
  },
});

export const routesQuery = queryOptions({
  queryKey: ["routes"],
  queryFn: async (): Promise<RouteWithRefs[]> => {
    return await api.routes.list();
  },
});

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
