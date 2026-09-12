import { Wallet } from "lucide-react";
import { resolvePeriodRange } from "@/lib/period";
import { getDashboardData } from "@/lib/queries/dashboard";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { CategoryDonut } from "@/components/dashboard/category-donut";
import { EmptyState } from "@/components/dashboard/empty-state";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period } = await searchParams;
  const range = resolvePeriodRange(period);
  const data = await getDashboardData(range);

  if (!data.hasAnyTransaction) {
    return (
      <EmptyState
        icon={Wallet}
        title="Nenhuma transação ainda"
        description="Importe um extrato .ofx na tela de Extrato ou adicione uma transação manual pelo botão “Nova Transação”."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-on-surface">Dashboard</h1>
        <p className="text-sm text-on-surface-variant">{range.label}</p>
      </div>

      <KpiCards data={data} />
      <CashFlowChart data={data.dailyBalanceSeries} />
      <CategoryDonut data={data.categoryBreakdown} />
    </div>
  );
}
