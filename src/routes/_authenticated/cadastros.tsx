import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Plate } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { driversQuery, vehiclesQuery } from "@/lib/fleet";

export const Route = createFileRoute("/_authenticated/cadastros")({
  head: () => ({
    meta: [
      { title: "Frota e motoristas — RotaFacil SP" },
      { name: "description", content: "Cadastro de veículos e motoristas da frota própria." },
      { property: "og:title", content: "Frota e motoristas — RotaFacil SP" },
      { property: "og:description", content: "Cadastro de veículos e motoristas da frota própria." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([context.queryClient.ensureQueryData(vehiclesQuery), context.queryClient.ensureQueryData(driversQuery)]),
  component: CadastrosPage,
});

function CadastrosPage() {
  const { data: vehicles } = useSuspenseQuery(vehiclesQuery);
  const { data: drivers } = useSuspenseQuery(driversQuery);
  const qc = useQueryClient();
  const [v, setV] = useState({ placa: "", modelo: "", km: "" });
  const [d, setD] = useState({ nome: "", cnh: "", telefone: "" });

  async function run(p: PromiseLike<{ error: { message: string } | null }>, key: string, ok: string) {
    const { error } = await p;
    if (error) return toast.error(error.message), false;
    toast.success(ok);
    qc.invalidateQueries({ queryKey: [key] });
    return true;
  }

  return (
    <div>
      <PageHeader title="Frota & Motoristas" subtitle="Veículos próprios e equipe de entrega" />
      <div className="grid gap-6 p-6 lg:grid-cols-2">
        <section className="rounded-lg border bg-card">
          <h2 className="border-b p-4 font-bold">Veículos</h2>
          <form
            className="grid grid-cols-[1fr_1.4fr_1fr_auto] gap-2 border-b p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(supabase.from("vehicles").insert({ placa: v.placa.toUpperCase(), modelo: v.modelo, km_atual: Number(v.km) || 0 }), "vehicles", "Veículo cadastrado"))
                setV({ placa: "", modelo: "", km: "" });
            }}
          >
            <Input required placeholder="Placa" className="font-mono uppercase" value={v.placa} onChange={(e) => setV({ ...v, placa: e.target.value })} />
            <Input placeholder="Modelo" value={v.modelo} onChange={(e) => setV({ ...v, modelo: e.target.value })} />
            <Input type="number" placeholder="KM atual" value={v.km} onChange={(e) => setV({ ...v, km: e.target.value })} />
            <Button type="submit" size="icon" aria-label="Adicionar veículo"><Plus /></Button>
          </form>
          {vehicles.map((x) => (
            <div key={x.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <Plate>{x.placa}</Plate>
              <span className="flex-1 text-sm">{x.modelo}</span>
              <span className="font-mono text-sm">{x.km_atual.toLocaleString("pt-BR")} km</span>
              <Switch checked={x.ativo} onCheckedChange={(c) => run(supabase.from("vehicles").update({ ativo: c }).eq("id", x.id), "vehicles", c ? "Veículo ativado" : "Veículo inativado")} />
            </div>
          ))}
        </section>

        <section className="rounded-lg border bg-card">
          <h2 className="border-b p-4 font-bold">Motoristas</h2>
          <form
            className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 border-b p-4"
            onSubmit={async (e) => {
              e.preventDefault();
              if (await run(supabase.from("drivers").insert(d), "drivers", "Motorista cadastrado")) setD({ nome: "", cnh: "", telefone: "" });
            }}
          >
            <Input required placeholder="Nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
            <Input placeholder="CNH" value={d.cnh} onChange={(e) => setD({ ...d, cnh: e.target.value })} />
            <Input placeholder="Telefone" value={d.telefone} onChange={(e) => setD({ ...d, telefone: e.target.value })} />
            <Button type="submit" size="icon" aria-label="Adicionar motorista"><Plus /></Button>
          </form>
          {drivers.map((x) => (
            <div key={x.id} className="flex items-center gap-3 border-b px-4 py-3 last:border-b-0">
              <span className="flex-1 text-sm font-semibold">{x.nome}</span>
              <span className="font-mono text-xs text-muted-foreground">{x.cnh}</span>
              <span className="text-sm">{x.telefone}</span>
              <Switch checked={x.ativo} onCheckedChange={(c) => run(supabase.from("drivers").update({ ativo: c }).eq("id", x.id), "drivers", c ? "Motorista ativado" : "Motorista inativado")} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
