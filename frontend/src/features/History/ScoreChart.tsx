import { useMemo } from 'react';

interface ScoreDataPoint {
  version: number;
  score: number;
  createdAt: string;
}

interface ScoreChartProps {
  data: ScoreDataPoint[];
  height?: number;
}

export default function ScoreChart({ data, height = 120 }: ScoreChartProps) {
  const chartData = useMemo(() => {
    if (data.length === 0) return null;

    const minScore = Math.min(...data.map((d) => d.score));
    const maxScore = Math.max(...data.map((d) => d.score));
    const range = maxScore - minScore || 0.1; // Prevent division by zero

    const padding = 20;
    const chartWidth = 100; // percentage
    const chartHeight = height - padding * 2;

    const points = data.map((point, index) => {
      const x = (index / (data.length - 1 || 1)) * 100;
      const y = ((point.score - minScore) / range) * chartHeight;
      return { x, y: chartHeight - y + padding, ...point };
    });

    // Create SVG path for the line
    const linePath = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x}% ${p.y}`)
      .join(' ');

    // Create SVG path for the area fill
    const areaPath = `${linePath} L 100% ${chartHeight + padding} L 0% ${
      chartHeight + padding
    } Z`;

    return { points, linePath, areaPath, minScore, maxScore };
  }, [data, height]);

  if (!chartData || data.length < 2) {
    return (
      <div
        className="flex items-center justify-center text-gray-400 text-sm"
        style={{ height }}
      >
        Not enough data for chart
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 0.8) return '#22c55e'; // green-500
    if (score >= 0.6) return '#eab308'; // yellow-500
    return '#ef4444'; // red-500
  };

  return (
    <div className="relative" style={{ height }}>
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 bottom-0 w-12 flex flex-col justify-between text-xs text-gray-400 py-5">
        <span>{(chartData.maxScore * 100).toFixed(0)}%</span>
        <span>{(chartData.minScore * 100).toFixed(0)}%</span>
      </div>

      {/* Chart area */}
      <div className="ml-12 h-full">
        <svg
          viewBox="0 0 100 120"
          preserveAspectRatio="none"
          className="w-full h-full"
        >
          {/* Grid lines */}
          <line
            x1="0"
            y1="20"
            x2="100%"
            y2="20"
            stroke="#e5e7eb"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          <line
            x1="0"
            y1="60"
            x2="100%"
            y2="60"
            stroke="#e5e7eb"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />
          <line
            x1="0"
            y1="100"
            x2="100%"
            y2="100"
            stroke="#e5e7eb"
            strokeWidth="0.5"
            strokeDasharray="2,2"
          />

          {/* Area fill with gradient */}
          <defs>
            <linearGradient id="scoreGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <path
            d={chartData.areaPath}
            fill="url(#scoreGradient)"
          />

          {/* Line */}
          <path
            d={chartData.linePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />

          {/* Data points */}
          {chartData.points.map((point, index) => (
            <g key={index}>
              <circle
                cx={`${point.x}%`}
                cy={point.y}
                r="4"
                fill={getScoreColor(point.score)}
                stroke="white"
                strokeWidth="2"
              />
              {/* Hover area and tooltip trigger */}
              <title>
                v{point.version}: {(point.score * 100).toFixed(1)}%
              </title>
            </g>
          ))}
        </svg>
      </div>

      {/* X-axis labels */}
      <div className="ml-12 flex justify-between text-xs text-gray-400 mt-1">
        {data.map((point, index) => (
          <span key={index} className="text-center" style={{ width: `${100 / data.length}%` }}>
            v{point.version}
          </span>
        ))}
      </div>
    </div>
  );
}
