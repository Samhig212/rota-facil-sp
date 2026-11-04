import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle,
  Compass,
  FileText,
  IdCard,
  MapPin,
  Navigation,
  Send,
  Sparkles,
  Target,
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
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/despacho")({
  head: () => ({
    meta: [
      { title: "Despacho & Rota Estratégica — RotaFacil SP" },
      { name: "description", content: "Monte rotas estratégicas com nota de referência inteligente." },
      { property: "og:title", content: "Despacho & Rota Estratégica — RotaFacil SP" },
      { property: "og:description", content: "Monte rotas estratégicas com nota de referência inteligente." },
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

  // NOTA DE REFERÊNCIA (Âncora Estratégica da Rota)
  const [referenceInvoiceId, setReferenceInvoiceId] = useState<string | null>(null);
  const [sortByProximityToRef, setSortByProximityToRef] = useState(false);

  useEffect(() => {
    const v = vehicles.find((x) => x.id === vehicleId);
    if (v) setKmInicial(String(v.km_atual));
  }, [vehicleId, vehicles]);

  const selectedDriver = useMemo(() => drivers.find((d) => d.id === driverId), [drivers, driverId]);
  const selectedDriverProfile = useMemo(() => {
    if (!selectedDriver) return null;
    const prof = getDriverProfile(selectedDriver.id) || getDriverProfile(selectedDriver.cnh);
    return {
      foto: selectedDriver.foto || prof?.foto,
      cnhFoto: selectedDriver.cnh_foto || prof?.cnhFoto,
      cnhCategoria: selectedDriver.cnh_categoria || prof?.cnhCategoria,
    };
  }, [selectedDriver]);

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

  // Objeto da Nota de Referência
  const referenceInvoice = useMemo(() => {
    if (!referenceInvoiceId) return null;
    return invoices.find((i) => i.id === referenceInvoiceId) || null;
  }, [invoices, referenceInvoiceId]);

  // Mapa de Proximidade em Relação à Nota Referência
  // 🟢 Perto: <= 6 km
  // 🟡 Média: 6 - 15 km
  // 🔴 Longe: > 15 km
  const proximityMap = useMemo(() => {
    const map = new Map<
      string,
      { dist: number; status: "ref" | "perto" | "medio" | "longe" | "sem_gps" }
    >();

    if (!referenceInvoice || referenceInvoice.lat == null || referenceInvoice.lng == null) {
      return map;
    }

    const refCoord = { lat: Number(referenceInvoice.lat), lng: Number(referenceInvoice.lng) };

    for (const inv of pendentes) {
      if (inv.id === referenceInvoice.id) {
        map.set(inv.id, { dist: 0, status: "ref" });
      } else if (
        inv.lat != null &&
        inv.lng != null &&
        !Number.isNaN(Number(inv.lat)) &&
        !Number.isNaN(Number(inv.lng))
      ) {
        const d = haversineKm(refCoord, { lat: Number(inv.lat), lng: Number(inv.lng) });
        const status = d <= 6 ? "perto" : d <= 15 ? "medio" : "longe";
        map.set(inv.id, { dist: d, status });
      } else {
        map.set(inv.id, { dist: Infinity, status: "sem_gps" });
      }
    }

    return map;
  }, [referenceInvoice, pendentes]);

  // Contagem de proximidades
  const proximityCounts = useMemo(() => {
    let perto = 0;
    let medio = 0;
    let longe = 0;

    for (const [id, data] of proximityMap.entries()) {
      if (id === referenceInvoiceId) continue;
      if (data.status === "perto") perto++;
      else if (data.status === "medio") medio++;
      else if (data.status === "longe") longe++;
    }

    return { perto, medio, longe };
  }, [proximityMap, referenceInvoiceId]);

  // Lista de pendentes ordenada (por proximidade da nota referência se ativado)
  const sortedPendentes = useMemo(() => {
    if (!referenceInvoice || !sortByProximityToRef) return pendentes;

    return [...pendentes].sort((a, b) => {
      if (a.id === referenceInvoice.id) return -1;
      if (b.id === referenceInvoice.id) return 1;

      const distA = proximityMap.get(a.id)?.dist ?? Infinity;
      const distB = proximityMap.get(b.id)?.dist ?? Infinity;
      return distA - distB;
    });
  }, [pendentes, referenceInvoice, sortByProximityToRef, proximityMap]);

  // Ação Rápida: Selecionar todas as notas próximas (Verdes)
  function selecionarTodasProximas() {
    if (!referenceInvoice) return;
    const proximas = pendentes.filter((inv) => {
      const p = proximityMap.get(inv.id);
      return inv.id === referenceInvoice.id || p?.status === "perto";
    });

    const newSet = new Set(selectedIds);
    for (const p of proximas) {
      newSet.add(p.id);
    }
    const merged = pendentes.filter((i) => newSet.has(i.id));
    setOrder(merged);
    toast.success(`Selecionadas ${proximas.length} notas na mesma região da Nota Referência!`);
  }

  // Otimização estratégica considerando a Nota de Referência como âncora inicial da rota
  function otimizarRotaEstrategica() {
    if (order.length < 2) return;

    if (referenceInvoice && selectedIds.has(referenceInvoice.id)) {
      // Começa da Base -> vai à Nota Referência -> encadeia os vizinhos mais próximos
      const withoutRef = order.filter((i) => i.id !== referenceInvoice.id);
      const sequenced = orderByProximity(withoutRef, {
        lat: Number(referenceInvoice.lat),
        lng: Number(referenceInvoice.lng),
      });
      setOrder([referenceInvoice, ...sequenced]);
      toast.success(
        `Rota otimizada a partir da Nota Referência NF ${referenceInvoice.numero} até as mais próximas!`,
      );
    } else {
      const otimizada = orderByProximity(order, DEPOT);
      setOrder(otimizada);
      toast.success("Rota estratégica aplicada! Paradas sequenciadas da Base até a nota mais próxima.");
    }
  }

  // Cálculo das distâncias perna por perna
  const legsInfo = useMemo(() => {
    let cur = { lat: DEPOT.lat, lng: DEPOT.lng };
    let cum = 0;

    return order.map((inv, idx) => {
      let dist = 0;
      if (
        inv.lat != null &&
        inv.lng != null &&
        !Number.isNaN(Number(inv.lat)) &&
        !Number.isNaN(Number(inv.lng))
      ) {
        dist = haversineKm(cur, { lat: Number(inv.lat), lng: Number(inv.lng) });
        cum += dist;
        cur = { lat: Number(inv.lat), lng: Number(inv.lng) };
      }
      const prevInv = idx > 0 ? order[idx - 1] : null;
      const sameBairro = Boolean(
        prevInv &&
          prevInv.bairro &&
          inv.bairro &&
          prevInv.bairro.toLowerCase() === inv.bairro.toLowerCase(),
      );

      return {
        idx,
        dist,
        cum,
        sameBairro,
        prevNumero: prevInv?.numero || "Base",
      };
    });
  }, [order]);

  const stops: MapStop[] = useMemo(() => {
    return order
      .filter(
        (i) =>
          i.lat != null &&
          i.lng != null &&
          !Number.isNaN(Number(i.lat)) &&
          !Number.isNaN(Number(i.lng)),
      )
      .map((i) => {
        const orderIdx = order.findIndex((x) => x.id === i.id);
        const leg = legsInfo[orderIdx];
        const isRef = i.id === referenceInvoiceId;
        const prox = proximityMap.get(i.id)?.status;

        return {
          id: i.id,
          lat: Number(i.lat),
          lng: Number(i.lng),
          status: "em_rota",
          label: String(orderIdx + 1),
          title: `${isRef ? "🎯 [REF] " : ""}#${orderIdx + 1}. NF ${i.numero} — ${i.destinatario}`,
          subtitle: `${i.logradouro}, ${i.numero_endereco} · ${i.bairro} (${formatCep(i.cep)})`,
          distFromPrev: leg?.dist ?? 0,
          isReference: isRef,
          proximityStatus: isRef ? "ref" : prox,
        };
      });
  }, [order, legsInfo, referenceInvoiceId, proximityMap]);

  const totalKm = useMemo(() => routeDistanceKm(stops, DEPOT), [stops]);

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
    <div className="flex min-h-screen flex-col bg-background animate-in fade-in-50 duration-300 pb-12">
      <PageHeader
        title="Despacho & Rota Inteligente"
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

      <div className="grid flex-1 gap-6 p-6 sm:p-8 xl:grid-cols-[430px_1fr]">
        {/* Bento Card: Configuração da Rota & Motorista */}
        <div className="space-y-5 rounded-2xl border border-border/70 bg-card/90 p-5 sm:p-6 shadow-sm backdrop-blur-xs">
          <div className="border-b border-border/60 pb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold tracking-tight text-foreground">
                Composição da Viagem
              </h2>
              <p className="text-xs text-muted-foreground">
                Veículo, motorista e seleção com Nota de Referência
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
              <Zap size={13} />
              <span>Rota Inteligente</span>
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
                  {vehicles
                    .filter((v) => v.ativo)
                    .map((v) => (
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
                  {drivers
                    .filter((d) => d.ativo)
                    .map((d) => (
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
                    CNH: {selectedDriver.cnh || "Cadastrada"} ·{" "}
                    {selectedDriver.telefone || "Sem fone"}
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

            {/* SEÇÃO DA NOTA DE REFERÊNCIA (ÂNCORA ESTRATÉGICA) */}
            <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-blue-900 dark:text-blue-200 flex items-center gap-1.5">
                  <Target size={15} className="text-blue-600 dark:text-blue-400" />
                  Nota de Referência (Âncora de Proximidade)
                </Label>
                {referenceInvoice && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setReferenceInvoiceId(null);
                      setSortByProximityToRef(false);
                    }}
                  >
                    Remover
                  </Button>
                )}
              </div>

              <Select
                value={referenceInvoiceId || "none"}
                onValueChange={(val) => {
                  if (val === "none") {
                    setReferenceInvoiceId(null);
                    setSortByProximityToRef(false);
                  } else {
                    setReferenceInvoiceId(val);
                    setSortByProximityToRef(true);
                    // Garante que a nota de referência fique selecionada na rota
                    const ref = pendentes.find((p) => p.id === val);
                    if (ref && !selectedIds.has(val)) {
                      setOrder((prev) => [ref, ...prev]);
                    }
                  }
                }}
              >
                <SelectTrigger className="rounded-xl text-xs bg-card">
                  <SelectValue placeholder="Selecione a nota foco de entrega..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl text-xs">
                  <SelectItem value="none">Nenhuma (Calcular trajeto padrão da Base)</SelectItem>
                  {pendentes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      NF {p.numero} · {p.destinatario} ({p.bairro})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Banner com estatísticas de proximidade */}
              {referenceInvoice && (
                <div className="space-y-2 pt-1 animate-in fade-in-50 duration-200">
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                      {proximityCounts.perto} Perto (&le; 6 km)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-300 font-bold border border-amber-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      {proximityCounts.medio} Média (6-15 km)
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-bold border border-rose-500/30">
                      <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                      {proximityCounts.longe} Longe (&gt; 15 km)
                    </span>
                  </div>

                  <div className="flex gap-2 pt-1">
                    {proximityCounts.perto > 0 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        className="flex-1 h-7 text-[11px] font-bold rounded-lg gap-1 border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-200"
                        onClick={selecionarTodasProximas}
                      >
                        <CheckCircle size={12} className="text-emerald-600" />
                        + Marcar Próximas ({proximityCounts.perto})
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[11px] rounded-lg border border-border/70"
                      onClick={() => setSortByProximityToRef((prev) => !prev)}
                    >
                      <Compass size={12} className="mr-1" />
                      {sortByProximityToRef ? "Ordem Original" : "Ordenar por Perto"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Seletor de Notas Fiscais Pendentes */}
            <div className="pt-2">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Notas Pendentes ({pendentes.length})
                </h3>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs rounded-lg"
                    onClick={() => setOrder(pendentes)}
                    disabled={!pendentes.length}
                  >
                    Marcar Todas
                  </Button>
                  {order.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs rounded-lg text-muted-foreground"
                      onClick={() => setOrder([])}
                    >
                      Desmarcar
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-72 space-y-1.5 overflow-y-auto rounded-xl border border-border/60 p-2 bg-muted/20">
                {pendentes.length === 0 && (
                  <p className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma nota pendente no momento.
                  </p>
                )}
                {sortedPendentes.map((i) => {
                  const isRef = i.id === referenceInvoiceId;
                  const prox = proximityMap.get(i.id);

                  return (
                    <div
                      key={i.id}
                      className={cn(
                        "flex items-start gap-3 rounded-xl p-2.5 transition-all duration-150 border",
                        isRef
                          ? "border-blue-500 bg-blue-50/70 dark:bg-blue-950/40 shadow-xs ring-1 ring-blue-500"
                          : prox?.status === "perto"
                          ? "border-emerald-500/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                          : prox?.status === "longe"
                          ? "border-rose-500/40 bg-rose-50/30 dark:bg-rose-950/20"
                          : "border-border/60 bg-card hover:bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={selectedIds.has(i.id)}
                        onCheckedChange={() => toggle(i)}
                        className="mt-1 rounded-md"
                      />

                      <div className="min-w-0 text-xs flex-1">
                        <div className="flex items-center justify-between gap-1 mb-0.5">
                          <span className="font-mono font-bold text-foreground">
                            NF {i.numero}
                          </span>

                          <div className="flex items-center gap-1">
                            {isRef ? (
                              <span className="text-[10px] font-bold px-1.5 py-0.2 rounded-md bg-blue-600 text-white flex items-center gap-1">
                                <Target size={11} /> Referência
                              </span>
                            ) : prox && prox.status !== "ref" ? (
                              <span
                                className={cn(
                                  "text-[10px] font-bold px-1.5 py-0.2 rounded-md font-mono flex items-center gap-1",
                                  prox.status === "perto"
                                    ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                    : prox.status === "medio"
                                    ? "bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30"
                                    : prox.status === "longe"
                                    ? "bg-rose-500/20 text-rose-700 dark:text-rose-300 border border-rose-500/30"
                                    : "bg-muted text-muted-foreground",
                                )}
                              >
                                {prox.status === "perto" && "🟢 Perto"}
                                {prox.status === "medio" && "🟡 Média"}
                                {prox.status === "longe" && "🔴 Longe"}
                                {prox.status === "sem_gps" && "⚪ Sem GPS"}
                                {prox.dist !== Infinity && ` · ${prox.dist.toFixed(1)} km`}
                              </span>
                            ) : null}

                            {!isRef && (
                              <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="h-5 px-1 text-[10px] text-muted-foreground hover:text-blue-600"
                                title="Definir esta nota como âncora de referência"
                                onClick={() => {
                                  setReferenceInvoiceId(i.id);
                                  setSortByProximityToRef(true);
                                  if (!selectedIds.has(i.id)) {
                                    setOrder((prev) => [i, ...prev]);
                                  }
                                }}
                              >
                                🎯 Ref
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="truncate text-foreground/90 font-semibold">
                          {i.destinatario}
                        </div>

                        <div className="truncate text-[11px] text-muted-foreground flex items-center justify-between mt-0.5">
                          <span>
                            {i.bairro} · {formatCep(i.cep)}
                          </span>
                          <span className="font-mono text-[10px]">{i.volumes} vol</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
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
                  Distância estimada: ~
                  <strong className="font-mono text-foreground">{totalKm.toFixed(1)} km</strong>{" "}
                  {referenceInvoice ? `(ancorada na NF ${referenceInvoice.numero})` : "partindo da Base"}
                </p>
              </div>

              {/* Botão de Rota Estratégica Mais Próxima */}
              <Button
                variant="default"
                size="sm"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/20 transition-all duration-200 hover:scale-102 gap-1.5 text-xs"
                onClick={otimizarRotaEstrategica}
                disabled={order.length < 2}
                title="Reordena automaticamente cada nota pela proximidade com a anterior ou pela nota referência"
              >
                <Navigation size={14} />
                <span>Otimizar Rota Estratégica</span>
              </Button>
            </div>

            {/* Informações da Estratégia de Trajeto */}
            {order.length > 0 && (
              <div className="mb-4 p-3 rounded-xl bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-blue-600 animate-ping" />
                  <span className="font-bold text-blue-900 dark:text-blue-200">
                    {referenceInvoice ? "Foco na Nota Referência:" : "Sequenciamento Progressivo:"}
                  </span>
                  <span className="text-blue-700 dark:text-blue-300">
                    {referenceInvoice
                      ? `NF ${referenceInvoice.numero} define as paradas mais próximas primeiro.`
                      : "Paradas encadeadas de uma nota à sua vizinha mais próxima."}
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
                  const isRef = i.id === referenceInvoiceId;
                  const prox = proximityMap.get(i.id);

                  return (
                    <li
                      key={i.id}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-2.5 transition-all duration-150 hover:bg-muted/40",
                        isRef
                          ? "border-blue-500 bg-blue-50/40 dark:bg-blue-950/30 shadow-xs"
                          : "border-border/60 bg-card",
                      )}
                    >
                      <span
                        className={cn(
                          "grid h-7 w-7 shrink-0 place-items-center rounded-xl font-mono text-xs font-black shadow-xs",
                          isRef
                            ? "bg-blue-600 text-white ring-2 ring-amber-400"
                            : "bg-gradient-to-br from-blue-600 to-indigo-600 text-white",
                        )}
                      >
                        {isRef ? "🎯" : idx + 1}
                      </span>

                      <div className="min-w-0 flex-1 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-foreground">
                            NF {i.numero}
                          </span>
                          <span className="text-muted-foreground font-semibold truncate">
                            · {i.destinatario}
                          </span>
                          {isRef && (
                            <span className="text-[10px] font-bold px-1.5 rounded bg-blue-600 text-white">
                              Âncora
                            </span>
                          )}
                          {!isRef && prox?.status && prox.status !== "ref" && (
                            <span
                              className={cn(
                                "text-[10px] font-bold px-1.5 rounded font-mono",
                                prox.status === "perto"
                                  ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                  : prox.status === "medio"
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                  : "bg-rose-500/20 text-rose-700 dark:text-rose-300",
                              )}
                            >
                              {prox.status === "perto" ? "🟢 Perto" : prox.status === "medio" ? "🟡 Média" : "🔴 Longe"}
                            </span>
                          )}
                        </div>

                        <div className="truncate text-muted-foreground text-[11px] mt-0.5">
                          {i.logradouro}, {i.numero_endereco} · {i.bairro} ({formatCep(i.cep)})
                        </div>

                        {leg && idx > 0 && (
                          <div className="flex items-center gap-1.5 text-[10px] font-mono text-blue-600 dark:text-blue-400 mt-1 font-semibold">
                            <span>↳ +{leg.dist.toFixed(1)} km da parada anterior</span>
                            {leg.sameBairro && (
                              <span className="px-1 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 font-bold">
                                Mesmo Bairro ({i.bairro})
                              </span>
                            )}
                          </div>
                        )}
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
