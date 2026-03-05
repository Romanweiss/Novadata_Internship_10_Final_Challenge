import { animate } from 'framer-motion';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
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

export function IngestionAreaChart({ data }: IngestionAreaChartProps) {
  const uniqueId = useId().replace(/:/g, '');
  const gradientId = `ingestionGradient-${uniqueId}`;
  const clipId = `ingestionRevealClip-${uniqueId}`;

  const chartData = useMemo(
    () => data.map((point, idx) => ({ ...point, index: idx })),
    [data],
  );

  const maxIndex = chartData.length ? chartData[chartData.length - 1].index : 0;
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    setRevealProgress(0);
    const controls = animate(0, 1, {
      delay: 0.1,
      duration: 1.8,
      ease: 'easeInOut',
      onUpdate: (latest) => setRevealProgress(latest),
    });

    return () => {
      controls.stop();
    };
  }, [data]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={chartData} margin={{ top: 20, right: 18, left: 8, bottom: 4 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6b7280" stopOpacity={0.42} />
            <stop offset="95%" stopColor="#6b7280" stopOpacity={0.03} />
          </linearGradient>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <rect x="0" y="0" width={revealProgress} height="1" />
          </clipPath>
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
          fill={`url(#${gradientId})`}
          clipPath={`url(#${clipId})`}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
