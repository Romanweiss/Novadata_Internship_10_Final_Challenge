import { animate } from 'framer-motion';
import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { IngestionPoint } from '../../types/ui';

interface IngestionAreaChartProps {
  data: IngestionPoint[];
}

function formatRows(value: number) {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  return `${Math.round(value / 1000)}k`;
}

function interpolatePoint(points: Array<{ index: number; rows: number }>, value: number) {
  if (!points.length) {
    return null;
  }

  if (value <= points[0].index) {
    return points[0];
  }

  const last = points[points.length - 1];
  if (value >= last.index) {
    return last;
  }

  for (let i = 0; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    if (value >= current.index && value <= next.index) {
      const span = next.index - current.index;
      const ratio = span === 0 ? 0 : (value - current.index) / span;
      return {
        index: value,
        rows: current.rows + ratio * (next.rows - current.rows),
      };
    }
  }

  return points[0];
}

export function IngestionAreaChart({ data }: IngestionAreaChartProps) {
  const chartData = useMemo(
    () => data.map((point, idx) => ({ ...point, index: idx })),
    [data],
  );

  const maxIndex = chartData.length ? chartData[chartData.length - 1].index : 0;
  const [dotX, setDotX] = useState(0);

  useEffect(() => {
    setDotX(0);
    const controls = animate(0, maxIndex, {
      duration: 2.8,
      ease: 'easeInOut',
      onUpdate: (latest) => setDotX(latest),
    });

    return () => {
      controls.stop();
    };
  }, [maxIndex]);

  const interpolated = useMemo(
    () => interpolatePoint(chartData.map((entry) => ({ index: entry.index, rows: entry.rows })), dotX),
    [chartData, dotX],
  );

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 20, right: 18, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id="ingestionGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6b7280" stopOpacity={0.42} />
            <stop offset="95%" stopColor="#6b7280" stopOpacity={0.03} />
          </linearGradient>
        </defs>

        <CartesianGrid stroke="var(--border)" strokeDasharray="3 8" vertical={false} />

        <XAxis
          dataKey="index"
          type="number"
          domain={[0, maxIndex]}
          ticks={chartData.map((point) => point.index)}
          tickFormatter={(value) => chartData[value]?.day ?? ''}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={(value: number) => formatRows(value)}
          tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
          width={54}
          axisLine={false}
          tickLine={false}
        />

        <Tooltip
          cursor={{ stroke: 'var(--border-strong)' }}
          formatter={(value) => [`rows : ${Math.round(Number(value || 0)).toLocaleString()}`, '']}
          labelFormatter={(value) => chartData[Math.round(Number(value || 0))]?.day ?? ''}
          contentStyle={{
            borderRadius: 14,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            boxShadow: '0 12px 24px -18px rgba(15, 23, 42, 0.65)',
          }}
          itemStyle={{ color: 'var(--text)' }}
          labelStyle={{ color: 'var(--text-muted)', fontWeight: 600 }}
        />

        <Area
          type="monotone"
          dataKey="rows"
          stroke="#111827"
          strokeWidth={2.8}
          fill="url(#ingestionGradient)"
          animationDuration={1600}
          animationEasing="ease-in-out"
          dot={false}
          activeDot={{ r: 4, fill: '#111827', stroke: 'white', strokeWidth: 1.5 }}
        />

        {interpolated && (
          <ReferenceDot x={dotX} y={interpolated.rows} r={5} fill="#111827" stroke="white" strokeWidth={1.8} />
        )}
      </AreaChart>
    </ResponsiveContainer>
  );
}
