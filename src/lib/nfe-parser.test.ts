import { describe, expect, it } from "vitest";
import { parseNfeXml } from "./nfe-parser";

const SAMPLE_NFE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe>
    <infNFe Id="NFe35261012345678000195550010000123451000123456" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <serie>2</serie>
        <nNF>98765</nNF>
        <dhEmi>2026-10-30T10:00:00-03:00</dhEmi>
      </ide>
      <emit>
        <CNPJ>12345678000195</CNPJ>
        <xNome>Distribuidora Central SP Ltda</xNome>
      </emit>
      <dest>
        <CNPJ>98765432000188</CNPJ>
        <xNome>Mercado Modelo da Vila</xNome>
        <enderDest>
          <xLgr>Av. Paulista</xLgr>
          <nro>1578</nro>
          <xBairro>Bela Vista</xBairro>
          <cMun>3550308</cMun>
          <xMun>São Paulo</xMun>
          <UF>SP</UF>
          <CEP>01310200</CEP>
        </enderDest>
      </dest>
      <total>
        <ICMSTot>
          <vNF>2450.50</vNF>
        </ICMSTot>
      </total>
      <transp>
        <vol>
          <qVol>3</qVol>
        </vol>
        <vol>
          <qVol>2</qVol>
        </vol>
      </transp>
    </infNFe>
  </NFe>
  <protNFe versao="4.00">
    <infProt>
      <chNFe>35261012345678000195550010000123451000123456</chNFe>
      <cStat>100</cStat>
    </infProt>
  </protNFe>
</nfeProc>`;

describe("parseNfeXml", () => {
  it("extrai corretamente todos os dados da NF-e", () => {
    const res = parseNfeXml(SAMPLE_NFE_XML, "nfe_98765.xml");

    expect(res.numero).toBe("98765");
    expect(res.serie).toBe("2");
    expect(res.chave).toBe("35261012345678000195550010000123451000123456");
    expect(res.destinatario).toBe("Mercado Modelo da Vila");
    expect(res.logradouro).toBe("Av. Paulista");
    expect(res.numero_endereco).toBe("1578");
    expect(res.bairro).toBe("Bela Vista");
    expect(res.cidade).toBe("São Paulo");
    expect(res.cep).toBe("01310-200");
    expect(res.valor).toBe("2450,50");
    expect(res.valorNumerico).toBe(2450.5);
    expect(res.volumes).toBe("5"); // 3 + 2
    expect(res.emitente).toBe("Distribuidora Central SP Ltda");
  });

  it("recupera a chave de acesso pelo Id da infNFe quando chNFe não existir", () => {
    const xmlWithoutProt = `<NFe xmlns="http://www.portalfiscal.inf.br/nfe">
      <infNFe Id="NFe35261012345678000195550010000999991000999999">
        <ide><nNF>99999</nNF></ide>
        <dest><xNome>Cliente Exemplo</xNome><enderDest><CEP>04543011</CEP></enderDest></dest>
      </infNFe>
    </NFe>`;
    const res = parseNfeXml(xmlWithoutProt);
    expect(res.numero).toBe("99999");
    expect(res.serie).toBe("1");
    expect(res.chave).toBe("35261012345678000195550010000999991000999999");
    expect(res.destinatario).toBe("Cliente Exemplo");
    expect(res.volumes).toBe("1");
  });

  it("lida com UTF-8 BOM", () => {
    const withBom = "\uFEFF" + SAMPLE_NFE_XML;
    const res = parseNfeXml(withBom);
    expect(res.numero).toBe("98765");
  });

  it("lança erro para XML inválido ou não-NFe", () => {
    expect(() => parseNfeXml("<foo>bar</foo>")).toThrow("não é uma NF-e válida");
    expect(() => parseNfeXml("não é xml")).toThrow();
  });
});

