import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Navigation, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { LazyMap, type MapStop } from "@/components/LazyMap";
import { PageHeader } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
      [n[idx], n[j]] = [n[j], n[idx]];
      return n;
    });
  }

  const stops: MapStop[] = useMemo(
    () =>
      order
        .filter((i) => i.lat != null && i.lng != null)
        .map((i) => ({
          id: i.id, lat: i.lat!, lng: i.lng!, status: "em_rota",
          label: String(order.indexOf(i) + 1),
          title: `${order.indexOf(i) + 1}. NF ${i.numero}`, subtitle: i.destinatario,
        })),
    [order],
  );
  const km = routeDistanceKm(stops);

  async function despachar() {
    if (!vehicleId || !driverId) return toast.error("Selecione veículo e motorista");
    if (!order.length) return toast.error("Selecione ao menos uma nota");
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
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Despacho de carga"
        subtitle={`Saída: ${DEPOT.nome}`}
        actions={
          <Button onClick={despachar} disabled={saving}>
            <Send /> Despachar rota
          </Button>
        }
      />
      <div className="grid flex-1 gap-0 xl:grid-cols-[380px_1fr]">
        <div className="space-y-5 border-r bg-card p-5">
          <div className="space-y-1.5">
            <Label>Veículo</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger><SelectValue placeholder="Selecione o veículo" /></SelectTrigger>
              <SelectContent>
                {vehicles.filter((v) => v.ativo).map((v) => (
                  <SelectItem key={v.id} value={v.id} disabled={busyVehicles.has(v.id)}>
                    {v.placa} · {v.modelo}{busyVehicles.has(v.id) ? " (em rota)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motorista</Label>
            <Select value={driverId} onValueChange={setDriverId}>
              <SelectTrigger><SelectValue placeholder="Selecione o motorista" /></SelectTrigger>
              <SelectContent>
                {drivers.filter((d) => d.ativo).map((d) => (
                  <SelectItem key={d.id} value={d.id} disabled={busyDrivers.has(d.id)}>
                    {d.nome}{busyDrivers.has(d.id) ? " (em rota)" : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>KM inicial do hodômetro</Label>
            <Input type="number" className="font-mono" value={kmInicial} onChange={(e) => setKmInicial(e.target.value)} />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold uppercase tracking-wide">Notas pendentes ({pendentes.length})</h3>
              <Button size="sm" variant="ghost" onClick={() => setOrder(pendentes)} disabled={!pendentes.length}>Todas</Button>
            </div>
            <div className="max-h-64 space-y-1 overflow-y-auto">
              {pendentes.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma nota pendente. Lance NF-e primeiro.</p>}
              {pendentes.map((i) => (
                <label key={i.id} className="flex cursor-pointer items-start gap-3 rounded-md p-2 hover:bg-muted">
                  <Checkbox checked={selectedIds.has(i.id)} onCheckedChange={() => toggle(i)} className="mt-0.5" />
                  <div className="min-w-0 text-sm">
                    <div className="font-semibold"><span className="font-mono">NF {i.numero}</span> · {i.destinatario}</div>
                    <div className="truncate text-xs text-muted-foreground">{i.bairro} · {formatCep(i.cep)}{i.lat == null && " · sem coordenadas"}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-col">
          <div className="h-96 xl:h-[55vh]">
            <LazyMap stops={stops} showRoute />
          </div>
          <div className="flex-1 p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-bold">Sequência de paradas</h3>
                <p className="text-xs text-muted-foreground">
                  {order.length} paradas · ~<span className="font-mono">{km.toFixed(1)}</span> km em linha reta
                </p>
              </div>
              <Button variant="secondary" onClick={() => setOrder(orderByProximity(order))} disabled={order.length < 2}>
                <Navigation /> Ordenar por proximidade
              </Button>
            </div>
            <ol className="space-y-1.5">
              {order.map((i, idx) => (
                <li key={i.id} className="flex items-center gap-3 rounded-md border bg-card p-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary font-mono text-xs font-bold text-primary-foreground">{idx + 1}</span>
                  <div className="min-w-0 flex-1 text-sm">
                    <span className="font-mono font-bold">NF {i.numero}</span> · {i.destinatario}
                    <div className="truncate text-xs text-muted-foreground">{i.logradouro}, {i.numero_endereco} · {i.bairro}</div>
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => move(idx, -1)} aria-label="Subir"><ArrowUp /></Button>
                  <Button size="icon" variant="ghost" onClick={() => move(idx, 1)} aria-label="Descer"><ArrowDown /></Button>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
