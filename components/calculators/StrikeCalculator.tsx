import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const StrikeCalculator = () => {
  const [grainWeight, setGrainWeight] = useState<number>(50);
const [mashRatio, setMashRatio] = useState<number>(3);
const [targetMashTemp, setTargetMashTemp] = useState<number>(65);
const [grainTemp, setGrainTemp] = useState<number>(20);

  const calculateStrikeTemp = () => {
    const thermalLossFC = 1.0; // Factor de corrección térmica (pérdida del sistema)
    const result = (0.41 / mashRatio) * (targetMashTemp - grainTemp) + targetMashTemp + thermalLossFC;
    return result.toFixed(1);
  };

  
  return (
          <>
             <SectionCard title="Grano y Empaste">
                 <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Peso Grano" value={grainWeight} onChange={setGrainWeight} unit="kg" />
                    <InputGroup label="Temp. Grano" value={grainTemp} onChange={setGrainTemp} unit="°C" />
                 </div>
                 <div className="mt-3">
                    <InputGroup label="Relación Empaste" value={mashRatio} onChange={setMashRatio} unit="L/kg" />
                 </div>
             </SectionCard>

             <SectionCard title="Objetivo">
                 <InputGroup label="Temp. Macerado Deseada" value={targetMashTemp} onChange={setTargetMashTemp} unit="°C" />
             </SectionCard>

            <ResultCard title="Calentar Agua A:" value={calculateStrikeTemp()} unit="°C" subtext={`Volumen Agua: ${(grainWeight * mashRatio).toFixed(1)} L`} colorClass="text-red-400" />
          </>
        );
};
