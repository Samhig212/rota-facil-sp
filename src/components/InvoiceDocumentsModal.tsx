import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Eye,
  FileCheck,
  FileText,
  FileUp,
  FolderOpen,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Invoice } from "@/lib/fleet";
import {
  DOCUMENT_TYPE_LABELS,
  formatFileSize,
  useInvoiceDocuments,
  type DocumentType,
  type InvoiceDocument,
} from "@/lib/invoice-documents";

interface InvoiceDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  invoice: Invoice | null;
}

export function InvoiceDocumentsModal({
  isOpen,
  onClose,
  invoice,
}: InvoiceDocumentsModalProps) {
  const { docs, addDocument, deleteDocument } = useInvoiceDocuments(invoice?.id);

  const [activeTab, setActiveTab] = useState<"list" | "new">("list");
  const [selectedDocPreview, setSelectedDocPreview] = useState<InvoiceDocument | null>(null);

  // Formulário de novo anexo
  const [docTipo, setDocTipo] = useState<DocumentType>("danfe");
  const [caminhoPasta, setCaminhoPasta] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileBase64, setFileBase64] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function resetForm() {
    setDocTipo("danfe");
    setCaminhoPasta("");
    setObservacoes("");
    setSelectedFile(null);
    setFileBase64("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Por favor, selecione um arquivo em formato PDF.");
      return;
    }

    setSelectedFile(file);

    // Sugere caminho padrão de pasta se não estiver preenchido
    if (!caminhoPasta) {
      setCaminhoPasta(`C:\\NotasFiscais\\${file.name}`);
    }

    const reader = new FileReader();
    reader.onload = () => {
      setFileBase64(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  function handleSalvarDocumento(e: React.FormEvent) {
    e.preventDefault();
    if (!invoice) return;

    if (!selectedFile && !caminhoPasta.trim()) {
      toast.error("Anexe um arquivo PDF ou informe o caminho da pasta no sistema.");
      return;
    }

    const nomeArquivo =
      selectedFile?.name ||
      caminhoPasta.split(/[\\/]/).pop() ||
      `Documento_NF_${invoice.numero}.pdf`;

    addDocument({
      invoiceId: invoice.id,
      tipo: docTipo,
      nomeArquivo,
      tamanhoBytes: selectedFile?.size,
      tamanhoFormatado: selectedFile ? formatFileSize(selectedFile.size) : undefined,
      urlData: fileBase64 || undefined,
      caminhoPasta: caminhoPasta.trim() || undefined,
      observacoes: observacoes.trim() || undefined,
    });

    toast.success("Documento PDF digitalizado vinculado com sucesso!");
    resetForm();
    setActiveTab("list");
  }

  function copiarCaminho(caminho?: string) {
    if (!caminho) return;
    navigator.clipboard.writeText(caminho);
    toast.success("Caminho copiado para a área de transferência!");
  }

  function baixarPdf(doc: InvoiceDocument) {
    if (!doc.urlData) {
      toast.info(`Arquivo vinculado na pasta do sistema: ${doc.caminhoPasta}`);
      return;
    }
    const a = document.createElement("a");
    a.href = doc.urlData;
    a.download = doc.nomeArquivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  if (!invoice) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[88vh] flex flex-col p-6 rounded-2xl">
        <DialogHeader className="border-b border-border/60 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400">
                <FileText size={20} />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Material Digitalizado & PDFs — NF {invoice.numero}
                </DialogTitle>
                <DialogDescription className="text-xs">
                  {invoice.destinatario} · {invoice.bairro} ({invoice.cidade})
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-xl">
              <Button
                type="button"
                size="sm"
                variant={activeTab === "list" ? "default" : "ghost"}
                className="h-7 text-xs rounded-lg"
                onClick={() => {
                  setActiveTab("list");
                  setSelectedDocPreview(null);
                }}
              >
                Documentos ({docs.length})
              </Button>
              <Button
                type="button"
                size="sm"
                variant={activeTab === "new" ? "default" : "ghost"}
                className="h-7 text-xs rounded-lg gap-1"
                onClick={() => {
                  setActiveTab("new");
                  setSelectedDocPreview(null);
                }}
              >
                <Plus size={13} /> Digitalizar / Anexar
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Visualizador de PDF Expandido */}
        {selectedDocPreview ? (
          <div className="flex-1 flex flex-col space-y-3 py-2 overflow-hidden">
            <div className="flex items-center justify-between bg-muted/30 p-2.5 rounded-xl border border-border/60 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-foreground">
                  {selectedDocPreview.nomeArquivo}
                </span>
                <span className="text-muted-foreground">
                  ({DOCUMENT_TYPE_LABELS[selectedDocPreview.tipo]})
                </span>
              </div>
              <div className="flex items-center gap-2">
                {selectedDocPreview.caminhoPasta && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs rounded-lg gap-1"
                    onClick={() => copiarCaminho(selectedDocPreview.caminhoPasta)}
                  >
                    <Copy size={12} /> Copiar Caminho
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs rounded-lg gap-1"
                  onClick={() => baixarPdf(selectedDocPreview)}
                >
                  <Download size={12} /> Baixar
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 rounded-lg"
                  onClick={() => setSelectedDocPreview(null)}
                >
                  <X size={14} />
                </Button>
              </div>
            </div>

            <div className="flex-1 rounded-xl border border-border/60 bg-muted/20 overflow-hidden min-h-[380px]">
              {selectedDocPreview.urlData ? (
                <iframe
                  src={selectedDocPreview.urlData}
                  className="w-full h-full min-h-[380px] border-0"
                  title="Visualizador de PDF"
                />
              ) : (
                <div className="p-8 text-center space-y-3 my-auto flex flex-col items-center justify-center h-full">
                  <FolderOpen className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground">
                    Documento vinculado a pasta local/rede
                  </p>
                  <p className="text-xs text-muted-foreground font-mono bg-card px-3 py-1.5 rounded-lg border max-w-md break-all">
                    {selectedDocPreview.caminhoPasta}
                  </p>
                  <Button
                    size="sm"
                    className="rounded-xl gap-1.5 text-xs"
                    onClick={() => copiarCaminho(selectedDocPreview.caminhoPasta)}
                  >
                    <Copy size={13} /> Copiar Caminho para Abrir no Windows Explorer
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === "list" ? (
          /* Lista de Documentos */
          <div className="flex-1 overflow-y-auto space-y-3 py-2 pr-1 max-h-[460px]">
            {docs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border/70 p-8 text-center space-y-3 my-6">
                <FileText className="h-10 w-10 mx-auto text-muted-foreground/40" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Nenhum documento digitalizado ainda
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Anexe a DANFE em PDF ou o canhoto assinado de entrega para vincular a esta nota.
                  </p>
                </div>
                <Button
                  size="sm"
                  onClick={() => setActiveTab("new")}
                  className="rounded-xl gap-1.5 text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white"
                >
                  <Plus size={14} /> Digitalizar Material Agora
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-xl border border-border/70 bg-card hover:border-primary/40 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                        PDF
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-foreground truncate" title={doc.nomeArquivo}>
                            {doc.nomeArquivo}
                          </p>
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-md bg-muted text-muted-foreground">
                            {DOCUMENT_TYPE_LABELS[doc.tipo]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {doc.tamanhoFormatado && <span>{doc.tamanhoFormatado}</span>}
                          {doc.caminhoPasta && (
                            <span className="truncate max-w-[280px]" title={doc.caminhoPasta}>
                              · {doc.caminhoPasta}
                            </span>
                          )}
                          <span>· {new Date(doc.dataUpload).toLocaleDateString("pt-BR")}</span>
                        </div>
                        {doc.observacoes && (
                          <p className="text-[11px] text-muted-foreground italic mt-0.5">
                            "{doc.observacoes}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {doc.caminhoPasta && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                          title="Copiar caminho da pasta"
                          onClick={() => copiarCaminho(doc.caminhoPasta)}
                        >
                          <Copy size={15} />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-8 text-xs rounded-lg gap-1 font-semibold"
                        onClick={() => setSelectedDocPreview(doc)}
                      >
                        <Eye size={13} /> Visualizar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground"
                        title="Baixar arquivo"
                        onClick={() => baixarPdf(doc)}
                      >
                        <Download size={15} />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Excluir documento"
                        onClick={() => {
                          deleteDocument(doc.id);
                          toast.success("Documento removido");
                        }}
                      >
                        <Trash2 size={15} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Formulário de Novo Documento */
          <form onSubmit={handleSalvarDocumento} className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Tipo do Documento</Label>
                <Select value={docTipo} onValueChange={(v) => setDocTipo(v as DocumentType)}>
                  <SelectTrigger className="rounded-xl text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl text-xs">
                    {Object.entries(DOCUMENT_TYPE_LABELS).map(([k, label]) => (
                      <SelectItem key={k} value={k}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  Caminho da Pasta / Arquivo no Sistema
                </Label>
                <Input
                  placeholder="Ex: C:\NotasFiscais\2026\NF-12345.pdf"
                  className="rounded-xl text-xs font-mono"
                  value={caminhoPasta}
                  onChange={(e) => setCaminhoPasta(e.target.value)}
                />
              </div>
            </div>

            {/* Dropzone / Upload de Arquivo PDF */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Anexar Arquivo PDF</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                className="hidden"
                onChange={handleFileSelect}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                className="cursor-pointer flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed border-border/70 hover:border-primary/60 bg-muted/20 hover:bg-muted/40 transition-colors text-center"
              >
                <FileUp className="h-6 w-6 text-primary mb-1.5" />
                {selectedFile ? (
                  <div>
                    <p className="text-xs font-bold text-foreground">
                      {selectedFile.name} ({formatFileSize(selectedFile.size)})
                    </p>
                    <p className="text-[11px] text-emerald-600 font-semibold mt-0.5">
                      ✓ Arquivo PDF carregado e pronto para anexar
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      Clique para escolher o arquivo PDF do seu computador
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Formatos suportados: .pdf (DANFE, comprovante de entrega, romaneio)
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Observações (Opcional)</Label>
              <Input
                placeholder="Ex: Assinado pelo cliente no ato do descarregamento"
                className="rounded-xl text-xs"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>

            <DialogFooter className="pt-2 flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-xl text-xs"
                onClick={() => {
                  resetForm();
                  setActiveTab("list");
                }}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                className="rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs"
              >
                Vincular Documento PDF
              </Button>
            </DialogFooter>
          </form>
        )}

        <DialogFooter className="border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="outline"
            className="rounded-xl text-xs ml-auto"
            onClick={onClose}
          >
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

