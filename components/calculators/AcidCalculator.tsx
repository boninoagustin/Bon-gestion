import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { Info, Check } from 'lucide-react';
import {
  AcidType,
  calculateAcidAddition,
  sanitizeNumber,
  sanitizePositiveNumber,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum, prefillStr } from '../../services/ai/calculatorBridge';

const ACID_TYPES: readonly AcidType[] = ['CITRIC', 'LACTIC', 'PHOSPHORIC'];

const parseAcid = (raw: unknown): AcidType => {
  const s = String(raw ?? '').toUpperCase();
  if (s.includes('LACTIC')) return 'LACTIC';
  if (s.includes('PHOSPHORIC')) return 'PHOSPHORIC';
  if (s.includes('CITRIC')) return 'CITRIC';
  return 'CITRIC';
};

export const AcidCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('ACID');
  const [acidVol, setAcidVol] = useState<number>(() => prefillNum(prefill, 'waterVolumeL', 300));
  const [acidAlkalinity, setAcidAlkalinity] = useState<number>(() => prefillNum(prefill, 'alkalinityPpm', 100));
  const [acidTargetPh, setAcidTargetPh] = useState<number>(() => prefillNum(prefill, 'targetPh', 5.4));
  const [acidType, setAcidType] = useState<AcidType>(() => parseAcid(prefill.acidType));

  React.useEffect(() => {
    if (typeof prefill.waterVolumeL === 'number') setAcidVol(prefill.waterVolumeL);
    if (typeof prefill.alkalinityPpm === 'number') setAcidAlkalinity(prefill.alkalinityPpm);
    if (typeof prefill.targetPh === 'number') setAcidTargetPh(prefill.targetPh);
    if (typeof prefill.acidType === 'string') setAcidType(parseAcid(prefill.acidType));
  }, [prefill]);

  const acidResult = useMemo(
    () =>
      calculateAcidAddition(acidVol, acidAlkalinity, acidTargetPh, acidType),
    [acidVol, acidAlkalinity, acidTargetPh, acidType]
  );

  return (
    <>
      <div className="mb-5 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300 p-4 shadow-sm rounded-xl text-xs border border-rose-100 dark:border-rose-800 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          El cálculo depende de la <strong>Alcalinidad Residual</strong>. Si no tienes reporte de agua, usa referencias: RO=0, Blanda=50, Grifo=100+.
        </div>
      </div>

      <SectionCard title="Agua a Tratar">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Volumen Agua"
            value={acidVol}
            onChange={(v) => setAcidVol(sanitizePositiveNumber(v, 300))}
            unit="L"
          />
          <InputGroup
            label="Alcalinidad (HCO3)"
            value={acidAlkalinity}
            onChange={(v) => setAcidAlkalinity(sanitizePositiveNumber(v, 100))}
            unit="ppm"
          />
        </div>
        <div className="mt-3">
          <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">
            pH Objetivo
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="5.0"
              max="6.0"
              step="0.1"
              value={acidTargetPh}
              onChange={(e) =>
                setAcidTargetPh(
                  sanitizeNumber(e.target.value, { fallback: 5.4, min: 5.0, max: 6.0 })
                )
              }
              className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700/80 rounded-xl appearance-none cursor-pointer accent-rose-500"
            />
            <span className="font-mono font-bold text-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 rounded">
              {acidTargetPh.toFixed(1)}
            </span>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
            <span>Macerado (5.2-5.4)</span>
            <span>Lavado (5.5-5.8)</span>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Tipo de Ácido">
        <div className="flex flex-col gap-2">
          <button
            onClick={() => setAcidType('CITRIC')}
            className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${
              acidType === 'CITRIC'
                ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-200 font-medium'
                : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'
            }`}
          >
            <span>Ácido Cítrico (Polvo)</span>
            {acidType === 'CITRIC' && <Check size={16} />}
          </button>
          <button
            onClick={() => setAcidType('LACTIC')}
            className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${
              acidType === 'LACTIC'
                ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-200 font-medium'
                : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'
            }`}
          >
            <span>Ácido Láctico 88%</span>
            {acidType === 'LACTIC' && <Check size={16} />}
          </button>
          <button
            onClick={() => setAcidType('PHOSPHORIC')}
            className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${
              acidType === 'PHOSPHORIC'
                ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-200 font-medium'
                : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'
            }`}
          >
            <span>Ácido Fosfórico 85%</span>
            {acidType === 'PHOSPHORIC' && <Check size={16} />}
          </button>
        </div>
      </SectionCard>

      <ResultCard
        title="Cantidad a Agregar"
        value={acidResult.amount.toFixed(1)}
        unit={acidResult.unit}
        colorClass="text-rose-500"
        subtext={`Neutraliza ~${Math.round(acidResult.neutralizedAlkalinityPpm)} ppm de alcalinidad`}
      />
    </>
  );
};
