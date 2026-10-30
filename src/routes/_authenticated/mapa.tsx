import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useCallback, useMemo, useState } from "react";
import { LazyMap, type MapStop } from "@/components/LazyMap";
import { PageHeader, StatusBadge } from "@/components/fleet-ui";
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

  const list = useMemo(
    () => invoices.filter((i) => filter === "todas" || i.status === filter),
    [invoices, filter],
  );
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
    <div className="flex h-screen flex-col">
      <PageHeader title="Mapa de entregas" subtitle="Notas fiscais geolocalizadas pelo CEP" />
      <div className="flex flex-wrap gap-2 border-b bg-card px-6 py-3">
        {FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-sm font-semibold transition-colors",
              filter === f ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {f === "todas" ? "Todas" : STATUS_LABEL[f]} <span className="font-mono opacity-70">{counts[f] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="h-80 lg:h-auto lg:flex-1">
          <LazyMap stops={stops} selectedId={selected} onSelect={onSelect} />
        </div>
        <div className="overflow-y-auto border-l bg-card lg:w-96">
          {list.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nenhuma nota neste filtro.</p>}
          {list.map((i) => (
            <button
              key={i.id}
              onClick={() => setSelected(i.id)}
              className={cn("block w-full border-b px-4 py-3 text-left hover:bg-muted", selected === i.id && "bg-accent")}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-bold">NF {i.numero}</span>
                <StatusBadge status={i.status} />
              </div>
              <p className="truncate font-semibold">{i.destinatario}</p>
              <p className="truncate text-xs text-muted-foreground">
                {i.logradouro}, {i.numero_endereco} · {i.bairro} · {formatCep(i.cep)}
                {i.lat == null && " · sem coordenadas"}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
