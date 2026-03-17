import { animate } from 'framer-motion';
import { useEffect, useId, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
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
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions.toFixed(0) : millions.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
  }
  return Math.round(value).toLocaleString('ru-RU');
}

function getNiceStep(maxValue: number) {
  if (maxValue <= 0) return 1;
  const roughStep = maxValue / 4;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughStep, 1)));
  const normalized = roughStep / magnitude;

  if (normalized <= 1) return magnitude;
  if (normalized <= 2) return 2 * magnitude;
  return 10 * magnitude;
}

interface AxisTickProps {
  x?: number | string;
  y?: number | string;
  payload?: {
    value: number;
  };
}

interface TooltipContentProps {
  active?: boolean;
  label?: string | number;
  payload?: Array<{
    value?: number | string;
  }>;
}

function formatYearLabel(points: IngestionPoint[]) {
  const years = Array.from(new Set(points.map((point) => point.yearLabel).filter(Boolean)));
  if (years.length === 0) return '';
  return years.join(' / ');
}

function IngestionTooltipContent({ active, label, payload }: TooltipContentProps) {
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
      <div style={{ color: 'var(--text)', fontWeight: 700 }}>
        {Math.round(Number(value || 0)).toLocaleString('ru-RU')}
      </div>
    </div>
  );
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
  const maxRows = chartData.reduce((acc, point) => Math.max(acc, point.rows), 0);
  const axisStep = getNiceStep(maxRows);
  const axisTickMax = Math.max(axisStep, Math.ceil(maxRows / axisStep) * axisStep);
  const axisMax = axisTickMax + axisStep;
  const yTicks = Array.from({ length: Math.max(2, Math.round(axisMax / axisStep) + 1) }, (_, idx) => idx * axisStep);
  const chartYear = formatYearLabel(chartData);
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
    <div>
      <ResponsiveContainer width="100%" height={332}>
        <AreaChart data={chartData} margin={{ top: 26, right: 18, left: 8, bottom: 34 }}>
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
            interval={0}
            tick={({ x = 0, y = 0, payload }: AxisTickProps) => {
              const point = chartData[Math.round(Number(payload?.value ?? 0))];
              if (!point) return null;
              return (
                <g transform={`translate(${Number(x)},${Number(y)})`}>
                  <text
                    x={0}
                    y={0}
                    dy={12}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize={12}
                    fontWeight={600}
                  >
                    {point.day}
                  </text>
                  <text
                    x={0}
                    y={0}
                    dy={28}
                    textAnchor="middle"
                    fill="var(--text-muted)"
                    fontSize={11}
                  >
                    {point.dateLabel ?? ''}
                  </text>
                </g>
              );
            }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            ticks={yTicks}
            domain={[0, axisMax]}
            padding={{ top: 10, bottom: 12 }}
            tickFormatter={(value: number) => formatRows(value)}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            width={68}
            axisLine={false}
            tickLine={false}
          />

          <Tooltip
            cursor={false}
            labelFormatter={(value) => {
              const point = chartData[Math.round(Number(value || 0))];
              return point?.dateLabel ? `${point.day}, ${point.dateLabel}` : point?.day ?? '';
            }}
            content={<IngestionTooltipContent />}
          />

          <Area
            type="monotone"
            dataKey="rows"
            fill={`url(#${gradientId})`}
            clipPath={`url(#${clipId})`}
            isAnimationActive={false}
            stroke="none"
            dot={false}
            activeDot={false}
          />
          <Line
            type="monotone"
            dataKey="rows"
            stroke="#111827"
            strokeWidth={2.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            isAnimationActive={false}
            dot={false}
            activeDot={false}
          />
        </AreaChart>
      </ResponsiveContainer>

      {chartYear ? (
        <div className="mt-1 text-center text-[0.95rem] font-semibold tracking-wide text-[var(--text-muted)]">
          {chartYear}
        </div>
      ) : null}
    </div>
  );
}
