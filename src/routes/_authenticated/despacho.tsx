import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, CheckCircle, Navigation, Send, Sparkles, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
import { DEPOT, formatCep, orderByProximity, routeDistanceKm } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/despacho")({
  head: () => ({
    meta: [
      { title: "Despacho — RotaFacil SP" },
      { name: "description", content: "Monte rotas escolhendo veículo, motorista e ordem das paradas." },
      { property: "og:title", content: "Despacho — RotaFacil SP" },
      { property: "og:description", content: "Monte rotas escolhendo veículo, motorista e ordem das paradas." },
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

  const stops: MapStop[] = useMemo(
    () =>
      order
        .filter((i) => i.lat != null && i.lng != null)
        .map((i) => ({
          id: i.id,
          lat: i.lat!,
          lng: i.lng!,
          status: "em_rota",
          label: String(order.indexOf(i) + 1),
          title: `${order.indexOf(i) + 1}. NF ${i.numero}`,
          subtitle: i.destinatario,
        })),
    [order],
  );
  const km = routeDistanceKm(stops);

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
      const { data: route, error } = await supabase
        .from("routes")
        .insert({ vehicle_id: vehicleId, driver_id: driverId, km_inicial: Number(kmInicial) || 0 })
        .select()
        .single();
      if (error) throw error;
      const results = await Promise.all(
        order.map((inv, idx) =>
          supabase.from("invoices").update({ status: "em_rota", route_id: route.id, ordem: idx + 1 }).eq("id", inv.id),
        ),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      toast.success(`Rota despachada com ${order.length} paradas`);
      await Promise.all([qc.invalidateQueries({ queryKey: ["invoices"] }), qc.invalidateQueries({ queryKey: ["routes"] })]);
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
        title="Despacho de Carga"
        subtitle={`Base de saída: ${DEPOT.nome} · Centro de Distribuição SP`}
        actions={
          <Button
            onClick={despachar}
            disabled={saving || !order.length}
            className="rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold shadow-md shadow-amber-500/20 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 gap-2"
          >
            <Send size={16} /> Despachar Rota ({order.length})
          </Button>
        }
      />

      <div className="grid flex-1 gap-6 p-6 sm:p-8 xl:grid-cols-[400px_1fr]">
        {/* Bento Card: Configuração da Rota */}
        <div className="space-y-5 rounded-2xl border border-border/70 bg-card/90 p-5 sm:p-6 shadow-sm backdrop-blur-xs">
          <div className="border-b border-border/60 pb-3">
            <h2 className="text-base font-extrabold tracking-tight text-foreground">
              Composição da Viagem
            </h2>
            <p className="text-xs text-muted-foreground">
              Defina frota, condutor e paradas a entregar
            </p>
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
                      {v.placa} · {v.modelo}{busyVehicles.has(v.id) ? " (em rota)" : ""}
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
                      {d.nome}{busyDrivers.has(d.id) ? " (em rota)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

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

              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 p-2 bg-muted/20">
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

        {/* Bento Card: Mapa e Sequência Otimizada */}
        <div className="flex flex-col gap-6">
          <div className="h-80 xl:h-[45vh] rounded-2xl border border-border/70 overflow-hidden shadow-sm relative">
            <LazyMap stops={stops} showRoute />
          </div>

          <div className="rounded-2xl border border-border/70 bg-card/90 p-5 sm:p-6 shadow-sm backdrop-blur-xs flex-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3">
              <div>
                <h3 className="font-extrabold text-base tracking-tight text-foreground flex items-center gap-2">
                  Sequência das Paradas
                  {order.length > 0 && (
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-primary/15 text-primary border border-primary/20">
                      {order.length} {order.length === 1 ? "parada" : "paradas"}
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Distância estimada: ~<strong className="font-mono text-foreground">{km.toFixed(1)} km</strong> saindo do CD
                </p>
              </div>

              <Button
                variant="secondary"
                size="sm"
                className="rounded-xl transition-all duration-200 hover:scale-105 gap-1.5 text-xs font-semibold"
                onClick={() => setOrder(orderByProximity(order))}
                disabled={order.length < 2}
              >
                <Navigation size={14} />
                <span>Otimizar por Proximidade</span>
              </Button>
            </div>

            {order.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-1">
                <Truck className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">Nenhuma nota selecionada</p>
                <p className="text-xs">
                  Marque as notas fiscais à esquerda para traçar a rota no mapa.
                </p>
              </div>
            ) : (
              <ol className="space-y-2">
                {order.map((i, idx) => (
                  <li
                    key={i.id}
                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/20 p-2.5 transition-all duration-150 hover:bg-muted/50 hover:border-border"
                  >
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-400 to-amber-500 font-mono text-xs font-black text-stone-950 shadow-xs">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-foreground">NF {i.numero}</span>
                        <span className="text-muted-foreground font-semibold">· {i.destinatario}</span>
                      </div>
                      <div className="truncate text-muted-foreground text-[11px] mt-0.5">
                        {i.logradouro}, {i.numero_endereco} · {i.bairro} ({formatCep(i.cep)})
                      </div>
                    </div>
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
                ))}
              </ol>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
