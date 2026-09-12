import type { DateRange, FinancialAdapter, NormalizedTransaction } from "./financial-adapter";

/**
 * Stub estruturado para a integração com a API do Banco Inter (Open
 * Finance / PJ), que exige autenticação mTLS (certificado de cliente).
 *
 * O certificado e a chave privada chegam via variáveis de ambiente em
 * Base64 (nunca em texto puro no repositório) e são decodificados sob
 * demanda apenas quando o adapter é efetivamente usado — evita custo de
 * I/O e falha de configuração em ambientes que não usam esta integração.
 *
 * `fetchTransactions` ainda não está implementado: chamar antes de
 * configurar as credenciais lança um erro explícito em vez de falhar
 * silenciosamente ou retornar dados vazios (o que mascararia a ausência de
 * integração real como "conta sem movimentação").
 */
export class InterApiAdapter implements FinancialAdapter {
  readonly source = "INTER_API" as const;

  private readonly clientId = process.env.INTER_CLIENT_ID;
  private readonly clientSecret = process.env.INTER_CLIENT_SECRET;
  private readonly certBase64 = process.env.INTER_CERT_BASE64;
  private readonly keyBase64 = process.env.INTER_KEY_BASE64;

  /** Decodifica cert/key para uso em um `https.Agent({ cert, key })` real. */
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

  parsePayload(data: unknown): unknown[] {
    if (!data || typeof data !== "object") return [];
    const payload = data as { transactions?: unknown[] };
    return payload.transactions ?? [];
  }

  normalize(): NormalizedTransaction {
    throw new Error(
      "InterApiAdapter.normalize: mapeamento do payload real da API do Inter " +
        "ainda não implementado (stub estrutural).",
    );
  }

  async fetchTransactions(range: DateRange): Promise<NormalizedTransaction[]> {
    if (!this.clientId || !this.clientSecret) {
      throw new Error(
        "INTER_CLIENT_ID/INTER_CLIENT_SECRET não configurados. Consulte .env.example.",
      );
    }
    // `range` será usado para paginar a chamada real (query params da API do
    // Inter) quando a integração for implementada.
    void range;
    this.loadMtlsMaterial();
    throw new Error(
      "InterApiAdapter.fetchTransactions: integração com a API do Inter ainda " +
        "não implementada (stub estrutural com mTLS pronto para a próxima fase).",
    );
  }
}
