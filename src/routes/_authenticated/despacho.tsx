import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  FileText,
  IdCard,
  MapPin,
  Navigation,
  Send,
  Sparkles,
  Truck,
  UserCheck,
  Zap,
} from "lucide-react";
import { api } from "@/lib/api";
import { LazyMap, type MapStop } from "@/components/LazyMap";
import { PageHeader } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { driversQuery, invoicesQuery, routesQuery, vehiclesQuery, type Invoice } from "@/lib/fleet";
import { DEPOT, formatCep, haversineKm, orderByProximity, routeDistanceKm } from "@/lib/geo";
import { getDriverProfile } from "@/lib/driver-profiles";

export const Route = createFileRoute("/_authenticated/despacho")({
  head: () => ({
    meta: [
      { title: "Despacho & Rota Estratégica — RotaFacil SP" },
      { name: "description", content: "Monte rotas estratégicas de uma nota mais próxima à outra." },
      { property: "og:title", content: "Despacho & Rota Estratégica — RotaFacil SP" },
      { property: "og:description", content: "Monte rotas estratégicas de uma nota mais próxima à outra." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(invoicesQuery),
      context.queryClient.ensureQueryData(vehiclesQuery),
      context.queryClient.ensureQueryData(driversQuery),
      context.queryClient.ensureQueryData(routesQuery),
    ]),
  component: DespachoPage,
});

function DespachoPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const { data: vehicles } = useSuspenseQuery(vehiclesQuery);
  const { data: drivers } = useSuspenseQuery(driversQuery);
  const { data: routes } = useSuspenseQuery(routesQuery);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const busyVehicles = new Set(routes.filter((r) => r.status === "aberta").map((r) => r.vehicle_id));
  const busyDrivers = new Set(routes.filter((r) => r.status === "aberta").map((r) => r.driver_id));
  const pendentes = invoices.filter((i) => i.status === "pendente");

  const [vehicleId, setVehicleId] = useState("");
  const [driverId, setDriverId] = useState("");
  const [kmInicial, setKmInicial] = useState("");
  const [order, setOrder] = useState<Invoice[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (v) setKmInicial(String(v.km_atual));
  }, [vehicleId, vehicles]);

  const selectedDriver = useMemo(() => drivers.find((d) => d.id === driverId), [drivers, driverId]);
  const selectedDriverProfile = useMemo(
    () => {
      if (!selectedDriver) return null;
      const prof = getDriverProfile(selectedDriver.id) || getDriverProfile(selectedDriver.cnh);
      return {
        foto: selectedDriver.foto || prof?.foto,
        cnhFoto: selectedDriver.cnh_foto || prof?.cnhFoto,
        cnhCategoria: selectedDriver.cnh_categoria || prof?.cnhCategoria,
      };
    },
    [selectedDriver],
  );

  const selectedIds = new Set(order.map((o) => o.id));
  function toggle(inv: Invoice) {
    setOrder((o) => (selectedIds.has(inv.id) ? o.filter((x) => x.id !== inv.id) : [...o, inv]));
  }

  function move(idx: number, dir: -1 | 1) {
    setOrder((o) => {
      const n = [...o];
      const j = idx + dir;
      if (j < 0 || j >= n.length) return o;
      const a = n[idx];
      const b = n[j];
      if (a && b) {
        n[idx] = b;
        n[j] = a;
      }
      return n;
    });
  }

  // Aplica otimização estratégica da rota:
  // Parte da Base (Rua Professor Oswaldo Quirino Simões, 142) até a nota mais próxima,
  // e daquela nota encontra a seguinte mais próxima, encadeando todo o trajeto.
  function otimizarRotaEstrategica() {
    if (order.length < 2) return;
    const otimizada = orderByProximity(order, DEPOT);
    setOrder(otimizada);
    toast.success("Rota estratégica aplicada! Paradas sequenciadas pela nota mais próxima.");
  }

  // Cálculo das distâncias perna por perna (leg-by-leg)
  const legsInfo = useMemo(() => {
    let cur = { lat: DEPOT.lat, lng: DEPOT.lng };
    let cum = 0;

    return order.map((inv, idx) => {
      let dist = 0;
      if (inv.lat != null && inv.lng != null) {
        dist = haversineKm(cur, { lat: inv.lat, lng: inv.lng });
        cum += dist;
        cur = { lat: inv.lat, lng: inv.lng };
      }
      const prevInv = idx > 0 ? order[idx - 1] : null;
      const sameBairro = prevInv && prevInv.bairro && inv.bairro && prevInv.bairro.toLowerCase() === inv.bairro.toLowerCase();

      return {
        idx,
        dist,
        cum,
        sameBairro,
        prevNumero: prevInv?.numero,
      };
    });
  }, [order]);

  const stops: MapStop[] = useMemo(
    () =>
      order
        .filter((i) => i.lat != null && i.lng != null)
        .map((i, idx) => {
          const leg = legsInfo[idx];
          return {
            id: i.id,
            lat: i.lat!,
            lng: i.lng!,
            status: "em_rota",
            label: String(order.indexOf(i) + 1),
            title: `#${order.indexOf(i) + 1}. NF ${i.numero} — ${i.destinatario}`,
            subtitle: `${i.logradouro}, ${i.numero_endereco} · ${i.bairro} (${formatCep(i.cep)})`,
            distFromPrev: leg?.dist,
          };
        }),
    [order, legsInfo],
  );

  const totalKm = routeDistanceKm(stops, DEPOT);

  async function despachar() {
    if (!vehicleId || !driverId) {
      toast.error("Selecione veículo e motorista");
      return;
    }
    if (!order.length) {
      toast.error("Selecione ao menos uma nota");
      return;
    }
    setSaving(true);
    try {
      const route = await api.routes.create({
        vehicle_id: vehicleId,
        driver_id: driverId,
        km_inicial: Number(kmInicial) || 0,
      });

      await Promise.all(
        order.map((inv, idx) =>
          api.invoices.update(inv.id, {
            status: "em_rota",
            route_id: route.id,
            ordem: idx + 1,
          }),
        ),
      );

      toast.success(`Rota estratégica despachada com ${order.length} paradas sequenciadas`);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["invoices"] }),
        qc.invalidateQueries({ queryKey: ["routes"] }),
      ]);
      setOrder([]);
      navigate({ to: "/fechamento" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background animate-in fade-in-50 duration-300">
      <PageHeader
        title="Despacho de Carga & Rota Estratégica"
        subtitle={`Base de Saída: ${DEPOT.nome} (${DEPOT.endereco})`}
        actions={
          <Button
            onClick={despachar}
            disabled={saving || !order.length}
            className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 gap-2"
          >
            <Send size={16} /> Despachar Rota ({order.length})
          </Button>
        }
      />

      <div className="grid flex-1 gap-6 p-6 sm:p-8 xl:grid-cols-[420px_1fr]">
        {/* Bento Card: Configuração da Rota & Motorista */}
        <div className="space-y-5 rounded-2xl border border-border/70 bg-card/90 p-5 sm:p-6 shadow-sm backdrop-blur-xs">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-foreground">
                Composição da Viagem
              </h2>
              <p className="text-xs text-muted-foreground">
                Defina o condutor com CNH, veículo e notas a despachar
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              <Zap size={13} />
              <span>SP Estratégico</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Veículo da Frota</Label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o veículo" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {vehicles.filter((v) => v.ativo).map((v) => (
                    <SelectItem key={v.id} value={v.id} disabled={busyVehicles.has(v.id)}>
                      {v.placa} · {v.modelo}
                      {busyVehicles.has(v.id) ? " (em rota)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Motorista Responsável</Label>
              <Select value={driverId} onValueChange={setDriverId}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Selecione o motorista" />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  {drivers.filter((d) => d.ativo).map((d) => (
                    <SelectItem key={d.id} value={d.id} disabled={busyDrivers.has(d.id)}>
                      {d.nome}
                      {busyDrivers.has(d.id) ? " (em rota)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Card com Foto e CNH do Motorista Selecionado */}
            {selectedDriver && (
              <div className="rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/50 dark:bg-blue-950/20 p-3 flex items-center gap-3 animate-in fade-in-50">
                <div className="relative h-11 w-11 shrink-0 rounded-xl overflow-hidden border border-blue-300 dark:border-blue-800 bg-card shadow-xs flex items-center justify-center font-bold text-xs uppercase text-primary">
                  {selectedDriverProfile?.foto ? (
                    <img
                      src={selectedDriverProfile.foto}
                      alt={selectedDriver.nome}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span>{selectedDriver.nome.slice(0, 2)}</span>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-foreground truncate">
                      {selectedDriver.nome}
                    </p>
                    {selectedDriverProfile?.cnhCategoria && (
                      <span className="text-[10px] font-mono px-1 rounded bg-blue-600 text-white font-bold">
                        Cat. {selectedDriverProfile.cnhCategoria}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                    CNH: {selectedDriver.cnh || "Cadastrada"} · {selectedDriver.telefone || "Sem fone"}
                  </p>
                </div>

                <div className="text-right">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                    <CheckCircle size={11} /> Apto
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">KM Inicial do Hodômetro</Label>
              <Input
                type="number"
                className="font-mono rounded-xl"
                value={kmInicial}
                onChange={(e) => setKmInicial(e.target.value)}
                placeholder="Ex: 45200"
              />
            </div>

            {/* Seletor de Notas Fiscais Pendentes */}
            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Notas Pendentes ({pendentes.length})
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs rounded-lg"
                  onClick={() => setOrder(pendentes)}
                  disabled={!pendentes.length}
                >
                  Selecionar Todas
                </Button>
              </div>

              <div className="max-h-64 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 p-2 bg-muted/20">
                {pendentes.length === 0 && (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma nota pendente no momento.
                  </p>
                )}
                {pendentes.map((i) => (
                  <label
                    key={i.id}
                    className="flex cursor-pointer items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-muted/50 border border-transparent hover:border-border/60"
                  >
                    <Checkbox
                      checked={selectedIds.has(i.id)}
                      onCheckedChange={() => toggle(i)}
                      className="mt-0.5 rounded-md"
                    />
                    <div className="min-w-0 text-xs flex-1">
                      <div className="font-semibold text-foreground flex items-center justify-between">
                        <span className="font-mono">NF {i.numero}</span>
                        <span className="text-[10px] text-muted-foreground">{i.volumes} vol</span>
                      </div>
                      <div className="truncate text-foreground/80 font-medium">{i.destinatario}</div>
                      <div className="truncate text-[11px] text-muted-foreground">
                        {i.bairro} · {formatCep(i.cep)}
                        {i.lat == null && " · sem GPS"}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Bento Card: Mapa e Sequência da Rota Estratégica */}
        <div className="flex flex-col gap-6">
          <div className="h-80 xl:h-[42vh] rounded-2xl border border-border/70 overflow-hidden shadow-sm relative">
            <LazyMap stops={stops} showRoute />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 sm:p-6 shadow-sm backdrop-blur-xs flex-1 flex flex-col">
            {/* Header da Rota Estratégica */}
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <h3 className="font-extrabold text-base tracking-tight text-foreground flex items-center gap-2">
                  <span>Sequência Estratégica de Entrega</span>
                  {order.length > 0 && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                      {order.length} {order.length === 1 ? "parada" : "paradas"}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Distância estimada: ~<strong className="font-mono text-foreground">{totalKm.toFixed(1)} km</strong> partindo da Base
                </p>
              </div>

              {/* Botão de Rota Estratégica Mais Próxima */}
              <Button
                variant="default"
                size="sm"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/20 transition-all duration-200 hover:scale-102 gap-1.5 text-xs"
                onClick={otimizarRotaEstrategica}
                disabled={order.length < 2}
                title="Reordena automaticamente cada nota pela proximidade com a anterior"
              >
                <Navigation size={14} />
                <span>Otimizar Rota Estratégica (Mais Próxima)</span>
              </Button>
            </div>

            {/* Informações da Estratégia de Trajeto */}
            {order.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    Modo Rota Estratégica Ativo:
                  </span>
                  <span className="text-blue-700 dark:text-blue-300">
                    Paradas encadeadas de uma nota à sua vizinha mais próxima.
                  </span>
                </div>
                <span className="text-[11px] font-mono font-semibold text-blue-800 dark:text-blue-200">
                  Base: R. Prof. Oswaldo Quirino Simões, 142
                </span>
              </div>
            )}

            {order.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-1 my-auto">
                <Truck className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">Nenhuma nota selecionada</p>
                <p className="text-xs">
                  Marque as notas fiscais à esquerda para visualizar a rota estratégica traçada no mapa.
                </p>
              </div>
            ) : (
              <ol className="space-y-2.5 overflow-y-auto max-h-[420px] pr-1">
                {order.map((i, idx) => {
                  const leg = legsInfo[idx];
                  const isFirst = idx === 0;

                  return (
                    <li
                      key={i.id}
                      className="group relative flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-3 transition-all duration-150 hover:bg-muted/50 hover:border-border"
                    >
                      {/* Indicador de Parada / Step */}
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 font-mono text-xs font-black text-white shadow-xs">
                        {idx + 1}
                      </span>

                      <div className="min-w-0 flex-1 text-xs">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-foreground">NF {i.numero}</span>
                            <span className="text-foreground/80 font-semibold truncate">
                              · {i.destinatario}
                            </span>
                          </div>
                          {leg?.sameBairro && (
                            <span className="hidden sm:inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                              Mesmo Bairro
                            </span>
                          )}
                        </div>

                        <div className="truncate text-muted-foreground text-[11px] mt-0.5">
                          {i.logradouro}, {i.numero_endereco} · {i.bairro} ({formatCep(i.cep)})
                        </div>

                        {/* Detalhe da Proximidade Estratégica */}
                        <div className="flex items-center gap-2 mt-1.5 text-[11px]">
                          {isFirst ? (
                            <span className="inline-flex items-center gap-1 font-semibold text-blue-700 dark:text-blue-300">
                              <MapPin size={12} />
                              Saída da Base (R. Prof. Oswaldo Quirino Simões) → 1ª Entrega ({leg.dist.toFixed(1)} km)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                              <span className="text-xs">🎯</span>
                              Mais Próxima: +{leg.dist.toFixed(1)} km da NF {leg.prevNumero} (Acumulado: {leg.cum.toFixed(1)} km)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Controles de Subir / Descer Manualmente */}
                      <div className="flex items-center gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          onClick={() => move(idx, -1)}
                          aria-label="Subir ordem"
                          disabled={idx === 0}
                        >
                          <ArrowUp size={14} />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                          onClick={() => move(idx, 1)}
                          aria-label="Descer ordem"
                          disabled={idx === order.length - 1}
                        >
                          <ArrowDown size={14} />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
