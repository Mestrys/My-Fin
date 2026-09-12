"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { toDecimal } from "@/lib/money";
import { InterApiAdapter } from "@/lib/financial-engine/inter-api-adapter";
import { hashTransactions, partitionByExistingHash } from "@/lib/financial-engine/reconciliation";
import { revalidateDashboard } from "@/lib/revalidate";

const importInterSchema = z.object({
  accountId: z.string().uuid(),
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export type ImportInterInput = z.input<typeof importInterSchema>;

export interface ImportInterResult {
  recordsProcessed: number;
  recordsInserted: number;
  recordsSkipped: number;
  syncLogId: string;
}

/**
 * Sincroniza o extrato Banking PJ do Banco Inter para uma conta local,
 * reutilizando o mesmo pipeline de hash/dedupe do OFX.
 */
export async function importInter(input: ImportInterInput): Promise<ImportInterResult> {
  const parsed = importInterSchema.parse(input);
  if (parsed.from > parsed.to) {
    throw new Error("A data inicial deve ser anterior ou igual à data final.");
  }

  const syncLog = await prisma.syncLog.create({
    data: { provider: "INTER_API", status: "RUNNING" },
  });

  try {
    const adapter = new InterApiAdapter();
    const normalized = await adapter.fetchTransactions({ from: parsed.from, to: parsed.to });

    if (normalized.length === 0) {
      await prisma.syncLog.update({
        where: { id: syncLog.id },
        data: { status: "SUCCESS", recordsProcessed: 0, finishedAt: new Date() },
      });
      return {
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsSkipped: 0,
        syncLogId: syncLog.id,
      };
    }

    const hashed = hashTransactions(parsed.accountId, normalized);
    const { toInsert, duplicates } = await partitionByExistingHash(hashed);

    if (toInsert.length > 0) {
      await prisma.$transaction(async (tx) => {
        await tx.transaction.createMany({
          data: toInsert.map((t) => ({
            accountId: parsed.accountId,
            amount: t.amount.toFixed(2),
            type: t.amount.isNegative() ? "EXPENSE" : "INCOME",
            description: t.description,
            originalDescription: t.originalDescription,
            date: t.date,
            isPaid: true,
            isReconciled: false,
            reconciliationHash: t.reconciliationHash,
            syncLogId: syncLog.id,
          })),
        });

        const totalInserted = toInsert.reduce((sum, t) => sum.plus(t.amount), toDecimal(0));
        await tx.account.update({
          where: { id: parsed.accountId },
          data: { currentBalance: { increment: totalInserted.toFixed(2) } },
        });
      });
    }

    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "SUCCESS",
        recordsProcessed: normalized.length,
        recordsInserted: toInsert.length,
        recordsSkipped: duplicates.length,
        finishedAt: new Date(),
      },
    });

    revalidateDashboard();

    return {
      recordsProcessed: normalized.length,
      recordsInserted: toInsert.length,
      recordsSkipped: duplicates.length,
      syncLogId: syncLog.id,
    };
  } catch (error) {
    await prisma.syncLog.update({
      where: { id: syncLog.id },
      data: {
        status: "FAILED",
        errorDetails: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}
