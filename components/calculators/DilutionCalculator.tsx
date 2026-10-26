import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateDilutionWater,
  sanitizeGravity,
  sanitizePositiveNumber,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const DilutionCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('DILUTION');
  const [currentGravDil, setCurrentGravDil] = useState<number>(() => prefillNum(prefill, 'currentGravity', 1.060));
  const [currentVolDil, setCurrentVolDil] = useState<number>(() => prefillNum(prefill, 'currentVolumeL', 200));
  const [targetGravDil, setTargetGravDil] = useState<number>(() => prefillNum(prefill, 'targetGravity', 1.050));

  React.useEffect(() => {
    if (typeof prefill.currentGravity === 'number') setCurrentGravDil(prefill.currentGravity);
    if (typeof prefill.currentVolumeL === 'number') setCurrentVolDil(prefill.currentVolumeL);
    if (typeof prefill.targetGravity === 'number') setTargetGravDil(prefill.targetGravity);
  }, [prefill]);

  const waterToAdd = useMemo(
    () =>
      calculateDilutionWater(currentGravDil, currentVolDil, targetGravDil),
    [currentGravDil, currentVolDil, targetGravDil]
  );

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
        ¿Te pasaste de densidad? Calcula cuánta agua tratada/declorada agregar.
      </div>

      <SectionCard title="Estado Actual">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Densidad Actual"
            value={currentGravDil}
            onChange={(v) => setCurrentGravDil(sanitizeGravity(v, 1.06))}
            step="0.001"
          />
          <InputGroup
            label="Volumen Actual"
            value={currentVolDil}
            onChange={(v) => setCurrentVolDil(sanitizePositiveNumber(v, 200))}
            unit="L"
          />
        </div>
      </SectionCard>

      <SectionCard title="Objetivo">
        <InputGroup
          label="Densidad Deseada"
          value={targetGravDil}
          onChange={(v) => setTargetGravDil(sanitizeGravity(v, 1.05))}
          step="0.001"
        />
      </SectionCard>

      <ResultCard
        title="Agregar Agua"
        value={waterToAdd.toFixed(1)}
        unit="Litros"
        subtext={`Volumen Final: ${(currentVolDil + waterToAdd).toFixed(1)} L`}
        colorClass="text-sky-400"
      />
    </>
  );
};
