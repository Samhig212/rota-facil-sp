import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { MapPin, Navigation, Route as RouteIcon, Search, Sparkles } from "lucide-react";
import { LazyMap, type MapStop } from "@/components/LazyMap";
import { PageHeader, StatusBadge } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { invoicesQuery, STATUS_LABEL, type InvoiceStatus } from "@/lib/fleet";
import { DEPOT, formatCep, haversineKm, orderByProximity, routeDistanceKm } from "@/lib/geo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa Operacional — RotaFacil SP" },
      { name: "description", content: "Mapa interativo de entregas e traçado de rotas estratégicas em São Paulo." },
      { property: "og:title", content: "Mapa Operacional — RotaFacil SP" },
      { property: "og:description", content: "Mapa interativo de entregas e traçado de rotas estratégicas em São Paulo." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery),
  component: MapaPage,
});

const FILTERS: (InvoiceStatus | "todas")[] = ["todas", "pendente", "em_rota", "entregue", "devolvida"];

function MapaPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const [filter, setFilter] = useState<InvoiceStatus | "todas">("todas");
  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [strategicRouteMode, setStrategicRouteMode] = useState(false);

  const list = useMemo(() => {
    const s = search.toLowerCase().trim();
    return invoices.filter((i) => {
      const matchStatus = filter === "todas" || i.status === filter;
      if (!matchStatus) return false;
      if (!s) return true;
      return (
        i.numero.toLowerCase().includes(s) ||
        i.destinatario.toLowerCase().includes(s) ||
        i.logradouro.toLowerCase().includes(s) ||
        i.bairro.toLowerCase().includes(s) ||
        i.cep.includes(s)
      );
    });
  }, [invoices, filter, search]);

  // Se modo rota estratégica estiver ativo, ordena os pontos da lista por proximidade sequencial da Base
  const orderedList = useMemo(() => {
    if (!strategicRouteMode) return list;
    return orderByProximity(list, DEPOT);
  }, [list, strategicRouteMode]);

  const stops: MapStop[] = useMemo(() => {
    const valid = orderedList.filter((i) => i.lat != null && i.lng != null);
    let cur = { lat: DEPOT.lat, lng: DEPOT.lng };

    return valid.map((i, idx) => {
      const distFromPrev = haversineKm(cur, { lat: i.lat!, lng: i.lng! });
      cur = { lat: i.lat!, lng: i.lng! };

      return {
        id: i.id,
        lat: i.lat!,
        lng: i.lng!,
        status: i.status,
        label: strategicRouteMode ? String(idx + 1) : i.ordem ? String(i.ordem) : "•",
        title: `${strategicRouteMode ? `#${idx + 1} ` : ""}NF ${i.numero} — ${i.destinatario}`,
        subtitle: `${i.logradouro}, ${i.numero_endereco} · ${formatCep(i.cep)}`,
        distFromPrev,
      };
    });
  }, [orderedList, strategicRouteMode]);

  const onSelect = useCallback((id: string) => setSelected(id), []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: invoices.length };
    invoices.forEach((i) => (c[i.status] = (c[i.status] ?? 0) + 1));
    return c;
  }, [invoices]);

  const totalKm = useMemo(() => routeDistanceKm(stops, DEPOT), [stops]);

  return (
    <div className="flex h-[calc(100vh-60px)] md:h-screen flex-col bg-background animate-in fade-in-50 duration-300">
      <PageHeader
        title="Mapa Operacional"
        subtitle={`Base: ${DEPOT.nome} (${DEPOT.endereco})`}
        actions={
          <Button
            size="sm"
            variant={strategicRouteMode ? "default" : "outline"}
            onClick={() => setStrategicRouteMode(!strategicRouteMode)}
            className={`rounded-xl gap-1.5 text-xs font-bold transition-all shadow-xs ${
              strategicRouteMode
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25"
                : "border-border text-foreground hover:bg-muted"
            }`}
          >
            <Navigation size={14} className={strategicRouteMode ? "animate-pulse" : ""} />
            <span>{strategicRouteMode ? "Rota Estratégica Ativa" : "Ativar Rota Estratégica"}</span>
            {strategicRouteMode && (
              <span className="font-mono text-[10px] bg-white/20 px-1.5 py-0.2 rounded-full">
                {totalKm.toFixed(1)} km
              </span>
            )}
          </Button>
        }
      />

      {/* Barra de Filtros com Estilo Corporativo */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/85 px-6 py-2.5 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-all duration-200 active:scale-95",
                filter === f
                  ? "bg-primary text-primary-foreground font-bold shadow-xs"
                  : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <span>{f === "todas" ? "Todas" : STATUS_LABEL[f]}</span>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 font-mono text-[10px]",
                  filter === f
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-background text-muted-foreground",
                )}
              >
                {counts[f] ?? 0}
              </span>
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar notas no mapa..."
            className="h-8 pl-8 text-xs rounded-xl bg-muted/40 transition-all duration-200 focus-visible:bg-card"
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Mapa Interativo */}
        <div className="h-80 lg:h-auto lg:flex-1 relative">
          <LazyMap
            stops={stops}
            showRoute={strategicRouteMode}
            selectedId={selected}
            onSelect={onSelect}
          />
        </div>

        {/* Lista Lateral de Paradas */}
        <div className="overflow-y-auto border-t lg:border-t-0 lg:border-l border-border/60 bg-card/90 lg:w-96 flex flex-col">
          <div className="p-3 border-b border-border/60 text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span>Paradas {strategicRouteMode ? "Estratégicas" : "Filtradas"}</span>
              <span className="font-mono text-foreground font-bold">({orderedList.length})</span>
            </span>
            <span className="text-[11px] font-normal normal-case text-muted-foreground">
              {stops.length} mapeadas
            </span>
          </div>

          {strategicRouteMode && (
            <div className="px-3.5 py-2 bg-blue-50/70 dark:bg-blue-950/40 border-b border-blue-200 dark:border-blue-900/60 text-[11px] text-blue-900 dark:text-blue-200 font-medium flex items-center justify-between">
              <span>🎯 Trajeto encadeado por menor raio</span>
              <strong className="font-mono">{totalKm.toFixed(1)} km total</strong>
            </div>
          )}

          <div className="divide-y divide-border/60 flex-1">
            {orderedList.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <MapPin className="h-8 w-8 mx-auto text-muted-foreground/30" />
                <p className="text-sm font-semibold">Nenhuma nota encontrada</p>
                <p className="text-xs">Altere os filtros para ver outras entregas.</p>
              </div>
            ) : (
              orderedList.map((i, idx) => (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => setSelected(i.id)}
                  className={cn(
                    "block w-full p-3.5 text-left transition-all duration-150 hover:bg-muted/40",
                    selected === i.id && "bg-primary/10 border-l-4 border-l-primary",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      {strategicRouteMode && (
                        <span className="grid h-5 w-5 place-items-center rounded bg-primary text-primary-foreground text-[10px] font-mono font-bold">
                          {idx + 1}
                        </span>
                      )}
                      <span className="font-mono text-xs font-bold text-foreground">
                        NF {i.numero}
                        <span className="text-muted-foreground font-normal">/{i.serie}</span>
                      </span>
                    </div>
                    <StatusBadge status={i.status} />
                  </div>
                  <p className="truncate font-semibold text-xs text-foreground">{i.destinatario}</p>
                  <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                    {i.logradouro}, {i.numero_endereco} · {i.bairro}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-muted-foreground">
                    <span>{formatCep(i.cep)}</span>
                    {i.lat == null && (
                      <span className="text-rose-600 dark:text-rose-400 font-semibold">
                        Sem GPS
                      </span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
