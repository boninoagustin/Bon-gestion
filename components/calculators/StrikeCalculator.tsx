import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateStrikeTemp,
  sanitizePositiveNumber,
  sanitizeTemperatureC,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const StrikeCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('STRIKE');
  const [grainWeight, setGrainWeight] = useState<number>(() => prefillNum(prefill, 'grainWeightKg', 50));
  const [mashRatio, setMashRatio] = useState<number>(() => prefillNum(prefill, 'waterToGrainRatioLKg', prefillNum(prefill, 'mashRatio', 3)));
  const [targetMashTemp, setTargetMashTemp] = useState<number>(() => prefillNum(prefill, 'targetMashTempC', 65));
  const [grainTemp, setGrainTemp] = useState<number>(() => prefillNum(prefill, 'grainTempC', 20));
  const [thermalLoss, setThermalLoss] = useState<number>(() => prefillNum(prefill, 'thermalLossC', 1.0));

  React.useEffect(() => {
    if (typeof prefill.grainWeightKg === 'number') setGrainWeight(prefill.grainWeightKg);
    if (typeof prefill.waterToGrainRatioLKg === 'number') setMashRatio(prefill.waterToGrainRatioLKg);
    if (typeof prefill.targetMashTempC === 'number') setTargetMashTemp(prefill.targetMashTempC);
    if (typeof prefill.grainTempC === 'number') setGrainTemp(prefill.grainTempC);
    if (typeof prefill.thermalLossC === 'number') setThermalLoss(prefill.thermalLossC);
  }, [prefill]);

  const strikeTemp = useMemo(
    () =>
      calculateStrikeTemp(mashRatio, targetMashTemp, grainTemp, thermalLoss),
    [mashRatio, targetMashTemp, grainTemp, thermalLoss]
  );

  const mashWaterVolume = useMemo(
    () => sanitizePositiveNumber(grainWeight * mashRatio, 0),
    [grainWeight, mashRatio]
  );

  return (
    <>
      <SectionCard title="Grano y Empaste">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Peso Grano"
            value={grainWeight}
            onChange={(v) => setGrainWeight(sanitizePositiveNumber(v, 50))}
            unit="kg"
          />
          <InputGroup
            label="Temp. Grano"
            value={grainTemp}
            onChange={(v) => setGrainTemp(sanitizeTemperatureC(v, 20, -5, 50))}
            unit="°C"
          />
        </div>
        <div className="grid grid-cols-2 gap-4 mt-3">
          <InputGroup
            label="Relación Empaste"
            value={mashRatio}
            onChange={(v) => setMashRatio(sanitizePositiveNumber(v, 3, 15))}
            unit="L/kg"
            step="0.1"
          />
          <InputGroup
            label="Pérdida Térmica Equipo"
            value={thermalLoss}
            onChange={(v) => setThermalLoss(sanitizePositiveNumber(v, 1.0, 10))}
            unit="°C"
            step="0.5"
          />
        </div>
      </SectionCard>

      <SectionCard title="Objetivo">
        <InputGroup
          label="Temp. Macerado Deseada"
          value={targetMashTemp}
          onChange={(v) => setTargetMashTemp(sanitizeTemperatureC(v, 65, 40, 85))}
          unit="°C"
        />
      </SectionCard>

      <ResultCard
        title="Calentar Agua A:"
        value={strikeTemp.toFixed(1)}
        unit="°C"
        subtext={`Volumen Agua Empaste: ${mashWaterVolume.toFixed(1)} L`}
        colorClass="text-red-400"
      />
    </>
  );
};
