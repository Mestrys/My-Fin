import crypto from "node:crypto";
import type Decimal from "decimal.js";
import { prisma } from "@/lib/prisma";
import type { NormalizedTransaction } from "./financial-adapter";

/** Maiúsculas, sem acentos, espaços colapsados — usado no hash e na exibição. */
export function normalizeDescription(description: string): string {
  return description
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

interface ReconciliationInput {
  accountId: string;
  date: Date;
  amount: Decimal;
  description: string;
  fitId?: string;
}

/**
 * Hash determinístico de deduplicação:
 * `SHA256(accountId + date[YYYY-MM-DD] + amount.toFixed(2) + descrição normalizada + fitId)`.
 *
 * Determinístico por construção: os mesmos dados de entrada sempre produzem
 * o mesmo hash, permitindo reexecutar uma importação (mesmo arquivo OFX,
 * mesma janela do Mock/Inter) sem criar duplicatas.
 */
export function computeReconciliationHash(input: ReconciliationInput): string {
  const normalizedDate = input.date.toISOString().slice(0, 10);
  const normalizedAmount = input.amount.toFixed(2);
  const normalizedDescription = normalizeDescription(input.description);
  const raw = `${input.accountId}${normalizedDate}${normalizedAmount}${normalizedDescription}${input.fitId ?? ""}`;
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export interface HashedTransaction extends NormalizedTransaction {
  accountId: string;
  reconciliationHash: string;
}

export function hashTransactions(
  accountId: string,
  transactions: NormalizedTransaction[],
): HashedTransaction[] {
  return transactions.map((transaction) => ({
    ...transaction,
    accountId,
    reconciliationHash: computeReconciliationHash({
      accountId,
      date: transaction.date,
      amount: transaction.amount,
      description: transaction.description,
      fitId: transaction.fitId,
    }),
  }));
}

/**
 * Separa um lote de transações já hasheadas entre inéditas (a inserir) e
 * duplicadas (já existentes no banco pelo `reconciliationHash`) — é isso
 * que garante que reimportar o mesmo OFX, ou rodar o seed duas vezes, seja
 * idempotente: nada é inserido duas vezes, nada falha por causa disso.
 */
export async function partitionByExistingHash(
  transactions: HashedTransaction[],
): Promise<{ toInsert: HashedTransaction[]; duplicates: HashedTransaction[] }> {
  if (transactions.length === 0) return { toInsert: [], duplicates: [] };

  const existing = await prisma.transaction.findMany({
    where: { reconciliationHash: { in: transactions.map((t) => t.reconciliationHash) } },
    select: { reconciliationHash: true },
  });
  const existingHashes = new Set(existing.map((row) => row.reconciliationHash));

  const toInsert: HashedTransaction[] = [];
  const duplicates: HashedTransaction[] = [];
  // Também deduplica hashes repetidos dentro do próprio lote (mesmo arquivo
  // OFX com linhas idênticas), senão o createMany estoura no índice único.
  const seenInBatch = new Set<string>();
  for (const transaction of transactions) {
    if (
      existingHashes.has(transaction.reconciliationHash) ||
      seenInBatch.has(transaction.reconciliationHash)
    ) {
      duplicates.push(transaction);
      continue;
    }
    seenInBatch.add(transaction.reconciliationHash);
    toInsert.push(transaction);
  }
  return { toInsert, duplicates };
}
