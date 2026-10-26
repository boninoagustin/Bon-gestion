import React, { useState, useMemo, useEffect } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateKettleVolume,
  sanitizePositiveNumber,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const KettleCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('KETTLE');
  const [kettleDiameter, setKettleDiameter] = useState<number>(() => prefillNum(prefill, 'diameterCm', 60));
  const [liquidHeight, setLiquidHeight] = useState<number>(() => prefillNum(prefill, 'liquidHeightCm', 50));

  useEffect(() => {
    if (typeof prefill.diameterCm === 'number') {
      setKettleDiameter(prefill.diameterCm);
    }
    if (typeof prefill.liquidHeightCm === 'number') {
      setLiquidHeight(prefill.liquidHeightCm);
    }
  }, [prefill]);

  const volumeL = useMemo(
    () => calculateKettleVolume(kettleDiameter, liquidHeight),
    [kettleDiameter, liquidHeight]
  );

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
        Mide con una regla la altura del líquido en tu olla cilíndrica.
      </div>
      <SectionCard title="Dimensiones">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Diámetro Olla"
            value={kettleDiameter}
            onChange={(v) => setKettleDiameter(sanitizePositiveNumber(v, 60))}
            unit="cm"
          />
          <InputGroup
            label="Altura Líquido"
            value={liquidHeight}
            onChange={(v) => setLiquidHeight(sanitizePositiveNumber(v, 50))}
            unit="cm"
          />
        </div>
      </SectionCard>
      <ResultCard
        title="Volumen Actual"
        value={volumeL.toFixed(1)}
        unit="Litros"
        colorClass="text-orange-400"
      />
    </>
  );
};
