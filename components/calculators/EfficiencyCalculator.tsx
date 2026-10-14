import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const EfficiencyCalculator = () => {
  const [effVolume, setEffVolume] = useState<number>(250);
const [effGravity, setEffGravity] = useState<number>(1.050);
const [effGrainKg, setEffGrainKg] = useState<number>(55);

  const calculateEfficiency = () => {
      const actualPoints = effVolume * (effGravity - 1) * 1000;
      const potentialPoints = effGrainKg * 300; 
      if (potentialPoints === 0) return '0';
      return ((actualPoints / potentialPoints) * 100).toFixed(1);
  };

  const eff = parseFloat(calculateEfficiency());
        let effColor = "text-red-400";
        let effMsg = "Bajo rendimiento";
        if (eff >= 65) { effColor = "text-yellow-400"; effMsg = "Aceptable"; }
        if (eff >= 75) { effColor = "text-green-400"; effMsg = "Óptimo"; }
        if (eff >= 85) { effColor = "text-blue-400"; effMsg = "Excelente"; }
  return (
            <>
               <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
                   Calcula cuánto azúcar extrajiste realmente de la malta.
               </div>
               
               <SectionCard title="Insumos">
                    <InputGroup label="Peso Total Granos" value={effGrainKg} onChange={setEffGrainKg} unit="kg" step="0.1" />
               </SectionCard>

               <SectionCard title="Medición Real">
                   <div className="grid grid-cols-2 gap-4">
                       <InputGroup label="Volumen Obtenido" value={effVolume} onChange={setEffVolume} unit="L" />
                       <InputGroup label="Densidad (OG)" value={effGravity} onChange={setEffGravity} step="0.001" />
                   </div>
               </SectionCard>

               <ResultCard 
                    title="Eficiencia del Sistema" 
                    value={eff} 
                    unit="%" 
                    colorClass={effColor}
                    subtext={effMsg}
               />
            </>
        );
};
