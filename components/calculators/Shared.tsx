import React, { useCallback } from 'react';
import { DebouncedInput } from '../ui/DebouncedInput';
import {
  sanitizeNumber,
  SanitizeNumberOptions,
  WaterIonProfile,
} from '../../lib/brewmath';

/**
 * Perfiles de agua cervecera predefinidos en ppm (mg/L).
 */
export const WATER_PROFILES: Record<string, WaterIonProfile> = {
  IPA: { Ca: 110, Mg: 18, Na: 15, SO4: 350, Cl: 50, HCO3: 40 },
  GOLDEN: { Ca: 55, Mg: 10, Na: 15, SO4: 70, Cl: 70, HCO3: 40 },
  SCOTTISH: { Ca: 55, Mg: 15, Na: 40, SO4: 50, Cl: 90, HCO3: 120 },
  IRISH_RED: { Ca: 50, Mg: 10, Na: 15, SO4: 55, Cl: 60, HCO3: 110 },
  CUSTOM: { Ca: 0, Mg: 0, Na: 0, SO4: 0, Cl: 0, HCO3: 0 },
};

export interface SectionCardProps {
  title: string;
  children?: React.ReactNode;
}

export const SectionCard: React.FC<SectionCardProps> = ({ title, children }) => (
  <div className="bg-white dark:bg-zinc-900/40 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-zinc-800/80 mb-5 backdrop-blur-md">
    <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-4 border-b border-slate-100 dark:border-zinc-800/50 pb-2">
      {title}
    </h3>
    {children}
  </div>
);

export interface InputGroupProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: string;
  className?: string;
  min?: number;
  max?: number;
  allowNegative?: boolean;
  fallback?: number;
}

export const InputGroup: React.FC<InputGroupProps> = ({
  label,
  value,
  onChange,
  unit,
  step = '1',
  className = '',
  min = 0,
  max = Infinity,
  allowNegative = false,
  fallback = 0,
}) => {
  const handleDebouncedChange = useCallback(
    (newValue: string) => {
      const options: SanitizeNumberOptions = {
        fallback,
        min: allowNegative ? min : Math.max(0, min),
        max,
        allowNegative,
      };
      const sanitized = sanitizeNumber(newValue, options);
      onChange(sanitized);
    },
    [onChange, fallback, min, max, allowNegative]
  );

  return (
    <div className={`mb-3 ${className}`}>
      <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <DebouncedInput
          type="text"
          inputMode="decimal"
          step={step}
          value={value ?? fallback}
          onDebouncedChange={handleDebouncedChange}
          debounceMs={250}
          className="w-full p-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none font-mono text-sm font-bold shadow-sm transition-all"
        />
        {unit && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500 text-xs font-bold">
            {unit}
          </span>
        )}
      </div>
    </div>
  );
};

export interface ResultCardProps {
  title: string;
  value: number | string;
  unit?: string;
  subtext?: string;
  colorClass?: string;
}

export const ResultCard: React.FC<ResultCardProps> = ({
  title,
  value,
  unit,
  subtext,
  colorClass = 'text-copper',
}) => (
  <div className="bg-slate-900 dark:bg-zinc-800 p-5 rounded-2xl shadow-md border border-slate-800 dark:border-zinc-700">
    <p className="text-slate-400 dark:text-zinc-400 text-[10px] uppercase font-bold tracking-wider mb-2">
      {title}
    </p>
    <div className="flex items-baseline gap-1.5">
      <span className={`text-4xl font-black font-display tracking-tight ${colorClass}`}>
        {value}
      </span>
      {unit && (
        <span className="text-sm font-bold text-slate-300 dark:text-zinc-300">
          {unit}
        </span>
      )}
    </div>
    {subtext && (
      <p className="text-xs text-slate-500 dark:text-zinc-500 mt-2 font-medium">
        {subtext}
      </p>
    )}
  </div>
);
