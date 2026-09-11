import Decimal from "decimal.js";
import type { DateRange, FinancialAdapter, NormalizedTransaction } from "./financial-adapter";
import { normalizeDescription } from "./reconciliation";

/**
 * Parser nativo (sem dependências externas) de extratos OFX de bancos
 * brasileiros. Suporta os dois formatos encontrados na prática:
 *
 * - OFX 1.x / SGML: tags "leaf" sem fechamento (`<DTPOSTED>20240105120000`),
 *   apenas os containers (`<STMTTRN>`, `<BANKTRANLIST>`, `<OFX>` …) são
 *   fechados explicitamente. É o formato mais comum em bancos brasileiros.
 * - OFX 2.x / XML: todas as tags fechadas, com prólogo `<?xml ...?>`.
 *
 * A normalização de encoding lê o cabeçalho SGML (`CHARSET:1252`) e decodifica
 * o buffer como Windows-1252 quando aplicável; caso contrário assume UTF-8.
 */

const STMTTRN_BLOCK = /<STMTTRN>[\s\S]*?<\/STMTTRN>/gi;

/**
 * Converte o corpo SGML em algo próximo de XML bem-formado: qualquer linha
 * no padrão `<TAG>valor` (sem fechamento e sem tags aninhadas) recebe a tag
 * de fechamento correspondente. Containers já fechados no arquivo original
 * (convenção universal dos bancos) permanecem intactos.
 */
function sgmlToXml(raw: string): string {
  const bodyMatch = raw.match(/<OFX>[\s\S]*<\/OFX>/i);
  const body = bodyMatch ? bodyMatch[0] : raw;

  return body
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const leaf = line.match(/^<([A-Za-z0-9.]+)>([^<]+)$/);
      if (!leaf) return line;
      const [, tag, value] = leaf;
      return `<${tag}>${value.trim()}</${tag}>`;
    })
    .join("\n");
}

function extractTag(block: string, tag: string): string | undefined {
  const match = block.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match ? match[1].trim() : undefined;
}

/** `20240105120000[-3:BRT]` ou `20240105` → Date (UTC, timezone da conta ignorado). */
function parseOfxDate(raw: string): Date {
  const clean = raw.split("[")[0]?.trim() ?? raw;
  const year = Number(clean.slice(0, 4));
  const month = Number(clean.slice(4, 6));
  const day = Number(clean.slice(6, 8));
  const hour = Number(clean.slice(8, 10) || "0");
  const minute = Number(clean.slice(10, 12) || "0");
  const second = Number(clean.slice(12, 14) || "0");
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

/** OFX usa ponto decimal por especificação; normaliza o raro caso de vírgula. */
function parseOfxAmount(raw: string): Decimal {
  const trimmed = raw.trim();
  const normalized =
    !trimmed.includes(".") && trimmed.includes(",") ? trimmed.replace(",", ".") : trimmed;
  return new Decimal(normalized);
}

export class OfxAdapter implements FinancialAdapter {
  readonly source = "OFX_IMPORT" as const;

  constructor(private readonly rawInput: Buffer | string) {}

  /** Decodifica o buffer bruto respeitando o CHARSET declarado no cabeçalho OFX. */
  private decode(): string {
    if (typeof this.rawInput === "string") return this.rawInput;

    const header = this.rawInput.subarray(0, 400).toString("ascii");
    const charsetMatch = header.match(/CHARSET:\s*(\d+)/i);
    const encoding = charsetMatch?.[1] === "1252" ? "windows-1252" : "utf-8";
    return new TextDecoder(encoding).decode(this.rawInput);
  }

  parsePayload(data: unknown): unknown[] {
    const text = typeof data === "string" ? data : this.decode();
    const xmlish = sgmlToXml(text);
    return xmlish.match(STMTTRN_BLOCK) ?? [];
  }

  normalize(raw: unknown): NormalizedTransaction {
    const block = String(raw);

    const fitId = extractTag(block, "FITID");
    const dtposted = extractTag(block, "DTPOSTED");
    const trnamt = extractTag(block, "TRNAMT");
    const memo = extractTag(block, "MEMO") ?? extractTag(block, "NAME") ?? "";

    if (!dtposted || !trnamt) {
      throw new Error(
        "Registro <STMTTRN> inválido: DTPOSTED e/ou TRNAMT ausentes no OFX.",
      );
    }

    const originalDescription = memo.trim();

    return {
      date: parseOfxDate(dtposted),
      amount: parseOfxAmount(trnamt),
      description: normalizeDescription(originalDescription),
      originalDescription,
      fitId,
    };
  }

  async fetchTransactions(range: DateRange): Promise<NormalizedTransaction[]> {
    const blocks = this.parsePayload(this.decode());
    return blocks
      .map((block) => this.normalize(block))
      .filter((transaction) => transaction.date >= range.from && transaction.date <= range.to);
  }
}
