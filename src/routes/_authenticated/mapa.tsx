import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { LazyMap, type MapStop } from "@/components/LazyMap";
import { PageHeader, StatusBadge } from "@/components/fleet-ui";
import { Input } from "@/components/ui/input";
import { invoicesQuery, STATUS_LABEL, type InvoiceStatus } from "@/lib/fleet";
import { formatCep } from "@/lib/geo";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/mapa")({
  head: () => ({
    meta: [
      { title: "Mapa de entregas — RotaFacil SP" },
      { name: "description", content: "Mapa interativo de entregas por CEP em São Paulo." },
      { property: "og:title", content: "Mapa de entregas — RotaFacil SP" },
      { property: "og:description", content: "Mapa interativo de entregas por CEP em São Paulo." },
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

  const stops: MapStop[] = useMemo(
    () =>
      list
        .filter((i) => i.lat != null && i.lng != null)
        .map((i) => ({
          id: i.id,
          lat: i.lat!,
          lng: i.lng!,
          status: i.status,
          label: i.ordem ? String(i.ordem) : "•",
          title: `NF ${i.numero} — ${i.destinatario}`,
          subtitle: `${i.logradouro}, ${i.numero_endereco} · ${formatCep(i.cep)}`,
        })),
    [list],
  );

  const onSelect = useCallback((id: string) => setSelected(id), []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { todas: invoices.length };
    invoices.forEach((i) => (c[i.status] = (c[i.status] ?? 0) + 1));
    return c;
  }, [invoices]);

  return (
    <div className="flex h-[calc(100vh-60px)] md:h-screen flex-col bg-background animate-in fade-in-50 duration-300">
      <PageHeader
        title="Mapa Operacional"
        subtitle="Geolocalização das entregas e paradas na Grande São Paulo"
      />

      {/* Barra de Filtros com Glassmorphism */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/75 px-6 py-2.5 backdrop-blur-md">
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
          <LazyMap stops={stops} selectedId={selected} onSelect={onSelect} />
        </div>

        {/* Lista Lateral de Paradas */}
        <div className="overflow-y-auto border-t lg:border-t-0 lg:border-l border-border/60 bg-card/90 lg:w-96 flex flex-col">
          <div className="p-3 border-b border-border/60 text-xs font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 flex items-center justify-between">
            <span>Paradas Filtradas ({list.length})</span>
            <span className="text-[11px] font-normal normal-case">
              {stops.length} mapeadas
            </span>
          </div>

          <div className="divide-y divide-border/60 flex-1">
            {list.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground space-y-2">
                <MapPin className="h-8 w-8 mx-auto text-muted-foreground/30" />
                <p className="text-sm font-semibold">Nenhuma nota encontrada</p>
                <p className="text-xs">Altere os filtros para ver outras entregas.</p>
              </div>
            ) : (
              list.map((i) => (
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
                    <span className="font-mono text-xs font-bold text-foreground">
                      NF {i.numero}
                      <span className="text-muted-foreground font-normal">/{i.serie}</span>
                    </span>
                    <StatusBadge status={i.status} />
                  </div>
                  <p className="truncate font-semibold text-xs text-foreground">{i.destinatario}</p>
                  <p className="truncate text-[11px] text-muted-foreground mt-0.5">
                    {i.logradouro}, {i.numero_endereco} · {i.bairro}
                  </p>
                  <div className="flex items-center justify-between mt-1.5 text-[10px] font-mono text-muted-foreground">
                    <span>{formatCep(i.cep)}</span>
                    {i.lat == null && (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold">
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
