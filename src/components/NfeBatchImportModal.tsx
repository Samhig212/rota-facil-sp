import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, FileText, Loader2, Trash2, Upload } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { brl } from "@/lib/fleet";
import { geocode, normalizeCep } from "@/lib/geo";
import type { ParsedNfe } from "@/lib/nfe-parser";

interface NfeBatchImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  nfes: ParsedNfe[];
  onSelectNfeForForm: (nfe: ParsedNfe) => void;
  onSuccess: () => void;
}

export function NfeBatchImportModal({
  isOpen,
  onClose,
  nfes: initialNfes,
  onSelectNfeForForm,
  onSuccess,
}: NfeBatchImportModalProps) {
  const [items, setItems] = useState<ParsedNfe[]>(initialNfes);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });

  // Sincroniza lista quando abrir com novas notas
  if (initialNfes !== items && !importing && initialNfes.length !== items.length) {
    setItems(initialNfes);
  }

  const totalValor = items.reduce((acc, i) => acc + (i.valorNumerico || 0), 0);

  function removerItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function importarTodas() {
    if (items.length === 0) return;
    setImporting(true);
    setProgress({ current: 0, total: items.length });

    let sucessos = 0;
    const erros: string[] = [];

    for (const [idx, nfe] of items.entries()) {
      setProgress({ current: idx + 1, total: items.length });

      try {
        let coords = null;
        try {
          coords = await geocode({
            cep: nfe.cep,
            logradouro: nfe.logradouro,
            numero: nfe.numero_endereco,
            bairro: nfe.bairro,
            cidade: nfe.cidade,
          });
        } catch {
          // Geocode falhou, continua salvando a nota sem coordenadas
        }

        const chave = nfe.chave.replace(/\D/g, "");
        await api.invoices.create({
          numero: nfe.numero,
          serie: nfe.serie || "1",
          chave: chave || "",
          destinatario: nfe.destinatario,
          cep: normalizeCep(nfe.cep),
          logradouro: nfe.logradouro,
          numero_endereco: nfe.numero_endereco,
          bairro: nfe.bairro,
          cidade: nfe.cidade,
          valor: nfe.valorNumerico,
          volumes: Number(nfe.volumes) || 1,
          lat: coords?.lat ?? null,
          lng: coords?.lng ?? null,
        });

        sucessos++;
      } catch (err) {
        erros.push(`NF ${nfe.numero}: ${(err as Error).message}`);
      }
    }

    setImporting(false);

    if (sucessos > 0) {
      toast.success(
        `${sucessos} ${sucessos === 1 ? "nota fiscal importada" : "notas fiscais importadas"} com sucesso!`,
      );
      onSuccess();
      onClose();
    }

    if (erros.length > 0) {
      toast.error(`Falha ao importar ${erros.length} nota(s): ${erros.slice(0, 2).join(", ")}`);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !importing && !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-primary" />
            Importação de Lote de NF-e ({items.length})
          </DialogTitle>
          <DialogDescription>
            {items.length} notas fiscais identificadas a partir dos arquivos XML. Valor total:{" "}
            <strong>{brl(totalValor)}</strong>.
          </DialogDescription>
        </DialogHeader>

        {importing && (
          <div className="space-y-2 rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center justify-between text-xs font-semibold">
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                Processando e geocodificando endereços...
              </span>
              <span>
                {progress.current} de {progress.total} ({Math.round((progress.current / progress.total) * 100)}%)
              </span>
            </div>
            <Progress value={(progress.current / progress.total) * 100} className="h-2" />
          </div>
        )}

        <div className="flex-1 overflow-y-auto rounded-lg border">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="p-2.5 text-left">NF / Série</th>
                <th className="p-2.5 text-left">Destinatário</th>
                <th className="p-2.5 text-left">Endereço de Entrega</th>
                <th className="p-2.5 text-right">Valor</th>
                <th className="p-2.5 text-center">Vol.</th>
                <th className="p-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    Nenhuma nota fiscal na lista.
                  </td>
                </tr>
              ) : (
                items.map((nfe, idx) => (
                  <tr key={`${nfe.numero}-${nfe.serie}-${idx}`} className="hover:bg-muted/30">
                    <td className="p-2.5 font-mono font-bold">
                      {nfe.numero}
                      <span className="text-muted-foreground font-normal">/{nfe.serie}</span>
                    </td>
                    <td className="p-2.5 max-w-[180px] truncate" title={nfe.destinatario}>
                      <span className="font-semibold">{nfe.destinatario}</span>
                    </td>
                    <td className="p-2.5 max-w-[220px] truncate text-muted-foreground" title={`${nfe.logradouro}, ${nfe.numero_endereco} - ${nfe.bairro}, ${nfe.cidade} (${nfe.cep})`}>
                      {nfe.logradouro}, {nfe.numero_endereco} - {nfe.bairro} ({nfe.cep})
                    </td>
                    <td className="p-2.5 text-right font-mono font-semibold">
                      {brl(nfe.valorNumerico)}
                    </td>
                    <td className="p-2.5 text-center font-mono">
                      {nfe.volumes}
                    </td>
                    <td className="p-2.5 text-right space-x-1 whitespace-nowrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs"
                        disabled={importing}
                        onClick={() => {
                          onSelectNfeForForm(nfe);
                          onClose();
                        }}
                        title="Carregar esta nota individualmente no formulário"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1" />
                        Editar
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:bg-destructive/10"
                        disabled={importing}
                        onClick={() => removerItem(idx)}
                        title="Remover do lote"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter className="mt-4 flex flex-row items-center justify-between gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={importing}
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={importing || items.length === 0}
            onClick={importarTodas}
            className="gap-2"
          >
            {importing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                Importar {items.length} {items.length === 1 ? "nota" : "notas"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
