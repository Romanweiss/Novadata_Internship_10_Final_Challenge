import { animate, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

import type { PaymentBreakdownItem } from '../../types/ui';

interface PaymentDonutChartProps {
  data: PaymentBreakdownItem[];
}

export function PaymentDonutChart({ data }: PaymentDonutChartProps) {
  const [endAngle, setEndAngle] = useState(90);

  const chartData = useMemo(
    () => data.map((item) => ({ ...item, pieValue: item.count > 0 ? item.count : item.value })),
    [data],
  );

  useEffect(() => {
    setEndAngle(90);
    const controls = animate(90, 450, {
      duration: 1.4,
      ease: 'easeOut',
      onUpdate: (value) => setEndAngle(value),
    });

    return () => {
      controls.stop();
    };
  }, [chartData]);

  if (!chartData.length) {
    return <p className="px-1 text-sm text-[var(--text-muted)]">No payment data.</p>;
  }

  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[1fr_220px]">
      <div className="h-[210px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              dataKey="pieValue"
              nameKey="method"
              innerRadius={58}
              outerRadius={84}
              startAngle={90}
              endAngle={endAngle}
              stroke="var(--surface)"
              strokeWidth={4}
              paddingAngle={1.1}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell key={entry.id} fill={entry.color} />
              ))}
            </Pie>

            <Tooltip
              formatter={(value, _name, item) => {
                const payload = item.payload as PaymentBreakdownItem;
                return [`${Number(value).toLocaleString()} purchases (${payload.value}%)`, payload.method];
              }}
              contentStyle={{
                borderRadius: 14,
                border: '1px solid var(--border)',
                background: 'var(--surface)',
                boxShadow: '0 12px 24px -18px rgba(15, 23, 42, 0.65)',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>

      <ul className="space-y-3">
        {chartData.map((item, index) => (
          <motion.li
            key={item.id}
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + index * 0.08, duration: 0.24 }}
            className="flex items-center justify-between text-sm"
          >
            <span className="inline-flex items-center gap-2 text-[var(--text)]">
              <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
              {item.method}
            </span>
            <span className="font-bold text-[var(--text)]">{item.value}% ({item.count.toLocaleString()})</span>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
