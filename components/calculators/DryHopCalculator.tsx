import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const DryHopCalculator = () => {
  const [dhVol, setDhVol] = useState<number>(100);
  const [dhRate, setDhRate] = useState<number>(5);

  const calculateDryHop = () => {
    return (dhVol * dhRate).toFixed(0);
  };

  
  return (
          <>
            <SectionCard title="Parámetros de Dry Hop">
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Volumen Cerveza" value={dhVol} onChange={setDhVol} unit="L" />
                    <InputGroup label="Tasa Deseada" value={dhRate} onChange={setDhRate} unit="g/L" step="0.5" />
                </div>
            </SectionCard>
            <ResultCard title="Lúpulo Total" value={calculateDryHop()} unit="g" colorClass="text-emerald-400" />
          </>
        );
};
