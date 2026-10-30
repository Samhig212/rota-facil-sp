import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Search, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, StatusBadge } from "@/components/fleet-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, invoicesQuery } from "@/lib/fleet";
import { formatCep, geocode, lookupCep, normalizeCep } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Lançamento de NF-e — RotaFacil SP" },
      { name: "description", content: "Cadastre notas fiscais eletrônicas para entrega." },
      { property: "og:title", content: "Lançamento de NF-e — RotaFacil SP" },
      { property: "og:description", content: "Cadastre notas fiscais eletrônicas para entrega." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery),
  component: NotasPage,
});

const EMPTY = {
  numero: "", serie: "1", chave: "", destinatario: "", cep: "", logradouro: "",
  numero_endereco: "", bairro: "", cidade: "São Paulo", valor: "", volumes: "1",
};

function NotasPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const [busyCep, setBusyCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  async function buscarCep() {
    setBusyCep(true);
    try {
      const info = await lookupCep(f.cep);
      if (!info) return toast.error("CEP não encontrado");
      setF((p) => ({ ...p, cep: formatCep(info.cep), logradouro: info.logradouro, bairro: info.bairro, cidade: info.cidade }));
    } finally {
      setBusyCep(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const chave = f.chave.replace(/\D/g, "");
    if (chave && chave.length !== 44) return toast.error("A chave de acesso da NF-e deve ter 44 dígitos");
    if (normalizeCep(f.cep).length !== 8) return toast.error("Informe um CEP válido");
    setSaving(true);
    try {
      const coords = await geocode({
        cep: f.cep, logradouro: f.logradouro, numero: f.numero_endereco, bairro: f.bairro, cidade: f.cidade,
      });
      const { error } = await supabase.from("invoices").insert({
        numero: f.numero, serie: f.serie, chave, destinatario: f.destinatario,
        cep: normalizeCep(f.cep), logradouro: f.logradouro, numero_endereco: f.numero_endereco,
        bairro: f.bairro, cidade: f.cidade, valor: Number(f.valor.replace(",", ".")) || 0,
        volumes: Number(f.volumes) || 1, lat: coords?.lat ?? null, lng: coords?.lng ?? null,
      });
      if (error) throw error;
      toast.success(coords ? `NF ${f.numero} lançada e localizada no mapa` : `NF ${f.numero} lançada (endereço não localizado no mapa)`);
      setF(EMPTY);
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function excluir(id: string) {
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["invoices"] });
  }

  return (
    <div>
      <PageHeader title="Lançamento de NF-e" subtitle="Cadastre as notas a serem entregues" />
      <div className="grid gap-6 p-6 xl:grid-cols-[440px_1fr]">
        <form onSubmit={salvar} className="space-y-4 rounded-lg border bg-card p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Número NF</Label><Input required value={f.numero} onChange={set("numero")} /></div>
            <div className="space-y-1.5"><Label>Série</Label><Input value={f.serie} onChange={set("serie")} /></div>
          </div>
          <div className="space-y-1.5"><Label>Chave de acesso (44 dígitos)</Label><Input className="font-mono text-xs" value={f.chave} onChange={set("chave")} maxLength={54} /></div>
          <div className="space-y-1.5"><Label>Destinatário</Label><Input required value={f.destinatario} onChange={set("destinatario")} /></div>
          <div className="space-y-1.5">
            <Label>CEP</Label>
            <div className="flex gap-2">
              <Input required value={f.cep} onChange={set("cep")} onBlur={() => normalizeCep(f.cep).length === 8 && !f.logradouro && buscarCep()} placeholder="00000-000" />
              <Button type="button" variant="secondary" onClick={buscarCep} disabled={busyCep}>
                {busyCep ? <Loader2 className="animate-spin" /> : <Search />}
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2 space-y-1.5"><Label>Logradouro</Label><Input value={f.logradouro} onChange={set("logradouro")} /></div>
            <div className="space-y-1.5"><Label>Nº</Label><Input value={f.numero_endereco} onChange={set("numero_endereco")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Bairro</Label><Input value={f.bairro} onChange={set("bairro")} /></div>
            <div className="space-y-1.5"><Label>Cidade</Label><Input value={f.cidade} onChange={set("cidade")} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Valor (R$)</Label><Input inputMode="decimal" value={f.valor} onChange={set("valor")} /></div>
            <div className="space-y-1.5"><Label>Volumes</Label><Input type="number" min={1} value={f.volumes} onChange={set("volumes")} /></div>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving && <Loader2 className="animate-spin" />} Lançar nota
          </Button>
        </form>

        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr><th className="p-3">NF</th><th className="p-3">Destinatário</th><th className="p-3">CEP</th><th className="p-3 text-right">Valor</th><th className="p-3">Status</th><th /></tr>
            </thead>
            <tbody>
              {invoices.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">Nenhuma nota lançada ainda.</td></tr>}
              {invoices.map((i) => (
                <tr key={i.id} className="border-t">
                  <td className="p-3 font-mono font-bold">{i.numero}<span className="text-muted-foreground">/{i.serie}</span></td>
                  <td className="p-3"><div className="font-semibold">{i.destinatario}</div><div className="text-xs text-muted-foreground">{i.bairro}</div></td>
                  <td className="p-3 font-mono">{formatCep(i.cep)}</td>
                  <td className="p-3 text-right font-mono">{brl(Number(i.valor))}</td>
                  <td className="p-3"><StatusBadge status={i.status} />{i.motivo_devolucao && <div className="mt-1 text-xs text-muted-foreground">{i.motivo_devolucao}</div>}</td>
                  <td className="p-3">
                    {i.status === "pendente" && (
                      <Button size="icon" variant="ghost" onClick={() => excluir(i.id)} aria-label="Excluir nota"><Trash2 /></Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
