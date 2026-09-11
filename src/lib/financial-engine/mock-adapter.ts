import Decimal from "decimal.js";
import type { DateRange, FinancialAdapter, NormalizedTransaction } from "./financial-adapter";
import { normalizeDescription } from "./reconciliation";

/**
 * Gerador estocástico (com seed determinística) de transações brasileiras
 * realistas: salário no 5º dia útil, assinaturas recorrentes, despesas
 * essenciais (mercado, contas) e compras parceladas no cartão de crédito.
 *
 * A "estocasticidade" é reprodutível: o mesmo `seed` sempre produz a mesma
 * sequência de transações, o que é essencial para que o seed do banco e os
 * testes sejam determinísticos.
 */

/** PRNG determinística (mulberry32) — evita `Math.random()` no seed. */
function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/** N-ésimo dia útil (1-based) de um mês, considerando apenas fins de semana. */
function nthBusinessDay(year: number, month: number, n: number): Date {
  const date = new Date(Date.UTC(year, month, 1));
  let count = 0;
  while (count < n) {
    if (!isWeekend(date)) count += 1;
    if (count < n) date.setUTCDate(date.getUTCDate() + 1);
  }
  return date;
}

const SUBSCRIPTIONS = [
  { name: "NETFLIX.COM", amount: "39.90", day: 10 },
  { name: "SPOTIFY PREMIUM", amount: "21.90", day: 15 },
  { name: "ACADEMIA SMARTFIT", amount: "129.90", day: 8 },
];

const ESSENTIAL_EXPENSES = [
  { name: "SUPERMERCADO PAO DE ACUCAR", min: 180, max: 420 },
  { name: "IFOOD *IFOOD", min: 25, max: 90 },
  { name: "POSTO IPIRANGA", min: 120, max: 260 },
  { name: "PIX ENVIADO CONDOMINIO", min: 450, max: 450 },
  { name: "CIA ENERGIA ELETRICA", min: 90, max: 220 },
  { name: "PIX ENVIADO CLARO NET", min: 99, max: 99 },
];

const INSTALLMENT_PURCHASES = [
  { name: "MAGAZINE LUIZA PARC 03/10", installments: 10, total: 1899.9 },
  { name: "LOJAS AMERICANAS PARC 02/06", installments: 6, total: 749.4 },
];

export class MockAdapter implements FinancialAdapter {
  readonly source = "MOCK" as const;

  constructor(private readonly seed = 42) {}

  parsePayload(data: unknown): unknown[] {
    return Array.isArray(data) ? data : [];
  }

  normalize(raw: unknown): NormalizedTransaction {
    return raw as NormalizedTransaction;
  }

  async fetchTransactions(range: DateRange): Promise<NormalizedTransaction[]> {
    const rng = createRng(this.seed);
    const randomBetween = (min: number, max: number) => min + rng() * (max - min);

    const transactions: NormalizedTransaction[] = [];
    // Contador determinístico: garante fitId único mesmo quando duas
    // ocorrências caem no mesmo dia com o mesmo valor arredondado.
    let sequence = 0;
    const cursor = new Date(Date.UTC(range.from.getUTCFullYear(), range.from.getUTCMonth(), 1));
    const monthsToGenerate = new Set<string>();

    // Coleta todos os meses cobertos pelo intervalo (para salário/assinaturas).
    const scan = new Date(cursor);
    while (scan <= range.to) {
      monthsToGenerate.add(`${scan.getUTCFullYear()}-${scan.getUTCMonth()}`);
      scan.setUTCMonth(scan.getUTCMonth() + 1);
    }

    for (const key of monthsToGenerate) {
      const [yearStr, monthStr] = key.split("-");
      const year = Number(yearStr);
      const month = Number(monthStr);

      // Salário no 5º dia útil do mês.
      const salaryDate = nthBusinessDay(year, month, 5);
      if (salaryDate >= range.from && salaryDate <= range.to) {
        transactions.push(
          buildTransaction(salaryDate, new Decimal("6850.00"), "PIX RECEBIDO EMPREGADOR LTDA", sequence++),
        );
      }

      // Assinaturas recorrentes.
      for (const sub of SUBSCRIPTIONS) {
        const date = new Date(Date.UTC(year, month, sub.day));
        if (date >= range.from && date <= range.to) {
          transactions.push(
            buildTransaction(date, new Decimal(sub.amount).negated(), sub.name, sequence++),
          );
        }
      }

      // Despesas essenciais espalhadas ao longo do mês (2-4 ocorrências por item).
      for (const expense of ESSENTIAL_EXPENSES) {
        const occurrences = 1 + Math.floor(rng() * 3);
        for (let i = 0; i < occurrences; i += 1) {
          const day = 1 + Math.floor(rng() * 27);
          const date = new Date(Date.UTC(year, month, day));
          if (date < range.from || date > range.to) continue;
          const amount = new Decimal(randomBetween(expense.min, expense.max).toFixed(2)).negated();
          transactions.push(buildTransaction(date, amount, expense.name, sequence++));
        }
      }
    }

    // Parcelamentos de cartão: parcela mensal fixa lançada todo mês do intervalo.
    for (const purchase of INSTALLMENT_PURCHASES) {
      const installmentAmount = new Decimal(purchase.total)
        .dividedBy(purchase.installments)
        .toDecimalPlaces(2)
        .negated();

      for (const key of monthsToGenerate) {
        const [yearStr, monthStr] = key.split("-");
        const date = new Date(Date.UTC(Number(yearStr), Number(monthStr), 20));
        if (date < range.from || date > range.to) continue;
        transactions.push(buildTransaction(date, installmentAmount, purchase.name, sequence++));
      }
    }

    return transactions.sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}

function buildTransaction(
  date: Date,
  amount: Decimal,
  originalDescription: string,
  sequence: number,
): NormalizedTransaction {
  return {
    date,
    amount,
    description: normalizeDescription(originalDescription),
    originalDescription,
    fitId: `MOCK-${date.toISOString().slice(0, 10)}-${sequence}`,
  };
}
