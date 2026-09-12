import type { Prisma, TransactionType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export interface TransactionFilters {
  page: number;
  pageSize: number;
  accountId?: string;
  categoryId?: string;
  type?: TransactionType;
  search?: string;
  sortBy: "date" | "amount" | "description";
  sortDir: "asc" | "desc";
}

export async function listTransactions(filters: TransactionFilters) {
  const where: Prisma.TransactionWhereInput = {
    ...(filters.accountId ? { accountId: filters.accountId } : {}),
    ...(filters.categoryId
      ? filters.categoryId === "uncategorized"
        ? { categoryId: null }
        : { categoryId: filters.categoryId }
      : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.search
      ? { description: { contains: filters.search, mode: "insensitive" as const } }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        account: { select: { id: true, name: true, type: true } },
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: { [filters.sortBy]: filters.sortDir },
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.transaction.count({ where }),
  ]);

  return { rows, total, pageCount: Math.max(1, Math.ceil(total / filters.pageSize)) };
}
