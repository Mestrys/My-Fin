"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatBRL, formatPercent } from "@/lib/format";
import type { DashboardData } from "@/lib/queries/dashboard";

export function CategoryDonut({ data }: { data: DashboardData["categoryBreakdown"] }) {
  const total = data.reduce((sum, item) => sum + item.total, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-on-surface-variant">
          Gastos por Categoria
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="py-10 text-center text-sm text-on-surface-variant">
            Nenhuma despesa categorizada no período.
          </p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-52 w-full sm:w-52 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data}
                    dataKey="total"
                    nameKey="name"
                    innerRadius="60%"
                    outerRadius="90%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {data.map((entry) => (
                      <Cell key={entry.id} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatBRL(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>

            <ul className="w-full min-w-0 flex-1 space-y-2">
              {data.slice(0, 8).map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="size-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                      aria-hidden
                    />
                    <span className="truncate text-on-surface">{item.name}</span>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 tabular-nums">
                    <span className="text-on-surface-variant">
                      {formatPercent(total > 0 ? item.total / total : 0, 0)}
                    </span>
                    <span className="font-medium text-on-surface">{formatBRL(item.total)}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
