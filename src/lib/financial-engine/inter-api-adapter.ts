import https from "node:https";
import Decimal from "decimal.js";
import type { DateRange, FinancialAdapter, NormalizedTransaction } from "./financial-adapter";
import { normalizeDescription } from "./reconciliation";

const DEFAULT_TOKEN_URL = "https://cdpj.partners.bancointer.com.br/oauth/v2/token";
const DEFAULT_EXTRATO_URL = "https://cdpj.partners.bancointer.com.br/banking/v2/extrato";

interface InterTokenResponse {
  access_token?: string;
  expires_in?: number;
}

/** Linha do extrato Banking v2 do Inter. */
export interface InterExtratoTransaction {
  dataEntrada?: string;
  dataTransacao?: string;
  tipoTransacao?: string;
  tipoOperacao?: string;
  valor?: string | number;
  titulo?: string;
  descricao?: string;
  detalhes?: string;
  codigoTransacao?: string;
  idTransacao?: string;
}

interface InterExtratoResponse {
  transacoes?: InterExtratoTransaction[];
  transactions?: InterExtratoTransaction[];
}

/**
 * Adapter real da API Banking PJ do Banco Inter.
 *
 * Fluxo: OAuth2 client_credentials (scope `extrato.read`) com mTLS →
 * GET /banking/v2/extrato?dataInicio&dataFim + header `x-conta-corrente`.
 */
export class InterApiAdapter implements FinancialAdapter {
  readonly source = "INTER_API" as const;

  private readonly clientId = process.env.INTER_CLIENT_ID;
  private readonly clientSecret = process.env.INTER_CLIENT_SECRET;
  private readonly certBase64 = process.env.INTER_CERT_BASE64;
  private readonly keyBase64 = process.env.INTER_KEY_BASE64;
  private readonly accountNumber = process.env.INTER_ACCOUNT_NUMBER;
  private readonly tokenUrl = process.env.INTER_TOKEN_URL ?? DEFAULT_TOKEN_URL;
  private readonly extratoUrl = process.env.INTER_EXTRATO_URL ?? DEFAULT_EXTRATO_URL;

  private cachedToken: { value: string; expiresAtMs: number } | null = null;

  private loadMtlsMaterial(): { cert: Buffer; key: Buffer } {
    if (!this.certBase64 || !this.keyBase64) {
      throw new Error(
        "INTER_CERT_BASE64/INTER_KEY_BASE64 não configurados. Consulte .env.example.",
      );
    }
    return {
      cert: Buffer.from(this.certBase64, "base64"),
      key: Buffer.from(this.keyBase64, "base64"),
    };
  }

  private createHttpsAgent(): https.Agent {
    const { cert, key } = this.loadMtlsMaterial();
    return new https.Agent({ cert, key, rejectUnauthorized: true, keepAlive: false });
  }

  parsePayload(data: unknown): unknown[] {
    if (!data || typeof data !== "object") return [];
    const payload = data as InterExtratoResponse;
    return payload.transacoes ?? payload.transactions ?? [];
  }

  normalize(raw: unknown): NormalizedTransaction {
    if (!raw || typeof raw !== "object") {
      throw new Error("InterApiAdapter.normalize: registro inválido.");
    }
    const row = raw as InterExtratoTransaction;

    const dateRaw = row.dataEntrada ?? row.dataTransacao;
    if (!dateRaw) {
      throw new Error("InterApiAdapter.normalize: dataEntrada/dataTransacao ausente.");
    }

    const absolute = new Decimal(String(row.valor ?? "0").replace(",", "."));
    if (!absolute.isFinite()) {
      throw new Error(`InterApiAdapter.normalize: valor inválido (${row.valor}).`);
    }

    const operation = (row.tipoOperacao ?? "").toUpperCase();
    const signedAmount =
      operation === "D" || operation === "DEBITO" || operation === "DEBIT"
        ? absolute.abs().negated()
        : absolute.abs();

    const originalDescription = (
      row.descricao ||
      row.titulo ||
      row.detalhes ||
      row.tipoTransacao ||
      "LANCAMENTO INTER"
    ).trim();

    return {
      date: parseInterDate(dateRaw),
      amount: signedAmount,
      description: normalizeDescription(originalDescription),
      originalDescription,
      fitId: row.codigoTransacao || row.idTransacao || undefined,
    };
  }

  private async fetchAccessToken(agent: https.Agent): Promise<string> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        "INTER_CLIENT_ID/INTER_CLIENT_SECRET não configurados. Consulte .env.example.",
      );
    }

    const now = Date.now();
    if (this.cachedToken && this.cachedToken.expiresAtMs > now + 30_000) {
      return this.cachedToken.value;
    }

    const body = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
      scope: "extrato.read",
    }).toString();

    const response = await requestJson<InterTokenResponse>(this.tokenUrl, {
      method: "POST",
      agent,
      headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body,
    });

    if (!response.access_token) {
      throw new Error("Resposta de token do Inter sem access_token.");
    }

    this.cachedToken = {
      value: response.access_token,
      expiresAtMs: now + (response.expires_in ?? 3600) * 1000,
    };
    return response.access_token;
  }

  async fetchTransactions(range: DateRange): Promise<NormalizedTransaction[]> {
    if (!this.accountNumber) {
      throw new Error(
        "INTER_ACCOUNT_NUMBER não configurado (conta corrente do header x-conta-corrente).",
      );
    }

    const agent = this.createHttpsAgent();
    try {
      const token = await this.fetchAccessToken(agent);
      const url = new URL(this.extratoUrl);
      url.searchParams.set("dataInicio", formatInterDate(range.from));
      url.searchParams.set("dataFim", formatInterDate(range.to));

      const payload = await requestJson<InterExtratoResponse>(url, {
        method: "GET",
        agent,
        headers: {
          Authorization: `Bearer ${token}`,
          "x-conta-corrente": this.accountNumber,
          Accept: "application/json",
        },
      });

      return this.parsePayload(payload).map((row) => this.normalize(row));
    } finally {
      agent.destroy();
    }
  }
}

function formatInterDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Aceita `YYYY-MM-DD` ou `DD/MM/YYYY`. */
function parseInterDate(raw: string): Date {
  const trimmed = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return new Date(`${trimmed.slice(0, 10)}T12:00:00.000Z`);
  }
  const br = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    return new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00.000Z`);
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`InterApiAdapter: data inválida (${raw}).`);
  }
  return parsed;
}

function requestJson<T>(
  url: string | URL,
  options: {
    method: string;
    agent: https.Agent;
    headers: Record<string, string>;
    body?: string;
  },
): Promise<T> {
  const target = typeof url === "string" ? new URL(url) : url;

  return new Promise<T>((resolve, reject) => {
    const request = https.request(
      target,
      {
        method: options.method,
        agent: options.agent,
        headers: {
          ...options.headers,
          ...(options.body ? { "Content-Length": Buffer.byteLength(options.body).toString() } : {}),
        },
      },
      (response) => {
        const chunks: Buffer[] = [];
        response.on("data", (chunk: Buffer) => chunks.push(chunk));
        response.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          const status = response.statusCode ?? 0;
          if (status < 200 || status >= 300) {
            reject(
              new Error(
                `Inter API ${options.method} ${target.pathname} falhou (${status}): ${text.slice(0, 300)}`,
              ),
            );
            return;
          }
          try {
            resolve((text ? JSON.parse(text) : {}) as T);
          } catch (error) {
            reject(
              new Error(
                `Inter API retornou JSON inválido: ${
                  error instanceof Error ? error.message : String(error)
                }`,
              ),
            );
          }
        });
      },
    );

    request.on("error", reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}
