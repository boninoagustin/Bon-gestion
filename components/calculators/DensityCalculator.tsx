import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  correctGravity,
  sanitizeGravity,
  sanitizeTemperatureC,
  sgToPlato,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const DensityCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('DENSITY');
  const [measuredGravity, setMeasuredGravity] = useState<number>(() => prefillNum(prefill, 'measuredGravity', 1.050));
  const [measuredTemp, setMeasuredTemp] = useState<number>(() => prefillNum(prefill, 'measuredTempC', 60));
  const [calibrationTemp, setCalibrationTemp] = useState<number>(() => prefillNum(prefill, 'calibrationTempC', 15));

  React.useEffect(() => {
    if (typeof prefill.measuredGravity === 'number') setMeasuredGravity(prefill.measuredGravity);
    if (typeof prefill.measuredTempC === 'number') setMeasuredTemp(prefill.measuredTempC);
    if (typeof prefill.calibrationTempC === 'number') setCalibrationTemp(prefill.calibrationTempC);
  }, [prefill]);

  const correctedGravity = useMemo(
    () => correctGravity(measuredGravity, measuredTemp, calibrationTemp),
    [measuredGravity, measuredTemp, calibrationTemp]
  );

  const correctedPlato = useMemo(
    () => sgToPlato(correctedGravity),
    [correctedGravity]
  );

  return (
    <>
      <SectionCard title="Lectura Densímetro">
        <InputGroup
          label="Densidad Leída (SG)"
          value={measuredGravity}
          onChange={(v) => setMeasuredGravity(sanitizeGravity(v, 1.05))}
          step="0.001"
        />
      </SectionCard>

      <SectionCard title="Temperaturas">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Temp. Muestra"
            value={measuredTemp}
            onChange={(v) => setMeasuredTemp(sanitizeTemperatureC(v, 20, 0, 100))}
            unit="°C"
          />
          <InputGroup
            label="Calibración"
            value={calibrationTemp}
            onChange={(v) => setCalibrationTemp(sanitizeTemperatureC(v, 20, 10, 30))}
            unit="°C"
          />
        </div>
      </SectionCard>

      <ResultCard
        title="Densidad Corregida"
        value={correctedGravity.toFixed(3)}
        subtext={`Equivalente: ${correctedPlato.toFixed(1)} °Plato (Ecuación de Thiesen)`}
        colorClass="text-purple-400"
      />
    </>
  );
};
