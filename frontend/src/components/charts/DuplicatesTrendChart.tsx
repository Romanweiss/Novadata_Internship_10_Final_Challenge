import { animate, motion } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DuplicateTrendPoint } from '../../types/ui';

interface DuplicatesTrendChartProps {
  data: DuplicateTrendPoint[];
}

function interpolateRatio(points: Array<{ idx: number; ratio: number }>, value: number) {
  if (!points.length) {
    return null;
  }

  if (value <= points[0].idx) {
    return points[0].ratio;
  }

  const last = points[points.length - 1];
  if (value >= last.idx) {
    return last.ratio;
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];

    if (value >= current.idx && value <= next.idx) {
      const span = next.idx - current.idx;
      const ratio = span === 0 ? 0 : (value - current.idx) / span;
      return current.ratio + ratio * (next.ratio - current.ratio);
    }
  }

  return points[0].ratio;
}

export function DuplicatesTrendChart({ data }: DuplicatesTrendChartProps) {
  const chartData = useMemo(() => data.map((item, idx) => ({ ...item, idx })), [data]);
  const maxIndex = chartData.length ? chartData[chartData.length - 1].idx : 0;

  const [dotX, setDotX] = useState(maxIndex);

  useEffect(() => {
    setDotX(maxIndex);
    const controls = animate(maxIndex, 0, {
      duration: 2.6,
      ease: 'easeInOut',
      onUpdate: (value) => setDotX(value),
    });

    return () => controls.stop();
  }, [maxIndex]);

  const dotY = useMemo(
    () => interpolateRatio(chartData.map((item) => ({ idx: item.idx, ratio: item.ratio })), dotX),
    [chartData, dotX],
  );

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={chartData} margin={{ top: 20, right: 22, left: 6, bottom: 8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 7" vertical={false} />

        <XAxis
          dataKey="idx"
          type="number"
          domain={[0, maxIndex]}
          ticks={chartData.map((point) => point.idx)}
          tickFormatter={(value) => chartData[value]?.run ?? ''}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />

        <YAxis
          domain={[0, 10]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          width={44}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          formatter={(value) => [`Ratio : ${Number(value || 0).toFixed(1)}%`, '']}
          labelFormatter={(value) => chartData[Math.round(Number(value || 0))]?.run ?? ''}
          contentStyle={{
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 12px 24px -18px rgba(15, 23, 42, 0.65)',
          }}
          itemStyle={{ color: 'var(--text)' }}
          labelStyle={{ color: 'var(--text-muted)', fontWeight: 600 }}
        />

        <Line
          type="monotone"
          dataKey="ratio"
          stroke="#111827"
          strokeWidth={2.8}
          animationDuration={1700}
          animationEasing="ease-in-out"
          dot={(props) => {
            const { key, cx, cy, index } = props;
            if (typeof cx !== 'number' || typeof cy !== 'number') {
              return null;
            }

            return (
              <motion.circle
                key={key}
                cx={cx}
                cy={cy}
                r={4}
                fill="var(--surface)"
                stroke="#111827"
                strokeWidth={2}
                initial={{ opacity: 0, scale: 0.55 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.13 + Number(index || 0) * 0.09, duration: 0.22 }}
              />
            );
          }}
          activeDot={{ r: 5 }}
        />

        {dotY !== null && <ReferenceDot x={dotX} y={dotY} r={5} fill="#111827" stroke="white" strokeWidth={1.8} />}
      </LineChart>
    </ResponsiveContainer>
  );
}
