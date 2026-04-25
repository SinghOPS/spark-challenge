"use client";

interface ImpactGaugeProps {
  ratio: number;
}

export default function ImpactGauge({ ratio }: ImpactGaugeProps) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const isFailing = clampedRatio < 0.8;
  const barColor = isFailing ? "var(--color-danger)" : "var(--color-success)";
  const radius = 92;
  const strokeWidth = 16;
  const centerX = 120;
  const centerY = 120;
  const circumference = Math.PI * radius;
  const progressLength = circumference * clampedRatio;
  const thresholdRatio = 0.8;
  const thresholdRadians = Math.PI * (1 - thresholdRatio);
  const markerX = centerX + radius * Math.cos(thresholdRadians);
  const markerY = centerY - radius * Math.sin(thresholdRadians);

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-[120px] w-[240px]">
        <svg viewBox="0 0 240 120" className="h-full w-full">
          <path
            d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          <path
            d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
            fill="none"
            stroke={barColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${progressLength} ${circumference}`}
            className="transition-all duration-700"
          />
          <line
            x1={markerX}
            y1={markerY}
            x2={markerX}
            y2={markerY - 8}
            stroke="var(--color-warning)"
            strokeWidth="2"
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-x-0 bottom-1 text-center">
          <span
            className="text-2xl font-bold sm:text-3xl"
            style={{ color: barColor }}
          >
            {(clampedRatio * 100).toFixed(1)}%
          </span>
        </div>
      </div>

      <div className="mt-2 flex w-full justify-between px-2 text-xs text-[var(--color-text-muted)]">
        <span>0%</span>
        <span className="text-[var(--color-warning)]">80% threshold</span>
        <span>100%</span>
      </div>

      <p className="mt-1 text-sm font-medium" style={{ color: barColor }}>
        Impact Ratio {isFailing ? "(FAILING)" : "(PASSING)"}
      </p>
    </div>
  );
}
