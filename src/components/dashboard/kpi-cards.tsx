import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Money } from "@/components/money";
import { formatPercent } from "@/lib/format";
import { Sparkline } from "@/components/dashboard/sparkline";
import type { DashboardData } from "@/lib/queries/dashboard";

export function KpiCards({ data }: { data: DashboardData }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-on-surface-variant">
            Patrimônio Líquido
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Money value={data.netWorth} tone="neutral" showSign={false} className="text-2xl" />
          <Sparkline data={data.netWorthSparkline} tone={data.netWorth >= 0 ? "income" : "expense"} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-on-surface-variant">
            Entradas vs. Saídas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-on-surface-variant">Entradas</span>
            <Money value={data.income} tone="income" className="text-lg" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-on-surface-variant">Saídas</span>
            <Money value={data.expense} tone="expense" showSign={false} className="text-lg" />
          </div>
          <div className="flex items-baseline justify-between border-t border-outline-variant pt-2">
            <span className="text-xs text-on-surface-variant">Taxa de poupança</span>
            <span className="tabular-nums text-sm font-semibold text-on-surface">
              {data.savingsRatePct === null ? "—" : formatPercent(data.savingsRatePct)}
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-on-surface-variant">
            Burn Rate Diário
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Money value={-data.dailyBurnRate} tone="expense" showSign={false} className="text-2xl" />
          <p className="text-xs text-on-surface-variant">Média de gasto por dia no período selecionado.</p>
        </CardContent>
      </Card>
    </div>
  );
}
