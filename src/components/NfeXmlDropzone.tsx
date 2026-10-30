import { useRef, useState } from "react";
import { toast } from "sonner";
import { ClipboardPaste, FileCode2, FileUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { parseNfeXml, type ParsedNfe } from "@/lib/nfe-parser";

interface NfeXmlDropzoneProps {
  onSingleNfe: (nfe: ParsedNfe, fileName: string) => void;
  onMultipleNfe: (nfes: ParsedNfe[]) => void;
  disabled?: boolean;
}

export function NfeXmlDropzone({
  onSingleNfe,
  onMultipleNfe,
  disabled = false,
}: NfeXmlDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [pasteModalOpen, setPasteModalOpen] = useState(false);
  const [pastedXml, setPastedXml] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function processFiles(files: FileList | File[]) {
    const xmlFiles = Array.from(files).filter(
      (f) =>
        f.name.toLowerCase().endsWith(".xml") ||
        f.type === "text/xml" ||
        f.type === "application/xml",
    );

    if (xmlFiles.length === 0) {
      toast.error("Nenhum arquivo XML válido foi selecionado.");
      return;
    }

    setIsProcessing(true);

    try {
      const results = await Promise.all(
        xmlFiles.map(async (file) => {
          try {
            const text = await file.text();
            const parsed = parseNfeXml(text, file.name);
            return { ok: true as const, data: parsed, file };
          } catch (err) {
            return { ok: false as const, error: (err as Error).message, file };
          }
        }),
      );

      const successful: ParsedNfe[] = [];
      const failed: { error: string; file: File }[] = [];

      for (const r of results) {
        if (r.ok) {
          successful.push(r.data);
        } else {
          failed.push({ error: r.error, file: r.file });
        }
      }

      if (failed.length > 0) {
        failed.forEach((f) => {
          toast.error(`Erro ao ler "${f.file.name}": ${f.error}`);
        });
      }

      const firstSuccess = successful[0];
      const firstXml = xmlFiles[0];
      if (successful.length === 1 && xmlFiles.length === 1 && firstSuccess && firstXml) {
        onSingleNfe(firstSuccess, firstXml.name);
        toast.success(`NF ${firstSuccess.numero} lida com sucesso do XML!`);
      } else if (successful.length > 0) {
        onMultipleNfe(successful);
      }
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (disabled || isProcessing) return;

    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !isProcessing) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(e.target.files);
    }
  }

  function processarXmlColado() {
    if (!pastedXml.trim()) {
      toast.error("Cole o conteúdo XML da NF-e.");
      return;
    }
    try {
      const parsed = parseNfeXml(pastedXml, "xml_colado.xml");
      onSingleNfe(parsed, "XML colado");
      toast.success(`NF ${parsed.numero} lida com sucesso do XML!`);
      setPasteModalOpen(false);
      setPastedXml("");
    } catch (err) {
      toast.error(`Erro ao ler XML: ${(err as Error).message}`);
    }
  }

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xml,text/xml,application/xml"
        multiple
        className="hidden"
        onChange={handleFileInput}
        disabled={disabled || isProcessing}
      />

      <div
        onDragOver={handleDragOver}
        onDragEnter={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !isProcessing && fileInputRef.current?.click()}
        className={cn(
          "group relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-4 text-center transition-all cursor-pointer",
          isDragging
            ? "border-primary bg-primary/10 scale-[1.01]"
            : "border-border hover:border-primary/60 hover:bg-muted/40",
          (disabled || isProcessing) && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex flex-col items-center gap-1.5">
          <div className="rounded-full bg-primary/10 p-2 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <FileUp className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold">
              {isProcessing
                ? "Lendo arquivo(s) XML..."
                : "Importar Nota Fiscal por XML"}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Arraste e solte o XML aqui ou clique para selecionar (suporta múltiplos)
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span className="flex items-center gap-1">
          <FileCode2 className="h-3.5 w-3.5" />
          Compatível com NF-e modelo 55 / NFC-e modelo 65
        </span>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setPasteModalOpen(true)}
          disabled={disabled || isProcessing}
        >
          <ClipboardPaste className="h-3.5 w-3.5 mr-1" />
          Colar texto XML
        </Button>
      </div>

      {/* Modal para colar texto XML */}
      <Dialog open={pasteModalOpen} onOpenChange={setPasteModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardPaste className="h-5 w-5 text-primary" />
              Colar Código XML da NF-e
            </DialogTitle>
            <DialogDescription>
              Cole o conteúdo XML completo da Nota Fiscal Eletrônica abaixo para preencher os dados automaticamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              placeholder="Cole o XML aqui: <nfeProc... ou <NFe..."
              className="font-mono text-xs h-48"
              value={pastedXml}
              onChange={(e) => setPastedXml(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPasteModalOpen(false);
                setPastedXml("");
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={processarXmlColado}>
              Ler e Carregar Nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
