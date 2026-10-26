import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup } from './Shared';
import { Info, Flame } from 'lucide-react';
import { calculateBeerCalories, sanitizeGravity } from '../../lib/brewmath';

export const CaloriesCalculator: React.FC = () => {
  const [og, setOg] = useState<number>(1.050);
  const [fg, setFg] = useState<number>(1.010);

  const calories = useMemo(() => calculateBeerCalories(og, fg), [og, fg]);

  return (
    <>
      <div className="mb-5 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300 p-4 shadow-sm rounded-xl text-xs border border-rose-100 dark:border-rose-800 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          Calcula el aporte calórico según ecuaciones oficiales <strong>ASBC</strong> basadas en extracto real residual y contenido de etanol.
        </div>
      </div>

      <SectionCard title="Datos de Fermentación">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Inicial (OG)"
            value={og}
            onChange={(v) => setOg(sanitizeGravity(v, 1.05))}
            step="0.001"
          />
          <InputGroup
            label="Final (FG)"
            value={fg}
            onChange={(v) => setFg(sanitizeGravity(v, 1.01))}
            step="0.001"
          />
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4 mt-6">
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 dark:bg-zinc-950 rounded-xl border border-rose-500/30">
          <Flame size={32} className="text-rose-500 mb-2" />
          <span className="text-2xl font-mono font-bold text-white">
            {calories.kcalPer100ml.toFixed(0)}
          </span>
          <span className="text-xs text-rose-200/70 uppercase">
            kcal / 100ml ({calories.kjPer100ml.toFixed(0)} kJ)
          </span>
        </div>
        <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 dark:bg-zinc-950 rounded-xl border border-rose-500/30">
          <Flame size={32} className="text-orange-500 mb-2" />
          <span className="text-2xl font-mono font-bold text-white">
            {calories.kcalPerPint473ml.toFixed(0)}
          </span>
          <span className="text-xs text-orange-200/70 uppercase">
            kcal / Pinta (473ml) • Carbs: {calories.carbsPer100ml.toFixed(1)}g/100ml
          </span>
        </div>
      </div>
    </>
  );
};
