import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateDryHopAmount,
  sanitizePositiveNumber,
} from '../../lib/brewmath';

export const DryHopCalculator: React.FC = () => {
  const [dhVol, setDhVol] = useState<number>(100);
  const [dhRate, setDhRate] = useState<number>(5);

  const totalGrams = useMemo(
    () => calculateDryHopAmount(dhVol, dhRate),
    [dhVol, dhRate]
  );

  return (
    <>
      <SectionCard title="Parámetros de Dry Hop">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Volumen Cerveza"
            value={dhVol}
            onChange={(v) => setDhVol(sanitizePositiveNumber(v, 100))}
            unit="L"
          />
          <InputGroup
            label="Tasa Deseada"
            value={dhRate}
            onChange={(v) => setDhRate(sanitizePositiveNumber(v, 5, 50))}
            unit="g/L"
            step="0.5"
          />
        </div>
      </SectionCard>
      <ResultCard
        title="Lúpulo Total"
        value={totalGrams.toFixed(0)}
        unit="g"
        colorClass="text-emerald-400"
      />
    </>
  );
};
