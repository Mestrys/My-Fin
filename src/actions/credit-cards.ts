"use server";

import { randomUUID } from "node:crypto";
import Decimal from "decimal.js";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import type { Prisma, Transaction } from "@prisma/client";
import { decimalToDb, moneySchema, toDecimal } from "@/lib/money";
import { computeReconciliationHash } from "@/lib/financial-engine/reconciliation";
import { revalidateDashboard } from "@/lib/revalidate";

type TxClient = Prisma.TransactionClient;

/** Convenção de ciclo de fatura: fecha no dia 25, vence no dia 5 do mês seguinte. */
const CLOSING_DAY = 25;
const DUE_DAY = 5;

function invoiceWindowForMonth(year: number, monthIndex: number): { closingDate: Date; dueDate: Date } {
  const closingDate = new Date(Date.UTC(year, monthIndex, CLOSING_DAY));
  const dueDate = new Date(Date.UTC(year, monthIndex + 1, DUE_DAY));
  return { closingDate, dueDate };
}

/** Em qual mês de fatura uma compra feita em `date` cai, deslocada `monthsAhead` parcelas à frente. */
function invoiceWindowForPurchase(date: Date, monthsAhead: number) {
  const rolledPastClosing = date.getUTCDate() > CLOSING_DAY ? 1 : 0;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + rolledPastClosing + monthsAhead;
  return invoiceWindowForMonth(year, month);
}

async function getOrCreateInvoice(tx: TxClient, accountId: string, closingDate: Date, dueDate: Date) {
  return tx.creditCardInvoice.upsert({
    where: { accountId_closingDate: { accountId, closingDate } },
    create: { accountId, closingDate, dueDate, totalAmount: "0.00", status: "OPEN" },
    update: {},
  });
}

/**
 * Soma `amount` ao total da fatura somente se ela ainda não foi paga. O
 * `UPDATE ... WHERE status <> 'PAID'` trava a linha e reavalia o status
 * depois de qualquer pagamento concorrente, então nunca soma valor numa
 * fatura liquidada (valor que nunca seria cobrado).
 */
async function addToOpenInvoice(tx: TxClient, invoiceId: string, amount: Decimal): Promise<boolean> {
  const { count } = await tx.creditCardInvoice.updateMany({
    where: { id: invoiceId, status: { not: "PAID" } },
    data: { totalAmount: { increment: decimalToDb(amount) } },
  });
  return count === 1;
}

const createInstallmentPurchaseSchema = z.object({
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  totalAmount: moneySchema,
  description: z.string().trim().min(1),
  date: z.coerce.date(),
  totalInstallments: z.number().int().min(1).max(48),
});

export type CreateInstallmentPurchaseInput = z.input<typeof createInstallmentPurchaseSchema>;

/**
 * Lança uma compra parcelada no cartão: gera as N transações filhas
 * (parcela 1/N .. N/N), cada uma vinculada à fatura (`CreditCardInvoice`)
 * em que efetivamente vai cair — a 1ª pode já estourar o fechamento do
 * mês corrente e cair na fatura seguinte, e cada parcela subsequente avança
 * exatamente uma fatura. O valor total é distribuído em parcelas iguais,
 * com o resto de arredondamento absorvido pela última parcela (nunca a
 * primeira — evita cobrar o cliente "adiantado").
 */
export async function createInstallmentPurchase(input: CreateInstallmentPurchaseInput) {
  const parsed = createInstallmentPurchaseSchema.parse(input);

  const baseInstallment = parsed.totalAmount
    .dividedBy(parsed.totalInstallments)
    .toDecimalPlaces(2, Decimal.ROUND_DOWN);
  const remainder = parsed.totalAmount.minus(baseInstallment.times(parsed.totalInstallments));

  const created = await prisma.$transaction(async (tx) => {
    let parentId: string | null = null;
    const installmentTransactions: Transaction[] = [];
    // Faturas já pagas são puladas: a parcela (e as seguintes) vai para a
    // próxima fatura aberta.
    let monthOffset = 0;

    for (let i = 0; i < parsed.totalInstallments; i += 1) {
      const isLast = i === parsed.totalInstallments - 1;
      const installmentAmount = isLast ? baseInstallment.plus(remainder) : baseInstallment;

      let invoiceWindow = invoiceWindowForPurchase(parsed.date, i + monthOffset);
      let invoice = await getOrCreateInvoice(tx, parsed.accountId, invoiceWindow.closingDate, invoiceWindow.dueDate);
      while (!(await addToOpenInvoice(tx, invoice.id, installmentAmount))) {
        monthOffset += 1;
        invoiceWindow = invoiceWindowForPurchase(parsed.date, i + monthOffset);
        invoice = await getOrCreateInvoice(tx, parsed.accountId, invoiceWindow.closingDate, invoiceWindow.dueDate);
      }
      const { closingDate } = invoiceWindow;

      const installmentTransaction: Transaction = await tx.transaction.create({
        data: {
          accountId: parsed.accountId,
          categoryId: parsed.categoryId ?? null,
          amount: decimalToDb(installmentAmount.negated()),
          type: "EXPENSE",
          description: `${parsed.description} (${i + 1}/${parsed.totalInstallments})`,
          originalDescription: parsed.description,
          date: closingDate,
          isPaid: false,
          isReconciled: false,
          installmentNumber: i + 1,
          totalInstallments: parsed.totalInstallments,
          parentTransactionId: parentId,
          creditCardInvoiceId: invoice.id,
          reconciliationHash: computeReconciliationHash({
            accountId: parsed.accountId,
            date: closingDate,
            amount: installmentAmount.negated(),
            description: `${parsed.description} ${i + 1}/${parsed.totalInstallments}`,
            fitId: randomUUID(),
          }),
        },
      });

      if (i === 0) parentId = installmentTransaction.id;
      installmentTransactions.push(installmentTransaction);

      // Débito integral reconhecido no ato da compra (convenção adotada:
      // `currentBalance` de uma conta CREDIT_CARD é o total já comprometido
      // em faturas presentes e futuras, não apenas o já vencido).
      await tx.account.update({
        where: { id: parsed.accountId },
        data: { currentBalance: { decrement: decimalToDb(installmentAmount) } },
      });
    }

    return installmentTransactions;
  });

  revalidateDashboard();
  return created;
}

const settleInvoiceSchema = z.object({
  invoiceId: z.string().uuid(),
  payingAccountId: z.string().uuid(),
  paymentDate: z.coerce.date(),
});

export type SettleInvoiceInput = z.input<typeof settleInvoiceSchema>;

/**
 * Liquida uma fatura: debita o valor total da conta pagadora (conta
 * corrente), reduz o saldo comprometido do cartão (restaurando patrimônio
 * líquido) e fecha a fatura como PAID. Usa o tipo ADJUSTMENT — não
 * EXPENSE — porque a despesa já foi reconhecida no somatório mensal no
 * momento de cada compra parcelada; contá-la de novo aqui duplicaria o
 * gasto no relatório de fluxo de caixa.
 */
export async function settleInvoice(input: SettleInvoiceInput) {
  const parsed = settleInvoiceSchema.parse(input);

  const settlement = await prisma.$transaction(async (tx) => {
    // Reivindica a fatura antes de qualquer outra coisa: o UPDATE condicional
    // trava a linha, e um segundo pagamento simultâneo espera este terminar e
    // então não encontra mais a fatura em aberto (count 0). Ler o status e
    // decidir depois deixava os dois passarem e debitava a conta em dobro.
    // Se algo abaixo falhar, o rollback devolve o status anterior.
    const claimed = await tx.creditCardInvoice.updateMany({
      where: { id: parsed.invoiceId, status: { not: "PAID" } },
      data: { status: "PAID" },
    });
    const invoice = await tx.creditCardInvoice.findUniqueOrThrow({ where: { id: parsed.invoiceId } });
    if (claimed.count !== 1) {
      throw new Error("Esta fatura já está liquidada.");
    }
    if (parsed.payingAccountId === invoice.accountId) {
      throw new Error("A conta pagadora deve ser diferente do cartão da fatura.");
    }

    const payer = await tx.account.findUniqueOrThrow({ where: { id: parsed.payingAccountId } });
    if (!payer.isActive) {
      throw new Error("A conta pagadora está inativa.");
    }
    if (payer.type === "CREDIT_CARD") {
      throw new Error("A conta pagadora não pode ser um cartão de crédito.");
    }

    const totalAmount = toDecimal(invoice.totalAmount.toString());

    const settlementTransaction = await tx.transaction.create({
      data: {
        accountId: parsed.payingAccountId,
        amount: decimalToDb(totalAmount.negated()),
        type: "ADJUSTMENT",
        description: "Pagamento de fatura de cartão de crédito",
        originalDescription: `Pagamento fatura ${invoice.id}`,
        date: parsed.paymentDate,
        isPaid: true,
        isReconciled: true,
        reconciliationHash: computeReconciliationHash({
          accountId: parsed.payingAccountId,
          date: parsed.paymentDate,
          amount: totalAmount.negated(),
          description: `Pagamento fatura ${invoice.id}`,
          fitId: randomUUID(),
        }),
      },
    });

    // Caixa ↓ e dívida do cartão ↑ (currentBalance menos negativo): patrimônio
    // líquido permanece estável.
    await tx.account.update({
      where: { id: parsed.payingAccountId },
      data: { currentBalance: { decrement: decimalToDb(totalAmount) } },
    });
    await tx.account.update({
      where: { id: invoice.accountId },
      data: { currentBalance: { increment: decimalToDb(totalAmount) } },
    });

    await tx.transaction.updateMany({
      where: { creditCardInvoiceId: invoice.id },
      data: { isPaid: true },
    });

    await tx.creditCardInvoice.update({
      where: { id: invoice.id },
      data: { settlementTransactionId: settlementTransaction.id },
    });

    return settlementTransaction;
  });

  revalidateDashboard();
  return settlement;
}
