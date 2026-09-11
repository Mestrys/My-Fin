import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// Dados financeiros nunca devem ser servidos de um cache estático de build.
export const dynamic = "force-dynamic";

/**
 * Fase 1 — smoke test de infraestrutura.
 *
 * Confirma, em tempo de request (server component), que o schema.prisma
 * compila, o client gerado conecta via driver adapter (pg) e as tabelas
 * de domínio existem no Postgres. As telas reais do dashboard chegam na
 * Fase 4.
 */
export default async function Home() {
  const [accountCount, categoryCount, transactionCount] = await Promise.all([
    prisma.account.count(),
    prisma.category.count(),
    prisma.transaction.count(),
  ]);

  const checks = [
    { label: "Prisma Client", detail: "gerado a partir de prisma/schema.prisma" },
    { label: "Driver Adapter", detail: "@prisma/adapter-pg → PostgreSQL" },
    { label: "Accounts", detail: `${accountCount} registro(s)` },
    { label: "Categories", detail: `${categoryCount} registro(s)` },
    { label: "Transactions", detail: `${transactionCount} registro(s)` },
  ];

  return (
    <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6 py-16">
      <div className="space-y-1">
        <Badge variant="secondary">Fase 1 — Scaffolding e Schema</Badge>
        <h1 className="text-2xl font-semibold tracking-tight">My-Fin</h1>
        <p className="text-muted-foreground text-sm">
          Personal Financial Management — infraestrutura provisionada e
          conectada ao Postgres.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status da infraestrutura</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checks.map((check) => (
            <div
              key={check.label}
              className="flex items-center justify-between border-b pb-2 last:border-0 last:pb-0"
            >
              <span className="text-sm font-medium">{check.label}</span>
              <span className="text-muted-foreground text-sm">{check.detail}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
