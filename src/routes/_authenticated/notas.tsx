import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Boxes,
  CheckCircle2,
  Clock,
  DollarSign,
  FileCheck2,
  FileText,
  Filter,
  FolderOpen,
  Loader2,
  PackageCheck,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { api } from "@/lib/api";
import { PageHeader, StatusBadge } from "@/components/fleet-ui";
import { NfeBatchImportModal } from "@/components/NfeBatchImportModal";
import { NfeXmlDropzone } from "@/components/NfeXmlDropzone";
import { InvoiceDocumentsModal } from "@/components/InvoiceDocumentsModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl, invoicesQuery, type Invoice } from "@/lib/fleet";
import { formatCep, geocode, lookupCep, normalizeCep } from "@/lib/geo";
import type { ParsedNfe } from "@/lib/nfe-parser";
import {
  addInvoiceDocument,
  useInvoiceDocuments,
  type DocumentType,
} from "@/lib/invoice-documents";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/notas")({
  head: () => ({
    meta: [
      { title: "Lançamento de NF-e — RotaFacil SP" },
      { name: "description", content: "Cadastre notas fiscais eletrônicas para entrega manualmente ou via XML." },
      { property: "og:title", content: "Lançamento de NF-e — RotaFacil SP" },
      { property: "og:description", content: "Cadastre notas fiscais eletrônicas para entrega manualmente ou via XML." },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(invoicesQuery),
  component: NotasPage,
});

const EMPTY = {
  numero: "",
  serie: "1",
  chave: "",
  destinatario: "",
  cep: "",
  logradouro: "",
  numero_endereco: "",
  bairro: "",
  cidade: "São Paulo",
  valor: "",
  volumes: "1",
};

function NotasPage() {
  const { data: invoices } = useSuspenseQuery(invoicesQuery);
  const qc = useQueryClient();
  const [f, setF] = useState(EMPTY);
  const [busyCep, setBusyCep] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadedXmlName, setLoadedXmlName] = useState<string | null>(null);
  const [batchNfes, setBatchNfes] = useState<ParsedNfe[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todas");

  // Documentos e Digitalização do Material (PDF / Pasta)
  const { docs: allDocs } = useInvoiceDocuments();
  const [selectedInvoiceForDocs, setSelectedInvoiceForDocs] = useState<Invoice | null>(null);
  const [pdfFile, setPdfFile] = useState<{ name: string; size: number; dataUrl: string } | null>(null);
  const [folderPath, setFolderPath] = useState("");
  const [docType, setDocType] = useState<DocumentType>("danfe");
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const set = (k: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function resetForm() {
    setF(EMPTY);
    setLoadedXmlName(null);
    setPdfFile(null);
    setFolderPath("");
    setDocType("danfe");
    if (pdfInputRef.current) pdfInputRef.current.value = "";
  }

  // Bento Metrics
  const stats = useMemo(() => {
    const total = invoices.length;
    const totalValor = invoices.reduce((acc, i) => acc + (Number(i.valor) || 0), 0);
    const totalVolumes = invoices.reduce((acc, i) => acc + (Number(i.volumes) || 1), 0);
    const pendentes = invoices.filter((i) => i.status === "pendente").length;
    const emRota = invoices.filter((i) => i.status === "em_rota").length;
    const entregues = invoices.filter((i) => i.status === "entregue").length;
    const devolvidas = invoices.filter((i) => i.status === "devolvida").length;
    const taxaEntrega = total > 0 ? Math.round((entregues / total) * 100) : 0;

    return { total, totalValor, totalVolumes, pendentes, emRota, entregues, devolvidas, taxaEntrega };
  }, [invoices]);

  // Filtro e Busca Preditiva em tempo real
  const filteredInvoices = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    return invoices.filter((i) => {
      const matchesStatus = statusFilter === "todas" || i.status === statusFilter;
      if (!matchesStatus) return false;
      if (!term) return true;
      return (
        i.numero.toLowerCase().includes(term) ||
        i.destinatario.toLowerCase().includes(term) ||
        i.logradouro.toLowerCase().includes(term) ||
        i.bairro.toLowerCase().includes(term) ||
        i.cidade.toLowerCase().includes(term) ||
        i.cep.includes(term) ||
        (i.chave && i.chave.includes(term))
      );
    });
  }, [invoices, searchTerm, statusFilter]);

  function handleSingleNfe(parsed: ParsedNfe, fileName: string) {
    setF({
      numero: parsed.numero,
      serie: parsed.serie || "1",
      chave: parsed.chave,
      destinatario: parsed.destinatario,
      cep: parsed.cep,
      logradouro: parsed.logradouro,
      numero_endereco: parsed.numero_endereco,
      bairro: parsed.bairro,
      cidade: parsed.cidade,
      valor: parsed.valor,
      volumes: parsed.volumes,
    });
    setLoadedXmlName(fileName);

    if (parsed.cep && (!parsed.logradouro || !parsed.bairro)) {
      lookupCep(parsed.cep).then((info) => {
        if (info) {
          setF((p) => ({
            ...p,
            cep: formatCep(info.cep),
            logradouro: p.logradouro || info.logradouro,
            bairro: p.bairro || info.bairro,
            cidade: p.cidade || info.cidade,
          }));
        }
      });
    }
  }

  function handleMultipleNfes(parsedList: ParsedNfe[]) {
    setBatchNfes(parsedList);
    setBatchModalOpen(true);
  }

  async function buscarCep() {
    setBusyCep(true);
    try {
      const info = await lookupCep(f.cep);
      if (!info) {
        toast.error("CEP não encontrado");
        return;
      }
      setF((p) => ({
        ...p,
        cep: formatCep(info.cep),
        logradouro: info.logradouro,
        bairro: info.bairro,
        cidade: info.cidade,
      }));
    } finally {
      setBusyCep(false);
    }
  }

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    const chave = f.chave.replace(/\D/g, "");
    if (chave && chave.length !== 44) {
      toast.error("A chave de acesso da NF-e deve ter 44 dígitos");
      return;
    }
    if (normalizeCep(f.cep).length !== 8) {
      toast.error("Informe um CEP válido");
      return;
    }
    setSaving(true);
    try {
      const coords = await geocode({
        cep: f.cep,
        logradouro: f.logradouro,
        numero: f.numero_endereco,
        bairro: f.bairro,
        cidade: f.cidade,
      });
      const created = await api.invoices.create({
        numero: f.numero,
        serie: f.serie,
        chave,
        destinatario: f.destinatario,
        cep: normalizeCep(f.cep),
        logradouro: f.logradouro,
        numero_endereco: f.numero_endereco,
        bairro: f.bairro,
        cidade: f.cidade,
        valor: Number(f.valor.replace(",", ".")) || 0,
        volumes: Number(f.volumes) || 1,
        lat: coords?.lat ?? null,
        lng: coords?.lng ?? null,
      });

      // Se houver PDF anexado ou caminho de pasta informado, digitaliza o material
      const targetInvoiceId = created?.id || f.numero;
      if (pdfFile || folderPath.trim()) {
        addInvoiceDocument({
          invoiceId: targetInvoiceId,
          tipo: docType,
          nomeArquivo: pdfFile?.name || (folderPath ? folderPath.split(/[/\\]/).pop() || `DANFE_${f.numero}.pdf` : `DANFE_${f.numero}.pdf`),
          urlData: pdfFile?.dataUrl || undefined,
          caminhoPasta: folderPath.trim() || undefined,
          tamanhoBytes: pdfFile?.size ?? undefined,
          observacoes: "Digitalizado no cadastro da nota fiscal",
        });
      }

      toast.success(
        coords
          ? `NF ${f.numero} lançada com sucesso e localizada no mapa!`
          : `NF ${f.numero} lançada (endereço não localizado com precisão no mapa)`,
      );
      resetForm();
      qc.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function excluir(id: string) {
    try {
      await api.invoices.delete(id);
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success("Nota fiscal removida com sucesso");
    } catch (e: any) {
      toast.error(e.message || "Erro ao remover nota fiscal");
    }
  }

  return (
    <div className="space-y-6 pb-12 animate-in fade-in-50 duration-300">
      <PageHeader
        title="Lançamento de NF-e"
        subtitle="Entrada de notas fiscais por leitura de XML, cadastro manual e digitalização de material em PDF"
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
            <Sparkles size={12} /> Bento View
          </span>
        }
      />

      <div className="px-6 sm:px-8 space-y-6">
        {/* Bento Grid: 4 Cartões de Métricas */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Card 1: Total Notas */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Total de Notas
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary transition-transform duration-200 group-hover:scale-110">
                <FileText size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {stats.total}
              </span>
              <span className="text-xs text-muted-foreground font-medium">cadastradas</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
              <span>{stats.pendentes} pendentes para despacho</span>
            </div>
          </div>

          {/* Card 2: Valor em Carga */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Valor Total em Carga
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 transition-transform duration-200 group-hover:scale-110">
                <DollarSign size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground font-mono">
                {brl(stats.totalValor)}
              </span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground">
              Soma total das mercadorias registradas
            </div>
          </div>

          {/* Card 3: Volumes Físicos */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Volumes Físicos
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/15 text-purple-600 dark:text-purple-400 transition-transform duration-200 group-hover:scale-110">
                <Boxes size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {stats.totalVolumes}
              </span>
              <span className="text-xs text-muted-foreground font-medium">volumes totais</span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-1.5">
              <span>{stats.emRota} em trânsito com motoristas</span>
            </div>
          </div>

          {/* Card 4: Taxa de Entrega */}
          <div className="group relative overflow-hidden rounded-2xl border border-border/70 bg-card p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md hover:border-primary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Taxa de Sucesso
              </span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 transition-transform duration-200 group-hover:scale-110">
                <PackageCheck size={18} />
              </div>
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-black tracking-tight text-foreground">
                {stats.taxaEntrega}%
              </span>
              <span className="text-xs text-muted-foreground font-medium">
                ({stats.entregues} entregues)
              </span>
            </div>
            <div className="mt-2 text-[11px] text-muted-foreground flex items-center gap-2">
              {stats.devolvidas > 0 ? (
                <span className="text-destructive font-semibold">
                  {stats.devolvidas} devoluções registradas
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  Nenhuma devolução
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bento Grid Principal: Form Lançamento + Tabela de Notas */}
        <div className="grid gap-6 lg:grid-cols-[460px_1fr]">
          {/* Bento Card: Formulário com Dropzone XML e Digitalização */}
          <div className="flex flex-col rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden">
            <div className="border-b border-border/60 p-5 bg-muted/20">
              <h2 className="text-base font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                Entrada de Notas Fiscais
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Importe arquivos XML da SEFAZ, anexe PDF ou preencha manualmente
              </p>
            </div>

            <form onSubmit={salvar} className="p-5 space-y-4">
              {/* Leitor de XML SEFAZ */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles size={13} className="text-primary" />
                  Importação Rápida por XML (Unitário ou em Lote)
                </Label>
                <NfeXmlDropzone
                  onSingleNfe={handleSingleNfe}
                  onMultipleNfe={handleMultipleNfes}
                  disabled={saving}
                />
              </div>

              {loadedXmlName && (
                <div className="flex items-center justify-between rounded-xl bg-primary/10 border border-primary/20 px-3 py-2 text-xs text-primary">
                  <div className="flex items-center gap-2 truncate">
                    <CheckCircle2 size={15} className="shrink-0 text-primary" />
                    <span className="font-semibold truncate">Dados do XML: {loadedXmlName}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0 rounded-md"
                    onClick={resetForm}
                  >
                    Limpar
                  </Button>
                </div>
              )}

              <div className="relative my-3">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/60" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-3 text-[11px] font-bold text-muted-foreground tracking-wider">
                    {loadedXmlName ? "Conferência dos Dados" : "Preenchimento Manual"}
                  </span>
                </div>
              </div>

              {/* Campos do formulário */}
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Número NF *</Label>
                  <Input
                    required
                    value={f.numero}
                    onChange={set("numero")}
                    placeholder="Ex: 12345"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Série</Label>
                  <Input
                    value={f.serie}
                    onChange={set("serie")}
                    placeholder="1"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Chave de acesso (44 dígitos)</Label>
                <Input
                  className="font-mono text-xs rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                  value={f.chave}
                  onChange={set("chave")}
                  maxLength={54}
                  placeholder="Ex: 3526..."
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Destinatário *</Label>
                <Input
                  required
                  value={f.destinatario}
                  onChange={set("destinatario")}
                  placeholder="Nome ou razão social do cliente"
                  className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">CEP *</Label>
                <div className="flex gap-2">
                  <Input
                    required
                    value={f.cep}
                    onChange={set("cep")}
                    onBlur={() =>
                      normalizeCep(f.cep).length === 8 && !f.logradouro && buscarCep()
                    }
                    placeholder="00000-000"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40 font-mono"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={buscarCep}
                    disabled={busyCep}
                    className="rounded-xl transition-all duration-200 hover:scale-105"
                    title="Buscar endereço por CEP"
                  >
                    {busyCep ? <Loader2 className="animate-spin" /> : <Search size={16} />}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label className="text-xs font-semibold">Logradouro</Label>
                  <Input
                    value={f.logradouro}
                    onChange={set("logradouro")}
                    placeholder="Rua / Av"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nº</Label>
                  <Input
                    value={f.numero_endereco}
                    onChange={set("numero_endereco")}
                    placeholder="123"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Bairro</Label>
                  <Input
                    value={f.bairro}
                    onChange={set("bairro")}
                    placeholder="Bairro"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Cidade</Label>
                  <Input
                    value={f.cidade}
                    onChange={set("cidade")}
                    placeholder="São Paulo"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Valor (R$)</Label>
                  <Input
                    inputMode="decimal"
                    value={f.valor}
                    onChange={set("valor")}
                    placeholder="0,00"
                    className="rounded-xl font-mono transition-all duration-200 focus-visible:ring-primary/40"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Volumes</Label>
                  <Input
                    type="number"
                    min={1}
                    value={f.volumes}
                    onChange={set("volumes")}
                    placeholder="1"
                    className="rounded-xl transition-all duration-200 focus-visible:ring-primary/40 font-mono"
                  />
                </div>
              </div>

              {/* Seção: Digitalização do Material (PDF / Pasta do Sistema) */}
              <div className="rounded-xl border border-border/70 p-3.5 bg-muted/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="text-primary" size={15} />
                    <Label className="text-xs font-bold text-foreground">
                      Digitalização do Material (PDF / Pasta)
                    </Label>
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">Opcional</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Tipo de Documento</Label>
                    <select
                      value={docType}
                      onChange={(e) => setDocType(e.target.value as DocumentType)}
                      className="w-full h-8 rounded-xl border border-border bg-background px-2.5 text-xs font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary"
                    >
                      <option value="danfe">DANFE / NF-e</option>
                      <option value="romaneio">Romaneio de Carga</option>
                      <option value="canhoto">Canhoto de Entrega</option>
                      <option value="comprovante">Comprovante</option>
                      <option value="outro">Outro PDF</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] text-muted-foreground">Arquivo PDF</Label>
                    <input
                      type="file"
                      ref={pdfInputRef}
                      accept="application/pdf,image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
                          toast.error("Selecione um arquivo PDF ou imagem");
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = (ev) => {
                          const result = ev.target?.result as string;
                          setPdfFile({
                            name: file.name,
                            size: file.size,
                            dataUrl: result,
                          });
                          toast.success(`Arquivo ${file.name} pronto para anexar!`);
                        };
                        reader.readAsDataURL(file);
                      }}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full h-8 rounded-xl text-xs gap-1.5 justify-center"
                      onClick={() => pdfInputRef.current?.click()}
                    >
                      <Upload size={12} /> {pdfFile ? "Trocar PDF" : "Anexar PDF"}
                    </Button>
                  </div>
                </div>

                {pdfFile && (
                  <div className="flex items-center justify-between rounded-lg bg-card p-2 border border-border text-xs">
                    <div className="flex items-center gap-2 truncate">
                      <FileCheck2 className="text-emerald-500 shrink-0" size={14} />
                      <span className="truncate font-medium">{pdfFile.name}</span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                        ({Math.round(pdfFile.size / 1024)} KB)
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setPdfFile(null);
                        if (pdfInputRef.current) pdfInputRef.current.value = "";
                      }}
                      className="text-muted-foreground hover:text-destructive p-1 rounded"
                      title="Remover anexo"
                    >
                      <X size={13} />
                    </button>
                  </div>
                )}

                {/* Campo para Vincular Caminho da Pasta no Sistema/Rede */}
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <FolderOpen size={12} /> Ou vincule caminho de pasta física/rede (Windows)
                  </Label>
                  <Input
                    placeholder="Ex: C:\NotasFiscais\NF_123.pdf ou \\servidor\nfe\"
                    value={folderPath}
                    onChange={(e) => setFolderPath(e.target.value)}
                    className="text-xs rounded-xl font-mono"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold shadow-md shadow-blue-500/25 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 py-2.5"
              >
                {saving && <Loader2 className="animate-spin mr-2" />} Lançar Nota Fiscal
              </Button>
            </form>
          </div>

          {/* Bento Card: Lista de Notas com Busca Preditiva e Filtros */}
          <div className="flex flex-col rounded-2xl border border-border/70 bg-card/90 shadow-sm backdrop-blur-xs overflow-hidden">
            {/* Header de busca & filtros rápidos */}
            <div className="border-b border-border/60 p-4 sm:p-5 space-y-3">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  <Input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Busca rápida por NF, cliente, rua, CEP..."
                    className="pl-9 pr-8 rounded-xl bg-muted/40 transition-all duration-200 focus-visible:bg-card focus-visible:ring-primary/40 text-xs sm:text-sm"
                  />
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => setSearchTerm("")}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                <div className="text-xs text-muted-foreground text-right font-medium shrink-0">
                  Mostrando <strong className="text-foreground">{filteredInvoices.length}</strong> de{" "}
                  {invoices.length} notas
                </div>
              </div>

              {/* Pílulas de filtro de status */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {[
                  { id: "todas", label: "Todas", count: invoices.length },
                  { id: "pendente", label: "Pendentes", count: stats.pendentes },
                  { id: "em_rota", label: "Em Rota", count: stats.emRota },
                  { id: "entregue", label: "Entregues", count: stats.entregues },
                  { id: "devolvida", label: "Devolvidas", count: stats.devolvidas },
                ].map((pill) => (
                  <button
                    key={pill.id}
                    type="button"
                    onClick={() => setStatusFilter(pill.id)}
                    className={cn(
                      "flex items-center gap-1.5 rounded-xl px-3 py-1 text-xs font-semibold transition-all duration-200",
                      statusFilter === pill.id
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <span>{pill.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-mono",
                        statusFilter === pill.id
                          ? "bg-primary-foreground/20 text-primary-foreground"
                          : "bg-background text-muted-foreground",
                      )}
                    >
                      {pill.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tabela de Notas com Micro-interações */}
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-[11px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <tr>
                    <th className="p-3.5 pl-5">NF / Série</th>
                    <th className="p-3.5">Destinatário & Endereço</th>
                    <th className="p-3.5">CEP</th>
                    <th className="p-3.5 text-right">Valor</th>
                    <th className="p-3.5 text-center">Vol.</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-5 text-right">Ação & Documentos</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <FileText className="h-8 w-8 text-muted-foreground/40" />
                          <p className="font-semibold text-foreground">Nenhuma nota encontrada</p>
                          <p className="text-xs text-muted-foreground">
                            {searchTerm
                              ? "Nenhum resultado corresponde à sua pesquisa."
                              : "Nenhuma nota fiscal cadastrada com este filtro."}
                          </p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((i) => {
                      const docCount = allDocs.filter(
                        (d) => d.invoiceId === i.id || d.invoiceId === i.numero,
                      ).length;
                      const hasDocs = docCount > 0;

                      return (
                        <tr
                          key={i.id}
                          className="group transition-colors duration-150 hover:bg-muted/40"
                        >
                          <td className="p-3.5 pl-5 font-mono font-bold text-foreground">
                            {i.numero}
                            <span className="text-muted-foreground font-normal text-xs">
                              /{i.serie}
                            </span>
                          </td>
                          <td className="p-3.5 max-w-[240px]">
                            <div className="font-semibold text-foreground truncate" title={i.destinatario}>
                              {i.destinatario}
                            </div>
                            <div className="text-xs text-muted-foreground truncate" title={`${i.logradouro}, ${i.numero_endereco} - ${i.bairro}, ${i.cidade}`}>
                              {i.logradouro}, {i.numero_endereco} · {i.bairro}
                            </div>
                          </td>
                          <td className="p-3.5 font-mono text-xs text-muted-foreground">
                            {formatCep(i.cep)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-foreground">
                            {brl(Number(i.valor))}
                          </td>
                          <td className="p-3.5 text-center font-mono text-xs">
                            {i.volumes}
                          </td>
                          <td className="p-3.5">
                            <StatusBadge status={i.status} />
                            {i.motivo_devolucao && (
                              <div className="mt-1 text-[11px] text-destructive truncate max-w-[140px]" title={i.motivo_devolucao}>
                                {i.motivo_devolucao}
                              </div>
                            )}
                          </td>
                          <td className="p-3.5 pr-5 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className={cn(
                                  "h-8 px-2 text-xs rounded-xl gap-1 transition-colors",
                                  hasDocs
                                    ? "text-blue-600 dark:text-blue-400 font-bold bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                                )}
                                onClick={() => setSelectedInvoiceForDocs(i)}
                                title={
                                  hasDocs
                                    ? `${docCount} documento(s) anexado(s) - clique para visualizar`
                                    : "Digitalizar material / anexar PDF ou pasta"
                                }
                              >
                                <FolderOpen size={13} />
                                <span className="hidden sm:inline">
                                  {hasDocs ? `${docCount} PDF${docCount > 1 ? "s" : ""}` : "Digitalizar"}
                                </span>
                              </Button>

                              {i.status === "pendente" && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                                  onClick={() => excluir(i.id)}
                                  aria-label={`Excluir nota ${i.numero}`}
                                  title="Excluir nota"
                                >
                                  <Trash2 size={15} />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de importação de lote XML */}
      <NfeBatchImportModal
        isOpen={batchModalOpen}
        onClose={() => setBatchModalOpen(false)}
        nfes={batchNfes}
        onSelectNfeForForm={(nfe) => handleSingleNfe(nfe, nfe.rawFileName || `NF ${nfe.numero}`)}
        onSuccess={() => qc.invalidateQueries({ queryKey: ["invoices"] })}
      />

      {/* Modal de Documentos Digitalizados (PDF / Pasta) */}
      <InvoiceDocumentsModal
        isOpen={Boolean(selectedInvoiceForDocs)}
        onClose={() => setSelectedInvoiceForDocs(null)}
        invoice={selectedInvoiceForDocs}
      />
    </div>
  );
}
