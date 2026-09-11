# My-Fin

Personal Financial Management (PFM) avançado: arquitetura modular, tipagem
estrita e padrões contábeis formais (partidas dobradas, imutabilidade de
lançamentos, deduplicação determinística por hash).

## Stack (zero cost em produção)

| Camada       | Tecnologia                                             |
| ------------ | ------------------------------------------------------- |
| Framework    | Next.js 16 (App Router, Server Actions, TS strict)       |
| UI           | Tailwind CSS v4 + shadcn/ui + Lucide Icons               |
| Banco        | PostgreSQL (compatível com Supabase / Neon)              |
| ORM          | Prisma 7 (driver adapter `@prisma/adapter-pg`)           |
| Dinheiro     | `decimal.js` — nunca `Float`/`Number` para valores monetários |
| Validação    | Zod (contratos de entrada/saída das Server Actions)      |

## Status do desenvolvimento (execução faseada)

- [x] **Fase 1 — Scaffolding e Schema**: projeto, dependências e
      `prisma/schema.prisma` com migração inicial aplicada.
- [ ] **Fase 2 — Motor Contábil e Ingestão**: adapters (OFX, Mock, Inter API),
      engine de deduplicação por hash e seed de 90 dias.
- [ ] **Fase 3 — Server Actions e Regras de Negócio**: mutações com Zod,
      transferências atômicas, liquidação de faturas, saldo projetado.
- [ ] **Fase 4 — Dashboard e Telas**: cards de balanço/burn rate, tabela de
      transações, upload de OFX, gráficos (Recharts).

## Rodando localmente

Pré-requisitos: Node 20+, PostgreSQL 14+.

```bash
npm install                 # instala dependências (gera o Prisma Client via postinstall)
cp .env.example .env        # ajuste DATABASE_URL para o seu Postgres local
npx prisma migrate dev      # aplica as migrações
npm run dev                 # http://localhost:3000
```

### Scripts úteis

```bash
npm run build       # build de produção (Next.js)
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
npm run db:studio    # Prisma Studio (inspeção visual do banco)
npm run db:seed      # seed de dados de teste (disponível a partir da Fase 2)
```

## Modelagem de dados

O schema (`prisma/schema.prisma`) implementa:

- **Account**: contas com saldo inicial/corrente em `Decimal(18,4)`.
- **Transaction**: lançamentos assinados (positivo = crédito, negativo =
  débito), com `reconciliationHash` único para deduplicação de ingestão,
  suporte a parcelamento (auto-relação `parentTransactionId`) e vínculo
  opcional a fatura de cartão de crédito.
- **Category**: hierárquica (auto-relação `parentId`), com limite
  orçamentário opcional.
- **CreditCardInvoice**: ciclo de fatura (fechamento/vencimento/status) com
  vínculo à transação de liquidação.
- **IngestionLog**: auditoria de cada rodada de importação (fonte, status,
  registros processados, erros).

Todos os IDs de conta/categoria/transação usam nomes de coluna em
`snake_case` (`account_id`, `category_id`, ...) via `@map`, mantendo o banco
consistente independentemente da convenção `camelCase` do lado TypeScript.
