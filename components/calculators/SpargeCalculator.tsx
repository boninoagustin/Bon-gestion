import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateSpargeVolumes,
  sanitizePositiveNumber,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const SpargeCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('SPARGE');
  const [spargeTotalWater, setSpargeTotalWater] = useState<number>(() => prefillNum(prefill, 'totalWaterL', 450));
  const [spargeGrainKg, setSpargeGrainKg] = useState<number>(() => prefillNum(prefill, 'grainWeightKg', 85));
  const [spargeMashRatio, setSpargeMashRatio] = useState<number>(() => prefillNum(prefill, 'waterToGrainRatioLKg', 3.0));
  const [spargeAbsorbtion, setSpargeAbsorbtion] = useState<number>(() => prefillNum(prefill, 'absorptionLPerKg', 1.0));
  const [spargeDeadSpace, setSpargeDeadSpace] = useState<number>(() => prefillNum(prefill, 'deadSpaceL', 25));

  React.useEffect(() => {
    if (typeof prefill.totalWaterL === 'number') setSpargeTotalWater(prefill.totalWaterL);
    if (typeof prefill.grainWeightKg === 'number') setSpargeGrainKg(prefill.grainWeightKg);
    if (typeof prefill.waterToGrainRatioLKg === 'number') setSpargeMashRatio(prefill.waterToGrainRatioLKg);
    if (typeof prefill.absorptionLPerKg === 'number') setSpargeAbsorbtion(prefill.absorptionLPerKg);
    if (typeof prefill.deadSpaceL === 'number') setSpargeDeadSpace(prefill.deadSpaceL);
  }, [prefill]);

  const current = useMemo(
    () =>
      calculateSpargeVolumes(
        spargeTotalWater,
        spargeGrainKg,
        spargeMashRatio,
        spargeAbsorbtion,
        spargeDeadSpace
      ),
    [
      spargeTotalWater,
      spargeGrainKg,
      spargeMashRatio,
      spargeAbsorbtion,
      spargeDeadSpace,
    ]
  );

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
        Calcula los volúmenes de agua para el empaste y el lavado del grano.
      </div>
      <SectionCard title="Configuración de Receta">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Agua Total Necesaria"
            value={spargeTotalWater}
            onChange={(v) => setSpargeTotalWater(sanitizePositiveNumber(v, 450))}
            unit="L"
          />
          <InputGroup
            label="Total de Granos"
            value={spargeGrainKg}
            onChange={(v) => setSpargeGrainKg(sanitizePositiveNumber(v, 85))}
            unit="kg"
          />
        </div>
      </SectionCard>

      <SectionCard title="Parámetros de Macerado">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Relación Empaste"
            value={spargeMashRatio}
            onChange={(v) => setSpargeMashRatio(sanitizePositiveNumber(v, 3.0, 15))}
            step="0.1"
            unit="L/kg"
          />
          <InputGroup
            label="Absorción Grano"
            value={spargeAbsorbtion}
            onChange={(v) => setSpargeAbsorbtion(sanitizePositiveNumber(v, 1.0, 5))}
            step="0.1"
            unit="L/kg"
          />
          <div className="col-span-2">
            <InputGroup
              label="Falso Fondo / Pérdidas"
              value={spargeDeadSpace}
              onChange={(v) => setSpargeDeadSpace(sanitizePositiveNumber(v, 25))}
              step="0.5"
              unit="L"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Distribución de Agua">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <ResultCard
            title="Agua Macerado (Mash)"
            value={current.mashWaterL.toFixed(1)}
            unit="L"
            colorClass="text-sky-400"
          />
          <ResultCard
            title="Agua Lavado (Sparge)"
            value={current.spargeWaterL.toFixed(1)}
            unit="L"
            colorClass="text-amber-400"
          />
          <div className="col-span-2">
            <ResultCard
              title="Volumen Pre-Hervor"
              value={current.preBoilVolumeL.toFixed(1)}
              unit="L"
              colorClass="text-green-400"
            />
          </div>
        </div>
        <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl text-xs text-zinc-500 dark:text-zinc-400">
          * El grano absorberá {current.grainAbsorptionL.toFixed(1)}L y se perderán {spargeDeadSpace.toFixed(1)}L en el falso fondo.
        </div>
      </SectionCard>
    </>
  );
};
