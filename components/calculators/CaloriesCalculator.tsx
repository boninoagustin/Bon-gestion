import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const CaloriesCalculator = () => {
  const [og, setOg] = useState<number>(1.050);
const [fg, setFg] = useState<number>(1.010);

  const calculateCalories = () => {
    // Advanced math from NotebookLM for beer nutrition
    // Calories/12oz = (1881.22 * FG * (OG-FG)/(1.775-OG)) + (3550 * FG * (FG-1))
    const ogValue = typeof og === 'number' ? og : parseFloat(og) || 1.050;
    const fgValue = typeof fg === 'number' ? fg : parseFloat(fg) || 1.010;
    
    if (ogValue <= fgValue) return { per100: '0', perPint: '0' };
    
    // Calculate kcal per 12oz (355ml)
    const calPer12oz = (1881.22 * fgValue * (ogValue - fgValue) / (1.775 - ogValue)) + (3550 * fgValue * (fgValue - 1));
    
    // Scale appropriately
    const calPer100ml = calPer12oz * (100 / 355);
    const calPerPint = calPer12oz * (473 / 355); // US Pint is ~473ml

    return {
      per100: isNaN(calPer100ml) ? '0' : calPer100ml.toFixed(0),
      perPint: isNaN(calPerPint) ? '0' : calPerPint.toFixed(0)
    };
  };

  const calories = calculateCalories();
  return (
          <>
            <div className="mb-5 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300 p-4 shadow-sm rounded-xl text-xs border border-rose-100 dark:border-rose-800 flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>Calcula una aproximación calórica precisa basada en azúcares residuales y contenido de alcohol (fórmula termodinámica avanzada).</div>
            </div>
            
            <SectionCard title="Datos de Fermentación">
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Inicial (OG)" value={og} onChange={setOg} step="0.001" />
                    <InputGroup label="Final (FG)" value={fg} onChange={setFg} step="0.001" />
                </div>
            </SectionCard>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
                <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 dark:bg-zinc-950 rounded-xl border border-rose-500/30">
                    <Flame size={32} className="text-rose-500 mb-2" />
                    <span className="text-2xl font-mono font-bold text-white">{calories.per100}</span>
                    <span className="text-xs text-rose-200/70 uppercase">kcal / 100ml</span>
                </div>
                <div className="flex flex-col items-center justify-center p-4 bg-zinc-900 dark:bg-zinc-950 rounded-xl border border-rose-500/30">
                    <Flame size={32} className="text-orange-500 mb-2" />
                    <span className="text-2xl font-mono font-bold text-white">{calories.perPint}</span>
                    <span className="text-xs text-orange-200/70 uppercase">kcal / Pinta (473ml)</span>
                </div>
            </div>
          </>
        );
};
