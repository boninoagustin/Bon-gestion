import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateColdCrashDays,
  sanitizePositiveNumber,
  sanitizeTemperatureC,
} from '../../lib/brewmath';

export const ColdCrashCalculator: React.FC = () => {
  const [ccStartTemp, setCcStartTemp] = useState<number>(20);
  const [ccTargetTemp, setCcTargetTemp] = useState<number>(2);
  const [ccRate, setCcRate] = useState<number>(5);

  const days = useMemo(
    () => calculateColdCrashDays(ccStartTemp, ccTargetTemp, ccRate),
    [ccStartTemp, ccTargetTemp, ccRate]
  );

  return (
    <>
      <SectionCard title="Temperaturas (°C)">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Temp. Actual"
            value={ccStartTemp}
            onChange={(v) => setCcStartTemp(sanitizeTemperatureC(v, 20, -5, 40))}
            unit="°C"
            allowNegative={true}
            min={-5}
            max={40}
          />
          <InputGroup
            label="Temp. Objetivo"
            value={ccTargetTemp}
            onChange={(v) => setCcTargetTemp(sanitizeTemperatureC(v, 2, -5, 30))}
            unit="°C"
            allowNegative={true}
            min={-5}
            max={30}
          />
        </div>
        <div className="mt-3">
          <InputGroup
            label="Tasa de Descenso"
            value={ccRate}
            onChange={(v) => setCcRate(sanitizePositiveNumber(v, 5, 30))}
            unit="°C/día"
            step="0.5"
          />
        </div>
      </SectionCard>
      <ResultCard
        title="Días Necesarios"
        value={days.toFixed(1)}
        unit="Días"
        colorClass="text-blue-400"
      />
    </>
  );
};
