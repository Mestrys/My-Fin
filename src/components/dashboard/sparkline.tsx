"use client";

import { Area, AreaChart, ResponsiveContainer } from "recharts";

/** Mini gráfico de tendência sem eixos, usado dentro de cards de KPI. */
export function Sparkline({ data, tone = "income" }: { data: number[]; tone?: "income" | "expense" }) {
  const chartData = data.map((value, index) => ({ index, value }));
  const color = tone === "income" ? "var(--color-income)" : "var(--color-expense)";
  const gradientId = `sparkline-${tone}`;

  return (
    <div className="h-12 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.35} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
