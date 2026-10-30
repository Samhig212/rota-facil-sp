import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Plus, Search, ShieldCheck, Truck, Users } from "lucide-react";
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
  const [vSearch, setVSearch] = useState("");
  const [dSearch, setDSearch] = useState("");

  async function run(p: PromiseLike<{ error: { message: string } | null }>, key: string, ok: string) {
    const { error } = await p;
    if (error) {
      toast.error(error.message);
      return false;
    }
    toast.success(ok);
    qc.invalidateQueries({ queryKey: [key] });
    return true;
  }

  const filteredVehicles = useMemo(() => {
    const s = vSearch.toLowerCase().trim();
    if (!s) return vehicles;
    return vehicles.filter(
      (x) => x.placa.toLowerCase().includes(s) || (x.modelo && x.modelo.toLowerCase().includes(s)),
    );
  }, [vehicles, vSearch]);

  const filteredDrivers = useMemo(() => {
    const s = dSearch.toLowerCase().trim();
    if (!s) return drivers;
    return drivers.filter(
      (x) => x.nome.toLowerCase().includes(s) || x.cnh.includes(s) || (x.telefone && x.telefone.includes(s)),
    );
  }, [drivers, dSearch]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Frota & Motoristas"
        subtitle="Gerenciamento de veículos próprios e equipe autorizada de entregadores"
      />

      <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-2">
        {/* Bento Card: Veículos */}
        <section className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 text-primary">
                <Truck size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-foreground">
                  Veículos da Frota
                </h2>
                <p className="text-xs text-muted-foreground font-normal">
                  {vehicles.filter((x) => x.ativo).length} ativos de {vehicles.length} cadastrados
                </p>
              </div>
            </div>

            <div className="relative w-36 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={vSearch}
                onChange={(e) => setVSearch(e.target.value)}
                placeholder="Buscar veículo..."
                className="h-8 pl-8 text-xs rounded-xl bg-muted/40"
              />
            </div>
          </div>

          {/* Formulário de Adicionar Veículo */}
          <form
            className="grid grid-cols-[1.1fr_1.4fr_1fr_auto] gap-2 border-b border-border/60 p-4 bg-muted/10"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  supabase.from("vehicles").insert({
                    placa: v.placa.toUpperCase(),
                    modelo: v.modelo,
                    km_atual: Number(v.km) || 0,
                  }),
                  "vehicles",
                  "Veículo cadastrado com sucesso",
                )
              ) {
                setV({ placa: "", modelo: "", km: "" });
              }
            }}
          >
            <Input
              required
              placeholder="Placa (ABC1D23)"
              className="font-mono uppercase text-xs rounded-xl"
              value={v.placa}
              maxLength={8}
              onChange={(e) => setV({ ...v, placa: e.target.value })}
            />
            <Input
              placeholder="Modelo (ex: HR, Sprinter)"
              className="text-xs rounded-xl"
              value={v.modelo}
              onChange={(e) => setV({ ...v, modelo: e.target.value })}
            />
            <Input
              type="number"
              placeholder="KM atual"
              className="font-mono text-xs rounded-xl"
              value={v.km}
              onChange={(e) => setV({ ...v, km: e.target.value })}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold shadow-xs hover:from-amber-400 hover:to-amber-500"
              aria-label="Adicionar veículo"
              title="Cadastrar veículo"
            >
              <Plus size={16} />
            </Button>
          </form>

          {/* Lista de Veículos */}
          <div className="divide-y divide-border/60 flex-1 overflow-y-auto max-h-[480px]">
            {filteredVehicles.length === 0 ? (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Nenhum veículo encontrado.
              </p>
            ) : (
              filteredVehicles.map((x) => (
                <div
                  key={x.id}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                >
                  <Plate>{x.placa}</Plate>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{x.modelo}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      {x.km_atual.toLocaleString("pt-BR")} km registrados
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {x.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={x.ativo}
                      onCheckedChange={(c) =>
                        run(
                          supabase.from("vehicles").update({ ativo: c }).eq("id", x.id),
                          "vehicles",
                          c ? "Veículo ativado" : "Veículo inativado",
                        )
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Bento Card: Motoristas */}
        <section className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden flex flex-col">
          <div className="flex items-center justify-between border-b border-border/60 p-5 bg-muted/20">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400">
                <Users size={18} />
              </div>
              <div>
                <h2 className="text-base font-extrabold tracking-tight text-foreground">
                  Motoristas & Equipe
                </h2>
                <p className="text-xs text-muted-foreground font-normal">
                  {drivers.filter((x) => x.ativo).length} habilitados para escala
                </p>
              </div>
            </div>

            <div className="relative w-36 sm:w-44">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                value={dSearch}
                onChange={(e) => setDSearch(e.target.value)}
                placeholder="Buscar motorista..."
                className="h-8 pl-8 text-xs rounded-xl bg-muted/40"
              />
            </div>
          </div>

          {/* Formulário de Adicionar Motorista */}
          <form
            className="grid grid-cols-[1.5fr_1fr_1fr_auto] gap-2 border-b border-border/60 p-4 bg-muted/10"
            onSubmit={async (e) => {
              e.preventDefault();
              if (
                await run(
                  supabase.from("drivers").insert(d),
                  "drivers",
                  "Motorista cadastrado com sucesso",
                )
              ) {
                setD({ nome: "", cnh: "", telefone: "" });
              }
            }}
          >
            <Input
              required
              placeholder="Nome completo"
              className="text-xs rounded-xl"
              value={d.nome}
              onChange={(e) => setD({ ...d, nome: e.target.value })}
            />
            <Input
              placeholder="CNH (número)"
              className="font-mono text-xs rounded-xl"
              value={d.cnh}
              onChange={(e) => setD({ ...d, cnh: e.target.value })}
            />
            <Input
              placeholder="Telefone"
              className="text-xs rounded-xl"
              value={d.telefone}
              onChange={(e) => setD({ ...d, telefone: e.target.value })}
            />
            <Button
              type="submit"
              size="icon"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-stone-950 font-bold shadow-xs hover:from-amber-400 hover:to-amber-500"
              aria-label="Adicionar motorista"
              title="Cadastrar motorista"
            >
              <Plus size={16} />
            </Button>
          </form>

          {/* Lista de Motoristas */}
          <div className="divide-y divide-border/60 flex-1 overflow-y-auto max-h-[480px]">
            {filteredDrivers.length === 0 ? (
              <p className="p-8 text-center text-xs text-muted-foreground">
                Nenhum motorista encontrado.
              </p>
            ) : (
              filteredDrivers.map((x) => (
                <div
                  key={x.id}
                  className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted font-bold text-xs text-foreground uppercase shrink-0">
                    {x.nome.slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">{x.nome}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">
                      CNH: {x.cnh || "Não informada"} · {x.telefone || "Sem telefone"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {x.ativo ? "Ativo" : "Inativo"}
                    </span>
                    <Switch
                      checked={x.ativo}
                      onCheckedChange={(c) =>
                        run(
                          supabase.from("drivers").update({ ativo: c }).eq("id", x.id),
                          "drivers",
                          c ? "Motorista ativado" : "Motorista inativado",
                        )
                      }
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
