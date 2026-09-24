"use client";

import { useState } from "react";
import { formatCurrency } from "./admin-ui";

interface ChartDataPoint {
  label: string;
  value: number;
}

interface AnalyticsChartProps {
  data: ChartDataPoint[];
  title?: string;
  subtitle?: string;
}

export function AnalyticsChart({
  data,
  title = "Weekly Revenue",
  subtitle = "Sales performance over the last 7 days",
}: AnalyticsChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  /* SVG viewBox geometry */
  const width = 600;
  const height = 240;
  const paddingX = 44;
  const paddingY = 30;

  const hasData = data.length > 0;

  /*
   * Scales. The maximum is floored so an empty or very quiet
   * week still renders a sensible axis instead of a flat line
   * pinned to the top.
   */
  const maxVal = Math.max(...data.map((point) => point.value), 1000);
  const range = maxVal;

  const points = data.map((point, index) => {
    /*
     * A single data point has no span to divide across, so it
     * is centred instead of dividing by zero.
     */
    const x =
      data.length === 1
        ? width / 2
        : paddingX + (index * (width - 2 * paddingX)) / (data.length - 1);

    /* SVG origin is top-left, so the Y axis is inverted. */
    const y = height - paddingY - (point.value * (height - 2 * paddingY)) / range;

    return { x, y, label: point.label, value: point.value };
  });

  const linePath = points.reduce(
    (path, point, index) =>
      index === 0 ? `M ${point.x} ${point.y}` : `${path} L ${point.x} ${point.y}`,
    ""
  );

  const areaPath =
    points.length > 1
      ? `${linePath} L ${points[points.length - 1].x} ${height - paddingY} L ${points[0].x} ${height - paddingY} Z`
      : "";

  const gridLinesCount = 4;

  const gridLines = Array.from({ length: gridLinesCount }).map((_, index) => ({
    y: paddingY + (index * (height - 2 * paddingY)) / (gridLinesCount - 1),
    value: maxVal - (index * range) / (gridLinesCount - 1),
  }));

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm transition-all hover:shadow-md">
      <div className="mb-4 flex flex-col justify-between gap-1 sm:flex-row sm:items-center">
        <div>
          <h3 className="text-base font-bold text-neutral-800">{title}</h3>
          <p className="text-xs text-neutral-400">{subtitle}</p>
        </div>

        {hoveredIndex !== null && points[hoveredIndex] && (
          <div className="text-right">
            <span className="text-xs font-semibold text-neutral-400">
              {points[hoveredIndex].label}:
            </span>{" "}
            <span className="text-sm font-bold text-brand-strong">
              {formatCurrency(points[hoveredIndex].value)}
            </span>
          </div>
        )}
      </div>

      {!hasData ? (
        <div className="flex h-[240px] items-center justify-center rounded-lg border border-dashed border-neutral-200">
          <p className="text-sm text-neutral-400">No chart data available</p>
        </div>
      ) : (
        <div className="relative w-full overflow-hidden">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="h-auto w-full overflow-visible"
            role="img"
            aria-label={`${title}: ${subtitle}`}
          >
            <defs>
              <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#F97316" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#F97316" stopOpacity="0" />
              </linearGradient>

              <filter id="chartShadow" x="-5%" y="-5%" width="110%" height="110%">
                <feDropShadow
                  dx="0"
                  dy="4"
                  stdDeviation="4"
                  floodColor="#F97316"
                  floodOpacity="0.15"
                />
              </filter>
            </defs>

            {/* Grid lines and Y axis labels */}
            {gridLines.map((line, index) => (
              <g key={index}>
                <line
                  x1={paddingX}
                  y1={line.y}
                  x2={width - paddingX}
                  y2={line.y}
                  stroke="#E5E5E5"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                />

                {/*
                  SVG text takes its colour from `fill`, so the
                  Tailwind colour has to be paired with
                  `fill-current` to apply at all.
                */}
                <text
                  x={paddingX - 10}
                  y={line.y + 4}
                  className="fill-current text-[9px] font-semibold text-neutral-400"
                  textAnchor="end"
                >
                  {line.value >= 1000
                    ? `${Math.round(line.value / 1000)}k`
                    : Math.round(line.value)}
                </text>
              </g>
            ))}

            {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}

            {linePath && (
              <path
                d={linePath}
                fill="none"
                stroke="#F97316"
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
                filter="url(#chartShadow)"
              />
            )}

            {points.map((point, index) => (
              <g key={index}>
                {/* Invisible hover column, for easier pointing */}
                <rect
                  x={point.x - 20}
                  y={paddingY}
                  width={40}
                  height={height - 2 * paddingY}
                  fill="transparent"
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredIndex(index)}
                  onMouseLeave={() => setHoveredIndex(null)}
                />

                <circle
                  cx={point.x}
                  cy={point.y}
                  r={hoveredIndex === index ? 6 : 4}
                  fill={hoveredIndex === index ? "#F97316" : "#FFFFFF"}
                  stroke="#F97316"
                  strokeWidth={hoveredIndex === index ? 3 : 2}
                  className="pointer-events-none transition-all duration-150"
                />

                <text
                  x={point.x}
                  y={height - paddingY + 16}
                  className="fill-current text-[9px] font-bold text-neutral-400"
                  textAnchor="middle"
                >
                  {point.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      )}
    </div>
  );
}
