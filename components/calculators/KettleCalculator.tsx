import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const KettleCalculator = () => {
  const [kettleDiameter, setKettleDiameter] = useState<number>(60);
  const [liquidHeight, setLiquidHeight] = useState<number>(50);

  const calculateKettleVol = () => {
    const radius = kettleDiameter / 2;
    const vol = (Math.PI * Math.pow(radius, 2) * liquidHeight) / 1000;
    return vol.toFixed(1);
  };

  
  return (
          <>
            <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
               Mide con una regla la altura del líquido en tu olla.
            </div>
            <SectionCard title="Dimensiones">
                <div className="grid grid-cols-2 gap-4">
                  <InputGroup label="Diámetro Olla" value={kettleDiameter} onChange={setKettleDiameter} unit="cm" />
                  <InputGroup label="Altura Líquido" value={liquidHeight} onChange={setLiquidHeight} unit="cm" />
                </div>
            </SectionCard>
            <ResultCard title="Volumen Actual" value={calculateKettleVol()} unit="Litros" colorClass="text-orange-400" />
          </>
        );
};
