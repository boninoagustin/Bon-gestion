import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateYeastStarter,
  sanitizeGravity,
  sanitizePositiveNumber,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const StarterCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('STARTER');
  const [starterVol, setStarterVol] = useState<number>(() => prefillNum(prefill, 'starterVolumeL', 2));
  const [starterGravity, setStarterGravity] = useState<number>(() => prefillNum(prefill, 'starterGravity', 1.036));

  React.useEffect(() => {
    if (typeof prefill.starterVolumeL === 'number') setStarterVol(prefill.starterVolumeL);
    if (typeof prefill.starterGravity === 'number') setStarterGravity(prefill.starterGravity);
  }, [prefill]);

  const current = useMemo(
    () => calculateYeastStarter(starterVol, starterGravity),
    [starterVol, starterGravity]
  );

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
        Calcula la cantidad de Extracto de Malta Seco (DME) para preparar tu starter de levadura (Braukaiser).
      </div>
      <SectionCard title="Parámetros del Starter">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Volumen Starter"
            value={starterVol}
            onChange={(v) => setStarterVol(sanitizePositiveNumber(v, 2, 200))}
            step="0.1"
            unit="L"
          />
          <InputGroup
            label="Densidad Objetivo"
            value={starterGravity}
            onChange={(v) => setStarterGravity(sanitizeGravity(v, 1.036))}
            step="0.001"
          />
        </div>
      </SectionCard>

      <SectionCard title="Preparación">
        <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 p-4 rounded-xl border border-amber-100 dark:border-amber-800 mb-4">
          <h4 className="font-bold mb-2">Instrucciones:</h4>
          <ol className="list-decimal list-inside text-sm space-y-1">
            <li>
              Pesar <strong className="font-bold">{current.dmeGrams.toFixed(0)}g</strong> de DME ({current.plato.toFixed(1)} °P).
            </li>
            <li>
              Agregar agua hasta alcanzar <strong className="font-bold">{current.volumeL.toFixed(2)}L</strong> totales.
            </li>
            <li>Hervir por 10-15 minutos.</li>
            <li>Enfriar a temperatura de inoculación (18-22°C).</li>
          </ol>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <ResultCard
            title="DME Necesario"
            value={current.dmeGrams.toFixed(0)}
            unit="g"
            subtext={`Crecimiento est.: ~${current.estimatedFinalCellsBillions.toFixed(0)} B cel`}
            colorClass="text-amber-500"
          />
          <ResultCard
            title="Volumen Total"
            value={current.volumeL.toFixed(2)}
            unit="L"
            subtext={`Densidad: ${current.targetGravity.toFixed(3)}`}
            colorClass="text-sky-500"
          />
        </div>
      </SectionCard>
    </>
  );
};
