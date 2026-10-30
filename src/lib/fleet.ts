import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Vehicle = Database["public"]["Tables"]["vehicles"]["Row"];
export type Driver = Database["public"]["Tables"]["drivers"]["Row"];
export type Invoice = Database["public"]["Tables"]["invoices"]["Row"];
export type RouteRow = Database["public"]["Tables"]["routes"]["Row"];
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

function unwrap<T>(r: { data: T | null; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data as T;
}

export const vehiclesQuery = queryOptions({
  queryKey: ["vehicles"],
  queryFn: async () =>
    unwrap(await supabase.from("vehicles").select("*").order("placa")) as Vehicle[],
});

export const driversQuery = queryOptions({
  queryKey: ["drivers"],
  queryFn: async () =>
    unwrap(await supabase.from("drivers").select("*").order("nome")) as Driver[],
});

export const invoicesQuery = queryOptions({
  queryKey: ["invoices"],
  queryFn: async () =>
    unwrap(
      await supabase.from("invoices").select("*").order("created_at", { ascending: false }),
    ) as Invoice[],
});

export type RouteWithRefs = RouteRow & {
  vehicles: Pick<Vehicle, "placa" | "modelo"> | null;
  drivers: Pick<Driver, "nome"> | null;
};

export const routesQuery = queryOptions({
  queryKey: ["routes"],
  queryFn: async () =>
    unwrap(
      await supabase
        .from("routes")
        .select("*, vehicles(placa, modelo), drivers(nome)")
        .order("created_at", { ascending: false }),
    ) as RouteWithRefs[],
});

export const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
