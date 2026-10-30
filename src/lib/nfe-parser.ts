import { formatCep } from "./geo";

export type ParsedNfe = {
  numero: string;
  serie: string;
  chave: string;
  destinatario: string;
  cep: string;
  logradouro: string;
  numero_endereco: string;
  bairro: string;
  cidade: string;
  valor: string;
  valorNumerico: number;
  volumes: string;
  emitente?: string | undefined;
  rawFileName?: string | undefined;
};

/**
 * Localiza um elemento ignorando namespaces e maiúsculas/minúsculas.
 */
function findElement(parent: Element | Document, tagName: string): Element | null {
  const lower = tagName.toLowerCase();
  const direct = parent.getElementsByTagName(tagName);
  const first = direct[0];
  if (first) return first;

  const all = parent.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!el) continue;
    const name = el.localName || el.nodeName.split(":").pop() || "";
    if (name.toLowerCase() === lower) {
      return el;
    }
  }
  return null;
}

/**
 * Localiza todos os elementos que possuem o nome da tag especificado,
 * ignorando namespaces.
 */
function findElements(parent: Element | Document, tagName: string): Element[] {
  const lower = tagName.toLowerCase();
  const direct = parent.getElementsByTagName(tagName);
  if (direct.length > 0) return Array.from(direct);

  const matched: Element[] = [];
  const all = parent.getElementsByTagName("*");
  for (let i = 0; i < all.length; i++) {
    const el = all[i];
    if (!el) continue;
    const name = el.localName || el.nodeName.split(":").pop() || "";
    if (name.toLowerCase() === lower) {
      matched.push(el);
    }
  }
  return matched;
}

/**
 * Obtém o texto de uma tag filha imediata ou descendente.
 */
function getText(parent: Element | Document, tagName: string): string {
  const el = findElement(parent, tagName);
  return el?.textContent?.trim() || "";
}

/**
 * Analisa e extrai os dados necessários para entrega de uma NF-e a partir do XML.
 */
export function parseNfeXml(xmlContent: string, fileName?: string): ParsedNfe {
  if (!xmlContent || !xmlContent.trim()) {
    throw new Error("O arquivo XML está vazio.");
  }

  // Remove BOM caso presente
  const cleanXml = xmlContent.replace(/^\uFEFF/, "").trim();

  const parser = new DOMParser();
  const doc = parser.parseFromString(cleanXml, "text/xml");

  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("Arquivo XML inválido ou corrompido.");
  }

  const infNFe = findElement(doc, "infNFe");
  if (!infNFe) {
    throw new Error("O arquivo XML não é uma NF-e válida (tag infNFe não encontrada).");
  }

  // Chave de acesso (44 dígitos numéricos)
  let chave = getText(doc, "chNFe").replace(/\D/g, "");
  if (chave.length !== 44) {
    const idAttr = infNFe.getAttribute("Id") || infNFe.getAttribute("id") || "";
    const digits = idAttr.replace(/\D/g, "");
    if (digits.length === 44) {
      chave = digits;
    }
  }

  // Dados de identificação (ide)
  const ide = findElement(infNFe, "ide");
  const numero = (ide ? getText(ide, "nNF") : getText(infNFe, "nNF")) || "";
  const serie = (ide ? getText(ide, "serie") : getText(infNFe, "serie")) || "1";

  // Emitente
  const emit = findElement(infNFe, "emit");
  const emitente = emit ? getText(emit, "xNome") || getText(emit, "xFant") : "";

  // Destinatário e Endereço de entrega
  const dest = findElement(infNFe, "dest");
  let destinatario = dest
    ? getText(dest, "xNome") || getText(dest, "CPF") || getText(dest, "CNPJ")
    : "";
  if (!destinatario) {
    destinatario = "Consumidor Final";
  }

  const enderDest = dest ? findElement(dest, "enderDest") : null;
  const logradouro = enderDest ? getText(enderDest, "xLgr") : "";
  const numero_endereco = enderDest ? getText(enderDest, "nro") || "S/N" : "S/N";
  const bairro = enderDest ? getText(enderDest, "xBairro") : "";
  const cidade = enderDest ? getText(enderDest, "xMun") || "São Paulo" : "São Paulo";
  const rawCep = enderDest ? getText(enderDest, "CEP") : "";
  const cep = formatCep(rawCep);

  // Valor total da nota
  const total = findElement(infNFe, "total");
  const icmsTot = total ? findElement(total, "ICMSTot") : null;
  const vNF = icmsTot ? getText(icmsTot, "vNF") : getText(infNFe, "vNF");
  const valorNumerico = parseFloat(vNF) || 0;
  const valor = valorNumerico > 0 ? valorNumerico.toFixed(2).replace(".", ",") : "0,00";

  // Quantidade de volumes
  const transp = findElement(infNFe, "transp");
  let totalVolumes = 0;
  if (transp) {
    const vols = findElements(transp, "vol");
    for (const vol of vols) {
      const qVol = getText(vol, "qVol");
      const q = parseInt(qVol, 10);
      if (!isNaN(q) && q > 0) {
        totalVolumes += q;
      }
    }
  }
  const volumes = totalVolumes > 0 ? String(totalVolumes) : "1";

  return {
    numero,
    serie,
    chave,
    destinatario,
    cep,
    logradouro,
    numero_endereco,
    bairro,
    cidade,
    valor,
    valorNumerico,
    volumes,
    emitente,
    rawFileName: fileName,
  };
}
