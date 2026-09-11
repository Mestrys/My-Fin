import Decimal from "decimal.js";
import { z } from "zod";

export function toDecimal(value: string | number | Decimal): Decimal {
  return value instanceof Decimal ? value : new Decimal(value);
}

/**
 * Contrato Zod para valores monetários recebidos em Server Actions
 * (string vinda de `<input>`/FormData ou number vindo de um payload JSON).
 * Nunca aceita o valor cru como `number` para cálculo — a saída é sempre
 * um `Decimal`, e a validação já rejeita entradas não numéricas aqui na
 * borda, antes de qualquer lógica de negócio.
 */
export const moneySchema = z.union([z.string(), z.number()]).transform((value, ctx) => {
  try {
    const decimal = new Decimal(value);
    if (!decimal.isFinite()) throw new Error("not finite");
    return decimal;
  } catch {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Valor monetário inválido." });
    return z.NEVER;
  }
});

/** Serializa um Decimal para o formato que o Prisma espera em campos Decimal. */
export function decimalToDb(value: Decimal): string {
  return value.toFixed(2);
}
