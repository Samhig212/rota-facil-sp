import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Clock, FolderOpen, Lock, RotateCcw, Truck, Undo2 } from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, Plate, StatusBadge } from "@/components/fleet-ui";
import { InvoiceDocumentsModal } from "@/components/InvoiceDocumentsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { invoicesQuery, MOTIVOS_DEVOLUCAO, routesQuery, type Invoice } from "@/lib/fleet";
import { getDriverProfile } from "@/lib/driver-profiles";
import { useInvoiceDocuments } from "@/lib/invoice-documents";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/fechamento")({
  head: () => ({
    meta: [
      { title: "Fechamento de turno — RotaFacil SP" },
      { name: "description", content: "Registre KM final e baixa das notas entregues ou devolvidas." },
      { property: "og:title", content: "Fechamento de turno — RotaFacil SP" },
      { property: "og:description", content: "Registre KM final e baixa das notas entregues ou devolvidas." },
    ],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(routesQuery),
      context.queryClient.ensureQueryData(invoicesQuery),
    ]),
  component: FechamentoPage,
});

type Baixa = { status: "entregue" | "devolvida" | null; motivo: string; obs: string };

function FechamentoPage() {
  const { data: routes } = useSuspenseQuery(routesQuery);
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const qc = useQueryClient();
  const abertas = routes.filter((r) => r.status === "aberta");
  const fechadas = routes.filter((r) => r.status === "fechada").slice(0, 10);
  const [routeId, setRouteId] = useState<string>("");
  const [kmFinal, setKmFinal] = useState("");
  const [baixas, setBaixas] = useState<Record<string, Baixa>>({});
  const [saving, setSaving] = useState(false);

  // Anexo de Canhotos e Documentos Digitalizados
  const { docs: allDocs } = useInvoiceDocuments();
  const [selectedInvoiceForDocs, setSelectedInvoiceForDocs] = useState<Invoice | null>(null);

  useEffect(() => {
    if (!routeId && abertas[0]) setRouteId(abertas[0].id);
  }, [abertas, routeId]);

  const route = abertas.find((r) => r.id === routeId);
  const stops = invoices
    .filter((i) => i.route_id === routeId)
    .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const get = (id: string): Baixa => baixas[id] ?? { status: null, motivo: "", obs: "" };
  const upd = (id: string, p: Partial<Baixa>) => setBaixas((b) => ({ ...b, [id]: { ...get(id), ...p } }));

  const done = stops.filter((s) => get(s.id).status).length;
  const km = route && kmFinal ? Number(kmFinal) - route.km_inicial : null;

  async function fechar() {
    if (!route) return;
    const kmF = Number(kmFinal);
    if (!kmFinal || Number.isNaN(kmF)) {
      toast.error("Informe o KM final do hodômetro");
      return;
    }
    if (kmF < route.km_inicial) {
      toast.error(`KM final não pode ser menor que o inicial (${route.km_inicial})`);
      return;
    }
    const pend = stops.filter((s) => !get(s.id).status);
    if (pend.length) {
      toast.error(`Dê baixa em todas as notas (${pend.length} sem baixa)`);
      return;
    }
    const semMotivo = stops.find((s) => get(s.id).status === "devolvida" && !get(s.id).motivo);
    if (semMotivo) {
      toast.error(`Informe o motivo da devolução da NF ${semMotivo.numero}`);
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        stops.map((s) => {
          const b = get(s.id);
          const motivo = b.status === "devolvida" ? [b.motivo, b.obs].filter(Boolean).join(" — ") : null;
          return api.invoices.update(s.id, {
            status: b.status,
            motivo_devolucao: motivo,
          });
        }),
      );

      await api.routes.close(route.id, kmF);

      toast.success("Turno fechado com sucesso!");
      setRouteId("");
      setKmFinal("");
      setBaixas({});
      await Promise.all(["routes", "invoices", "vehicles"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background animate-in fade-in-50 duration-300">
      <PageHeader
        title="Fechamento de Turno Operacional"
        subtitle="Registro de hodômetro final e baixa oficial das entregas realizadas ou devolvidas"
      />

      <div className="grid flex-1 gap-6 p-6 sm:p-8 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {abertas.length === 0 ? (
            <div className="rounded-2xl border border-border/70 bg-card p-12 text-center text-muted-foreground space-y-3 shadow-xs">
              <Truck className="h-10 w-10 mx-auto text-muted-foreground/30" />
              <p className="text-base font-bold text-foreground">Nenhuma rota em aberto</p>
              <p className="text-xs">
                Todas as viagens despachadas já foram encerradas ou nenhuma rota foi iniciada hoje.
              </p>
            </div>
          ) : (
            <>
              {/* Seletor de Rota em Aberto */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {abertas.map((r) => {
                  const prof = getDriverProfile(r.driver_id);
                  const isSel = r.id === routeId;
                  const stopsCount = invoices.filter((i) => i.route_id === r.id).length;

                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setRouteId(r.id);
                        setKmFinal("");
                        setBaixas({});
                      }}
                      className={cn(
                        "rounded-2xl border p-4 text-left transition-all duration-200 cursor-pointer flex flex-col justify-between space-y-3",
                        isSel
                          ? "border-primary bg-primary/10 shadow-md shadow-primary/10"
                          : "border-border/70 bg-card/80 hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Plate>{r.vehicles?.placa}</Plate>
                        <span className="font-mono text-xs font-bold text-primary">
                          {stopsCount} {stopsCount === 1 ? "entrega" : "entregas"}
                        </span>
                      </div>

                      <div className="space-y-1">
                        <p className="text-sm font-black text-foreground truncate">
                          {r.drivers?.nome}
                        </p>
                        <p className="font-mono text-xs text-muted-foreground">
                          KM Inicial: {r.km_inicial.toLocaleString("pt-BR")}
                        </p>
                      </div>

                      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px] text-muted-foreground">
                        <span>{new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}</span>
                        <StatusBadge status="aberta" />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Painel de Fechamento da Rota Selecionada */}
              {route && (
                <div className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden">
                  <div className="border-b border-border/60 p-5 bg-muted/20 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <Plate>{route.vehicles?.placa}</Plate>
                      <div>
                        <h3 className="font-black text-foreground text-sm sm:text-base">
                          {route.drivers?.nome}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {route.vehicles?.modelo} · KM Inicial registrado:{" "}
                          <strong className="text-foreground font-mono">
                            {route.km_inicial.toLocaleString("pt-BR")}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground font-medium">Status:</span>
                      <StatusBadge status="aberta" />
                    </div>
                  </div>

                  {/* Formulário do Hodômetro Final */}
                  <div className="border-b border-border/60 p-5 bg-muted/10 grid gap-4 sm:grid-cols-2 items-center">
                    <div className="space-y-1.5">
                      <Label htmlFor="kmf" className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        KM Final do Hodômetro *
                      </Label>
                      <Input
                        id="kmf"
                        type="number"
                        placeholder="Ex: 48350"
                        className="font-mono text-lg font-black rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                        value={kmFinal}
                        onChange={(e) => setKmFinal(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Distância Percorrida no Turno
                      </p>
                      <p
                        className={cn(
                          "font-mono text-2xl font-black",
                          km != null && km < 0 ? "text-destructive" : "text-foreground",
                        )}
                      >
                        {km != null ? `${km.toLocaleString("pt-BR")} km` : "—"}
                      </p>
                      {km != null && km >= 0 && (
                        <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                          Hodômetro válido para encerramento
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Lista de Paradas para Baixa e Digitalização */}
                  <ul className="divide-y divide-border/60">
                    {stops.map((s) => {
                      const b = get(s.id);
                      const docCount = allDocs.filter(
                        (d) => d.invoiceId === s.id || d.invoiceId === s.numero,
                      ).length;

                      return (
                        <li key={s.id} className="p-4 sm:p-5 transition-colors hover:bg-muted/20">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 font-mono text-xs font-black text-white shadow-xs">
                                {s.ordem}
                              </span>
                              <div className="min-w-0 flex-1 text-xs">
                                <p className="font-semibold text-foreground text-sm">
                                  <span className="font-mono font-bold">NF {s.numero}</span> · {s.destinatario}
                                </p>
                                <p className="truncate text-muted-foreground text-xs mt-0.5">
                                  {s.logradouro}, {s.numero_endereco} · {s.bairro}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Botão para Digitalização de Canhoto / PDF */}
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "rounded-xl gap-1.5 transition-all text-xs font-semibold",
                                  docCount > 0 && "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400 font-bold",
                                )}
                                onClick={() => setSelectedInvoiceForDocs(s)}
                                title="Digitalizar comprovante de entrega / canhoto em PDF"
                              >
                                <FolderOpen size={13} />
                                <span>{docCount > 0 ? "Canhoto Anexado" : "Digitalizar Canhoto"}</span>
                              </Button>

                              <Button
                                size="sm"
                                variant={b.status === "entregue" ? "default" : "outline"}
                                className={cn(
                                  "rounded-xl gap-1.5 transition-all text-xs font-semibold",
                                  b.status === "entregue" &&
                                    "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs font-bold",
                                )}
                                onClick={() => upd(s.id, { status: "entregue" })}
                              >
                                <CheckCircle2 size={15} /> Entregue
                              </Button>

                              <Button
                                size="sm"
                                variant={b.status === "devolvida" ? "destructive" : "outline"}
                                className={cn(
                                  "rounded-xl gap-1.5 transition-all text-xs font-semibold",
                                  b.status === "devolvida" && "shadow-xs font-bold",
                                )}
                                onClick={() => upd(s.id, { status: "devolvida" })}
                              >
                                <Undo2 size={15} /> Devolvida
                              </Button>
                            </div>
                          </div>

                          {b.status === "devolvida" && (
                            <div className="mt-3.5 grid gap-2.5 rounded-xl border border-destructive/30 bg-destructive/5 p-3.5 sm:grid-cols-2 animate-in fade-in-50 duration-200">
                              <div className="space-y-1">
                                <Label className="text-[11px] font-semibold text-destructive">
                                  Motivo da Devolução
                                </Label>
                                <Select
                                  value={b.motivo}
                                  onValueChange={(v) => upd(s.id, { motivo: v })}
                                >
                                  <SelectTrigger className="rounded-xl text-xs">
                                    <SelectValue placeholder="Selecione o motivo..." />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl text-xs">
                                    {MOTIVOS_DEVOLUCAO.map((m) => (
                                      <SelectItem key={m} value={m}>
                                        {m}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-1">
                                <Label className="text-[11px] font-semibold text-muted-foreground">
                                  Observação Adicional
                                </Label>
                                <Input
                                  placeholder="Detalhes adicionais (opcional)"
                                  className="rounded-xl text-xs"
                                  value={b.obs}
                                  onChange={(e) => upd(s.id, { obs: e.target.value })}
                                />
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>

                  {/* Rodapé de Ação e Fechamento */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 bg-muted/40 p-4 sm:p-5">
                    <span className="text-xs sm:text-sm font-semibold text-foreground">
                      Progresso: <strong>{done}</strong> de {stops.length} notas apontadas
                    </span>

                    <Button
                      onClick={fechar}
                      disabled={saving || done < stops.length || !kmFinal}
                      className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 gap-2"
                    >
                      <Lock size={16} /> Encerrar Turno Oficial
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Aside: Histórico de Últimos Fechamentos */}
        <aside className="rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs flex flex-col h-fit">
          <div className="border-b border-border/60 p-4 sm:p-5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Clock size={14} /> Histórico de Fechamentos
            </h3>
          </div>

          <div className="divide-y divide-border/60">
            {fechadas.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">
                Nenhum turno anterior registrado.
              </p>
            ) : (
              fechadas.map((r) => {
                const its = invoices.filter((i) => i.route_id === r.id);
                const ent = its.filter((i) => i.status === "entregue").length;
                return (
                  <div key={r.id} className="p-4 transition-colors hover:bg-muted/30 text-xs">
                    <div className="flex items-center justify-between mb-1.5">
                      <Plate>{r.vehicles?.placa}</Plate>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                    <p className="font-semibold text-foreground">{r.drivers?.nome}</p>
                    <p className="font-mono text-[11px] text-muted-foreground mt-0.5">
                      {r.km_inicial} → {r.km_final} · {(r.km_final ?? 0) - r.km_inicial} km rodados
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <StatusBadge status="entregue" />
                      <span className="font-mono font-bold text-xs">{ent}</span>
                      {its.length - ent > 0 && (
                        <>
                          <StatusBadge status="devolvida" />
                          <span className="font-mono font-bold text-xs">{its.length - ent}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      </div>

      {/* Modal de Documentos / Canhoto */}
      <InvoiceDocumentsModal
        isOpen={Boolean(selectedInvoiceForDocs)}
        onClose={() => setSelectedInvoiceForDocs(null)}
        invoice={selectedInvoiceForDocs}
      />
    </div>
  );
}
