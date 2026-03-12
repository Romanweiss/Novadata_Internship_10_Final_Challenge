import { animate } from 'framer-motion';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DuplicateTrendPoint } from '../../types/ui';

interface DuplicatesTrendChartProps {
  data: DuplicateTrendPoint[];
}

export function DuplicatesTrendChart({ data }: DuplicatesTrendChartProps) {
  const uniqueId = useId().replace(/:/g, '');
  const gradientId = `duplicatesGradient-${uniqueId}`;
  const clipId = `duplicatesRevealClip-${uniqueId}`;
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const chartData = useMemo(() => data.map((item, idx) => ({ ...item, idx })), [data]);
  const maxIndex = chartData.length ? chartData[chartData.length - 1].idx : 0;

  const yDomainMax = useMemo(() => {
    const maxRatio = chartData.reduce((max, item) => Math.max(max, item.ratio), 0);
    return maxRatio <= 10 ? 10 : Math.ceil(maxRatio / 10) * 10;
  }, [chartData]);

  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    setRevealProgress(0);
    const controls = animate(0, 1, {
      delay: 0.1,
      duration: 2.4,
      ease: 'easeInOut',
      onUpdate: (value) => setRevealProgress(value),
    });

    let rafA = 0;
    let rafB = 0;

    rafA = requestAnimationFrame(() => {
      rafB = requestAnimationFrame(() => {
        const path = wrapperRef.current?.querySelector<SVGPathElement>(
          '.duplicates-trend-line .recharts-line-curve',
        );
        if (!path) return;

        const length = path.getTotalLength();
        path.style.strokeDasharray = `${length}`;
        path.style.strokeDashoffset = `${length}`;
        path.style.transition = 'none';
        void path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 2.4s ease-in-out 0.1s';
        path.style.strokeDashoffset = '0';
      });
    });

    return () => {
      controls.stop();
      cancelAnimationFrame(rafA);
      cancelAnimationFrame(rafB);
    };
  }, [data]);

  return (
    <div ref={wrapperRef} className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={chartData} margin={{ top: 20, right: 22, left: 6, bottom: 8 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#6b7280" stopOpacity={0.34} />
            <stop offset="95%" stopColor="#6b7280" stopOpacity={0.08} />
          </linearGradient>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox">
            <rect x="0" y="0" width={revealProgress} height="1" />
          </clipPath>
        </defs>

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
          domain={[0, yDomainMax]}
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

        <Area
          type="monotone"
          dataKey="ratio"
          fill={`url(#${gradientId})`}
          stroke="none"
          isAnimationActive={false}
          clipPath={`url(#${clipId})`}
        />

        <Line
          className="duplicates-trend-line"
          type="monotone"
          dataKey="ratio"
          stroke="#111827"
          strokeWidth={2.8}
          isAnimationActive={false}
          dot={false}
          activeDot={false}
        />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
