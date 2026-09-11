import { PiggyBank } from "lucide-react";
import { getBudgetViews } from "@/lib/queries/budgets";
import { BudgetCard } from "@/components/budgets/budget-card";
import { EmptyState } from "@/components/dashboard/empty-state";

export default async function BudgetsPage() {
  const budgets = await getBudgetViews();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-on-surface">Orçamentos Mensais</h1>
        <p className="text-sm text-on-surface-variant">Gasto real vs. teto planejado no mês corrente.</p>
      </div>

      {budgets.length === 0 ? (
        <EmptyState
          icon={PiggyBank}
          title="Nenhum orçamento definido"
          description="Defina um teto (budgetLimit) em uma categoria de despesa para acompanhar o ritmo de gasto aqui."
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {budgets.map((budget) => (
            <BudgetCard key={budget.id} budget={budget} />
          ))}
        </div>
      )}
    </div>
  );
}
