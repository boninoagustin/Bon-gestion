import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { Info, Check } from 'lucide-react';
import {
  BJCP_CARBONATION_STYLES,
  calculatePriming,
  sanitizePositiveNumber,
  sanitizeTemperatureC,
  SugarType,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

const SUGAR_LABELS: Record<SugarType, string> = {
  TABLE: 'Azúcar de Mesa (Sacarosa)',
  DEXTROSE: 'Dextrosa Monohidratada',
  HONEY: 'Miel (~80% fermentable)',
  DME: 'Extracto Seco de Malta (DME)',
};

export const PrimingCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('PRIMING');
  const [primingVol, setPrimingVol] = useState<number>(() => prefillNum(prefill, 'volumeL', 300));
  const [primingTemp, setPrimingTemp] = useState<number>(() => prefillNum(prefill, 'temperatureC', 20));
  const [primingTargetCO2, setPrimingTargetCO2] = useState<number>(() => prefillNum(prefill, 'targetCO2Volumes', 2.5));
  const [primingSugarType, setPrimingSugarType] = useState<SugarType>('TABLE');

  React.useEffect(() => {
    if (typeof prefill.volumeL === 'number') setPrimingVol(prefill.volumeL);
    if (typeof prefill.temperatureC === 'number') setPrimingTemp(prefill.temperatureC);
    if (typeof prefill.targetCO2Volumes === 'number') setPrimingTargetCO2(prefill.targetCO2Volumes);
  }, [prefill]);

  const priming = useMemo(
    () =>
      calculatePriming(
        primingVol,
        primingTemp,
        primingTargetCO2,
        primingSugarType
      ),
    [primingVol, primingTemp, primingTargetCO2, primingSugarType]
  );

  return (
    <>
      <div className="mb-5 bg-lime-50 dark:bg-lime-900/20 text-lime-900 dark:text-lime-300 p-4 shadow-sm rounded-xl text-xs border border-lime-100 dark:border-lime-800 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          Calcula la cantidad exacta de azúcar para carbonatar en <strong>botella</strong>. CO2 residual estimado a {primingTemp}°C: <strong>{priming.residualCO2.toFixed(2)} Vol</strong>.
        </div>
      </div>

      <SectionCard title="Datos del Lote y Estilo BJCP">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Volumen a Embotellar"
            value={primingVol}
            onChange={(v) => setPrimingVol(sanitizePositiveNumber(v, 300))}
            unit="L"
          />
          <InputGroup
            label="Temp. Máx Fermentación"
            value={primingTemp}
            onChange={(v) => setPrimingTemp(sanitizeTemperatureC(v, 20, 0, 40))}
            unit="°C"
          />
        </div>
        <InputGroup
          label="Volúmenes CO2 Deseados"
          value={primingTargetCO2}
          onChange={(v) => setPrimingTargetCO2(sanitizePositiveNumber(v, 2.5, 5.5))}
          step="0.1"
        />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {BJCP_CARBONATION_STYLES.slice(0, 8).map((style) => (
            <button
              key={style.id}
              onClick={() => setPrimingTargetCO2(style.targetVols)}
              className={`px-3 py-1 text-xs rounded-xl whitespace-nowrap transition ${
                primingTargetCO2 === style.targetVols
                  ? 'bg-lime-500 text-white font-bold'
                  : 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-700/80 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700/80'
              }`}
            >
              {style.targetVols.toFixed(1)} ({style.name.split(' (')[0]})
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Tipo de Azúcar">
        <div className="flex flex-col gap-2">
          {(['TABLE', 'DEXTROSE', 'HONEY', 'DME'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setPrimingSugarType(t)}
              className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${
                primingSugarType === t
                  ? 'bg-lime-50 dark:bg-lime-900/30 border-lime-500 text-lime-900 dark:text-lime-200 font-medium'
                  : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'
              }`}
            >
              <span>{SUGAR_LABELS[t]}</span>
              {primingSugarType === t && <Check size={16} />}
            </button>
          ))}
        </div>
      </SectionCard>

      <div className="grid grid-cols-3 gap-3">
        <ResultCard
          title="g/Litro"
          value={priming.gramsPerLiter.toFixed(1)}
          unit="g/L"
          colorClass="text-lime-400"
        />
        <ResultCard
          title="Total"
          value={priming.totalGrams.toFixed(0)}
          unit="g"
          colorClass="text-lime-400"
        />
        <ResultCard
          title="Por Botella"
          value={priming.perBottle330ml.toFixed(1)}
          unit="g (330ml)"
          subtext={`500ml: ${priming.perBottle500ml.toFixed(1)}g`}
          colorClass="text-lime-300"
        />
      </div>
    </>
  );
};
