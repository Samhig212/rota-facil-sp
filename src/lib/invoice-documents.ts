import { useEffect, useState } from "react";

export type DocumentType = "danfe" | "canhoto" | "romaneio" | "comprovante" | "outro";

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  danfe: "DANFE / NF-e Digitalizada",
  canhoto: "Canhoto Assinado de Entrega",
  romaneio: "Romaneio de Separação",
  comprovante: "Comprovante de Recebimento",
  outro: "Outro Documento PDF",
};

export interface InvoiceDocument {
  id: string;
  invoiceId: string;
  tipo: DocumentType;
  nomeArquivo: string;
  tamanhoBytes?: number | undefined;
  tamanhoFormatado?: string | undefined;
  urlData?: string | undefined; // Data URL em base64 (data:application/pdf;base64,...)
  caminhoPasta?: string | undefined; // Caminho físico no Windows/rede (ex: C:\NotasFiscais\NF-12345.pdf)
  dataUpload: string;
  observacoes?: string | undefined;
}

const STORAGE_KEY = "rotafacil_invoice_documents_v1";

// Documentos de demonstração iniciais
const INITIAL_DOCS: InvoiceDocument[] = [
  {
    id: "doc-001",
    invoiceId: "inv-demo-1",
    tipo: "danfe",
    nomeArquivo: "DANFE_NF_12345_Distribuidora.pdf",
    tamanhoBytes: 245000,
    tamanhoFormatado: "245 KB",
    caminhoPasta: "C:\\NotasFiscais\\2026\\NF_12345.pdf",
    dataUpload: "2026-11-01T10:30:00",
    observacoes: "DANFE emitida e conferida na expedição.",
  },
  {
    id: "doc-002",
    invoiceId: "inv-demo-2",
    tipo: "canhoto",
    nomeArquivo: "Canhoto_Assinado_NF_98765.pdf",
    tamanhoBytes: 180000,
    tamanhoFormatado: "180 KB",
    caminhoPasta: "C:\\Entregas\\Canhotos\\Canhoto_98765.pdf",
    dataUpload: "2026-11-02T16:45:00",
    observacoes: "Recebido e assinado pelo encarregado da recepção.",
  },
];

function readStorage(): InvoiceDocument[] {
  if (typeof window === "undefined") return INITIAL_DOCS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DOCS));
      return INITIAL_DOCS;
    }
    return JSON.parse(raw);
  } catch {
    return INITIAL_DOCS;
  }
}

function writeStorage(docs: InvoiceDocument[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(docs));
    window.dispatchEvent(new CustomEvent("rotafacil:invoice-documents-updated"));
  } catch (err) {
    console.error("Erro ao salvar documentos digitalizados:", err);
  }
}

export function getInvoiceDocuments(invoiceId?: string): InvoiceDocument[] {
  const all = readStorage();
  if (!invoiceId) return all;
  return all.filter((d) => d.invoiceId === invoiceId);
}

export function hasInvoiceDocument(invoiceId: string): boolean {
  const docs = getInvoiceDocuments(invoiceId);
  return docs.length > 0;
}

export function formatFileSize(bytes?: number): string {
  if (!bytes || bytes === 0) return "0 KB";
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function addInvoiceDocument(
  doc: Omit<InvoiceDocument, "id" | "dataUpload">,
): InvoiceDocument {
  const all = readStorage();
  const newDoc: InvoiceDocument = {
    ...doc,
    id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    dataUpload: new Date().toISOString(),
    tamanhoFormatado: doc.tamanhoFormatado || formatFileSize(doc.tamanhoBytes),
  };
  const updated = [newDoc, ...all];
  writeStorage(updated);
  return newDoc;
}

export function deleteInvoiceDocument(id: string): void {
  const all = readStorage();
  const updated = all.filter((d) => d.id !== id);
  writeStorage(updated);
}

export function useInvoiceDocuments(invoiceId?: string) {
  const [docs, setDocs] = useState<InvoiceDocument[]>(() => getInvoiceDocuments(invoiceId));

  useEffect(() => {
    function refresh() {
      setDocs(getInvoiceDocuments(invoiceId));
    }
    window.addEventListener("rotafacil:invoice-documents-updated", refresh);
    return () => window.removeEventListener("rotafacil:invoice-documents-updated", refresh);
  }, [invoiceId]);

  return {
    docs,
    addDocument: addInvoiceDocument,
    deleteDocument: deleteInvoiceDocument,
    hasDocuments: docs.length > 0,
  };
}
