import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const DilutionCalculator = () => {
  const [currentGravDil, setCurrentGravDil] = useState<number>(1.060);
const [currentVolDil, setCurrentVolDil] = useState<number>(200);
const [targetGravDil, setTargetGravDil] = useState<number>(1.050);

  const calculateDilution = () => {
    const p1 = (currentGravDil - 1) * 1000;
    const p2 = (targetGravDil - 1) * 1000;
    if (p2 <= 0) return '0';
    const finalVol = (p1 * currentVolDil) / p2;
    return (finalVol - currentVolDil).toFixed(1);
  };

  
  return (
          <>
             <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
               ¿Te pasaste de densidad? Calcula cuánta agua agregar.
             </div>
             
             <SectionCard title="Estado Actual">
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Densidad Actual" value={currentGravDil} onChange={setCurrentGravDil} step="0.001" />
                    <InputGroup label="Volumen Actual" value={currentVolDil} onChange={setCurrentVolDil} unit="L" />
                </div>
             </SectionCard>

             <SectionCard title="Objetivo">
                <InputGroup label="Densidad Deseada" value={targetGravDil} onChange={setTargetGravDil} step="0.001" />
             </SectionCard>

            <ResultCard title="Agregar Agua" value={calculateDilution()} unit="Litros" colorClass="text-sky-400" />
          </>
        );
};
