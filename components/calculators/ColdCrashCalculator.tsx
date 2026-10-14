import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const ColdCrashCalculator = () => {
  const [ccStartTemp, setCcStartTemp] = useState<number>(20);
  const [ccTargetTemp, setCcTargetTemp] = useState<number>(2);
  const [ccRate, setCcRate] = useState<number>(5);

  const calculateColdCrash = () => {
    if (ccStartTemp <= ccTargetTemp) return '0';
    const tempDrop = ccStartTemp - ccTargetTemp;
    const days = tempDrop / ccRate;
    return days.toFixed(1);
  };

  
  return (
          <>
            <SectionCard title="Temperaturas (°C)">
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Temp. Actual" value={ccStartTemp} onChange={setCcStartTemp} unit="°C" />
                    <InputGroup label="Temp. Objetivo" value={ccTargetTemp} onChange={setCcTargetTemp} unit="°C" />
                </div>
                <div className="mt-3">
                    <InputGroup label="Tasa de Descenso" value={ccRate} onChange={setCcRate} unit="°C/día" step="0.5" />
                </div>
            </SectionCard>
            <ResultCard title="Días Necesarios" value={calculateColdCrash()} unit="Días" colorClass="text-blue-400" />
          </>
        );
};
