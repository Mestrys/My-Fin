import { PrismaClient } from "@prisma/client";

/**
 * Singleton do PrismaClient.
 *
 * Em desenvolvimento, o Next.js recarrega módulos a cada mudança (HMR); para
 * evitar esgotar o pool de conexões do Postgres, guardamos a instância em
 * `globalThis` e a reaproveitamos entre reloads. Em produção (Netlify
 * Functions), cada cold start cria uma instância nova — por isso
 * `DATABASE_URL` deve sempre apontar para um endpoint com connection
 * pooling (veja .env.example).
 */

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__prisma = prisma;
}
