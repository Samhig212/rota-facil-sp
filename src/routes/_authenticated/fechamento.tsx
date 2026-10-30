import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Lock, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Plate, StatusBadge } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { invoicesQuery, MOTIVOS_DEVOLUCAO, routesQuery } from "@/lib/fleet";
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

  useEffect(() => {
    if (!routeId && abertas[0]) setRouteId(abertas[0].id);
  }, [abertas, routeId]);

  const route = abertas.find((r) => r.id === routeId);
  const stops = invoices.filter((i) => i.route_id === routeId).sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0));
  const get = (id: string): Baixa => baixas[id] ?? { status: null, motivo: "", obs: "" };
  const upd = (id: string, p: Partial<Baixa>) => setBaixas((b) => ({ ...b, [id]: { ...get(id), ...p } }));

  const done = stops.filter((s) => get(s.id).status).length;
  const km = route && kmFinal ? Number(kmFinal) - route.km_inicial : null;

  async function fechar() {
    if (!route) return;
    const kmF = Number(kmFinal);
    if (!kmFinal || Number.isNaN(kmF)) { toast.error("Informe o KM final do hodômetro"); return; }
    if (kmF < route.km_inicial) { toast.error(`KM final não pode ser menor que o inicial (${route.km_inicial})`); return; }
    const pend = stops.filter((s) => !get(s.id).status);
    if (pend.length) { toast.error(`Dê baixa em todas as notas (${pend.length} sem baixa)`); return; }
    const semMotivo = stops.find((s) => get(s.id).status === "devolvida" && !get(s.id).motivo);
    if (semMotivo) { toast.error(`Informe o motivo da devolução da NF ${semMotivo.numero}`); return; }
    setSaving(true);
    try {
      const results = await Promise.all(
        stops.map((s) => {
          const b = get(s.id);
          const motivo = b.status === "devolvida" ? [b.motivo, b.obs].filter(Boolean).join(" — ") : null;
          return supabase.from("invoices").update({ status: b.status!, motivo_devolucao: motivo }).eq("id", s.id);
        }),
      );
      const err = results.find((r) => r.error)?.error;
      if (err) throw err;
      const r1 = await supabase.from("routes").update({ status: "fechada", km_final: kmF, closed_at: new Date().toISOString() }).eq("id", route.id);
      if (r1.error) throw r1.error;
      const r2 = await supabase.from("vehicles").update({ km_atual: kmF }).eq("id", route.vehicle_id);
      if (r2.error) throw r2.error;
      toast.success("Turno fechado com sucesso");
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
    <div>
      <PageHeader title="Fechamento de turno" subtitle="KM final e baixa das notas da rota" />
      <div className="grid gap-6 p-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          {abertas.length === 0 ? (
            <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">Nenhuma rota aberta para fechar.</div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {abertas.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => { setRouteId(r.id); setBaixas({}); setKmFinal(""); }}
                    className={cn("flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm font-semibold", r.id === routeId && "border-foreground ring-2 ring-primary")}
                  >
                    <Plate>{r.vehicles?.placa}</Plate> {r.drivers?.nome}
                  </button>
                ))}
              </div>

              {route && (
                <div className="rounded-lg border bg-card">
                  <div className="grid gap-4 border-b p-5 sm:grid-cols-3">
                    <div><p className="text-xs uppercase text-muted-foreground">KM inicial</p><p className="font-mono text-xl font-bold">{route.km_inicial}</p></div>
                    <div className="space-y-1">
                      <Label htmlFor="kmf" className="text-xs uppercase text-muted-foreground">KM final do hodômetro</Label>
                      <Input id="kmf" type="number" className="font-mono text-lg font-bold" value={kmFinal} onChange={(e) => setKmFinal(e.target.value)} />
                    </div>
                    <div><p className="text-xs uppercase text-muted-foreground">Rodado</p><p className={cn("font-mono text-xl font-bold", km != null && km < 0 && "text-destructive")}>{km != null ? `${km} km` : "—"}</p></div>
                  </div>
                  <ul>
                    {stops.map((s) => {
                      const b = get(s.id);
                      return (
                        <li key={s.id} className="border-b p-4 last:border-b-0">
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="grid h-7 w-7 place-items-center rounded-full bg-sidebar font-mono text-xs font-bold text-sidebar-primary">{s.ordem}</span>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold"><span className="font-mono">NF {s.numero}</span> · {s.destinatario}</p>
                              <p className="truncate text-xs text-muted-foreground">{s.logradouro}, {s.numero_endereco} · {s.bairro}</p>
                            </div>
                            <Button size="sm" variant={b.status === "entregue" ? "default" : "outline"} className={cn(b.status === "entregue" && "bg-success text-success-foreground hover:bg-success/90")} onClick={() => upd(s.id, { status: "entregue" })}>
                              <CheckCircle2 /> Entregue
                            </Button>
                            <Button size="sm" variant={b.status === "devolvida" ? "destructive" : "outline"} onClick={() => upd(s.id, { status: "devolvida" })}>
                              <Undo2 /> Devolvida
                            </Button>
                          </div>
                          {b.status === "devolvida" && (
                            <div className="mt-3 grid gap-2 pl-10 sm:grid-cols-2">
                              <Select value={b.motivo} onValueChange={(v) => upd(s.id, { motivo: v })}>
                                <SelectTrigger><SelectValue placeholder="Motivo da devolução" /></SelectTrigger>
                                <SelectContent>{MOTIVOS_DEVOLUCAO.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                              </Select>
                              <Input placeholder="Observação (opcional)" value={b.obs} onChange={(e) => upd(s.id, { obs: e.target.value })} />
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                  <div className="flex items-center justify-between border-t bg-muted p-4">
                    <span className="text-sm font-semibold">{done}/{stops.length} notas com baixa</span>
                    <Button onClick={fechar} disabled={saving}><Lock /> Fechar turno</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <aside className="rounded-lg border bg-card">
          <h3 className="border-b p-4 text-sm font-bold uppercase tracking-wide">Últimos fechamentos</h3>
          {fechadas.length === 0 && <p className="p-4 text-sm text-muted-foreground">Nenhum turno fechado ainda.</p>}
          {fechadas.map((r) => {
            const its = invoices.filter((i) => i.route_id === r.id);
            const ent = its.filter((i) => i.status === "entregue").length;
            return (
              <div key={r.id} className="border-b p-4 text-sm last:border-b-0">
                <div className="flex items-center justify-between"><Plate>{r.vehicles?.placa}</Plate><span className="text-xs text-muted-foreground">{new Date(r.data + "T12:00").toLocaleDateString("pt-BR")}</span></div>
                <p className="mt-1 font-semibold">{r.drivers?.nome}</p>
                <p className="font-mono text-xs text-muted-foreground">{r.km_inicial} → {r.km_final} · {(r.km_final ?? 0) - r.km_inicial} km</p>
                <div className="mt-1 flex gap-2"><StatusBadge status="entregue" /><span className="font-mono text-xs">{ent}</span><StatusBadge status="devolvida" /><span className="font-mono text-xs">{its.length - ent}</span></div>
              </div>
            );
          })}
        </aside>
      </div>
    </div>
  );
}
