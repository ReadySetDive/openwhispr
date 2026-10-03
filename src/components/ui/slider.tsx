import * as React from "react";
import { cn } from "../lib/utils";

export interface SliderProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  className?: string;
  disabled?: boolean;
}

export const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  (
    {
      value,
      min = 0,
      max = 100,
      step = 1,
      onChange,
      className,
      disabled = false,
      ...props
    },
    ref
  ) => {
    const safeMin = Number(min);
    const safeMax = Number(max);
    const safeValue = Math.max(safeMin, Math.min(safeMax, Number(value) || 0));
    const range = safeMax - safeMin;
    const percentage = range > 0 ? ((safeValue - safeMin) / range) * 100 : 0;

    return (
      <div className={cn("relative flex items-center select-none touch-none w-full", className)}>
        <input
          ref={ref}
          type="range"
          min={safeMin}
          max={safeMax}
          step={step}
          value={safeValue}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className={cn(
            "w-full h-2 rounded-full appearance-none cursor-pointer outline-none transition-all",
            "focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-1",
            "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full",
            "[&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background",
            "[&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-thumb]:active:scale-95",
            "[&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full",
            "[&::-moz-range-thumb]:bg-primary [&::-moz-range-thumb]:shadow-md [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-background",
            "[&::-moz-range-thumb]:border-none",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          style={{
            background: `linear-gradient(to right, var(--color-primary, #4577e9) 0%, var(--color-primary, #4577e9) ${percentage}%, var(--color-muted, #e5e5e5) ${percentage}%, var(--color-muted, #e5e5e5) 100%)`,
          }}
          {...props}
        />
      </div>
    );
  }
);

Slider.displayName = "Slider";
