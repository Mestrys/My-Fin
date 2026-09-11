import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Singleton do PrismaClient.
 *
 * O Prisma 7 exige um "driver adapter" explícito (arquitetura sem
 * `url` embutida no schema.prisma). Usamos `@prisma/adapter-pg` sobre o
 * driver `pg`, compatível com Postgres nativo, Supabase e Neon (pooling via
 * connection string, sem custo de infraestrutura adicional).
 *
 * Em desenvolvimento, o Next.js recarrega módulos a cada mudança (HMR); para
 * evitar esgotar o pool de conexões do Postgres, guardamos a instância em
 * `globalThis` e a reaproveitamos entre reloads.
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não definida. Configure-a em .env (veja .env.example).",
    );
  }

  const adapter = new PrismaPg({ connectionString });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

export const prisma = globalThis.__prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
