import { animate } from 'framer-motion';
import { useEffect, useId, useMemo, useState } from 'react';
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

import { useAppState } from '../../app/useAppState';
import type { DuplicateTrendPoint } from '../../types/ui';

interface DuplicatesTrendChartProps {
  data: DuplicateTrendPoint[];
}

interface TooltipContentProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    value?: number | string;
  }>;
}

function formatPercentTick(value: number) {
  return `${Math.round(value)}%`;
}

function formatRunLabel(label: string, language: 'ru' | 'en') {
  if (language !== 'ru') return label;

  const match = label.match(/(\d+)/);
  if (!match) return label;

  return `Запуск №${match[1]}`;
}

function DuplicatesTooltipContent({ active, label, payload }: TooltipContentProps) {
  if (!active || !payload?.length) return null;

  const value = payload[0]?.value;

  return (
    <div
      style={{
        borderRadius: 14,
        border: '1px solid var(--border)',
        background: 'var(--surface)',
        boxShadow: '0 12px 24px -18px rgba(15, 23, 42, 0.65)',
        padding: '12px 14px',
      }}
    >
      <div style={{ color: 'var(--text-muted)', fontWeight: 600, marginBottom: 6 }}>{label}</div>
      <div style={{ color: 'var(--text)', fontWeight: 700 }}>{Number(value || 0).toFixed(1)}%</div>
    </div>
  );
}

export function DuplicatesTrendChart({ data }: DuplicatesTrendChartProps) {
  const { language } = useAppState();
  const uniqueId = useId().replace(/:/g, '');
  const gradientId = `duplicatesGradient-${uniqueId}`;
  const clipId = `duplicatesRevealClip-${uniqueId}`;

  const chartData = useMemo(() => data.map((item, idx) => ({ ...item, idx })), [data]);
  const maxIndex = chartData.length ? chartData[chartData.length - 1].idx : 0;

  const yDomainMax = useMemo(() => {
    const maxRatio = chartData.reduce((max, item) => Math.max(max, item.ratio), 0);
    return maxRatio <= 10 ? 10 : Math.ceil(maxRatio / 10) * 10;
  }, [chartData]);

  const yAxisCaption = language === 'ru' ? 'Доля дубликатов' : 'Duplicates ratio';
  const xAxisCaption = language === 'ru' ? 'Запуски' : 'Runs';
  const [revealProgress, setRevealProgress] = useState(0);

  useEffect(() => {
    setRevealProgress(0);
    const controls = animate(0, 1, {
      delay: 0.1,
      duration: 1.8,
      ease: 'easeInOut',
      onUpdate: (value) => setRevealProgress(value),
    });

    return () => {
      controls.stop();
    };
  }, [data]);

  return (
    <div>
      <div className="mb-1 text-[0.76rem] font-semibold tracking-[0.02em] text-[var(--text-muted)]">
        {yAxisCaption}
      </div>
      <div className="h-[280px] w-full">
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
              tickFormatter={(value) => formatRunLabel(chartData[value]?.run ?? '', language)}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />

            <YAxis
              domain={[0, yDomainMax]}
              tickFormatter={(value: number) => formatPercentTick(value)}
              tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
              width={44}
              axisLine={false}
              tickLine={false}
            />

            <Tooltip
              cursor={false}
              labelFormatter={(value) => chartData[Math.round(Number(value || 0))]?.run ?? ''}
              content={<DuplicatesTooltipContent />}
            />

            <Area
              type="monotone"
              dataKey="ratio"
              fill={`url(#${gradientId})`}
              stroke="none"
              isAnimationActive={false}
              clipPath={`url(#${clipId})`}
              dot={false}
              activeDot={false}
            />

            <Line
              type="monotone"
              dataKey="ratio"
              stroke="#111827"
              strokeWidth={2.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              isAnimationActive={false}
              pathLength={100}
              strokeDasharray={`${Math.max(revealProgress * 100, 0)} 100`}
              dot={false}
              activeDot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-1 text-center text-[0.78rem] font-medium tracking-[0.01em] text-[var(--text-muted)]">
        {xAxisCaption}
      </div>
    </div>
  );
}
