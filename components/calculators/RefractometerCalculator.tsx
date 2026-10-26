import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { Info } from 'lucide-react';
import {
  correctRefractometerReading,
  RefractometerModel,
  sanitizeNumber,
  sanitizePositiveNumber,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const RefractometerCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('REFRACTOMETER');
  const [refracOGBrix, setRefracOGBrix] = useState<number>(() => prefillNum(prefill, 'originalBrix', 12));
  const [refracFGBrix, setRefracFGBrix] = useState<number>(() => prefillNum(prefill, 'currentBrix', 6));
  const [refracWCF, setRefracWCF] = useState<number>(() => prefillNum(prefill, 'wortCorrectionFactor', 1.04));
  const [model, setModel] = useState<RefractometerModel>('AUTO');

  React.useEffect(() => {
    if (typeof prefill.originalBrix === 'number') setRefracOGBrix(prefill.originalBrix);
    if (typeof prefill.currentBrix === 'number') setRefracFGBrix(prefill.currentBrix);
    if (typeof prefill.wortCorrectionFactor === 'number') setRefracWCF(prefill.wortCorrectionFactor);
  }, [prefill]);

  const refrac = useMemo(
    () =>
      correctRefractometerReading(refracOGBrix, refracFGBrix, refracWCF, model),
    [refracOGBrix, refracFGBrix, refracWCF, model]
  );

  return (
    <>
      <div className="mb-5 bg-violet-50 dark:bg-violet-900/20 text-violet-900 dark:text-violet-300 p-4 shadow-sm rounded-xl text-xs border border-violet-100 dark:border-violet-800 flex items-start gap-2">
        <Info size={16} className="shrink-0 mt-0.5" />
        <div>
          Corrige automáticamente la lectura del refractómetro en presencia de{' '}
          <strong>alcohol</strong> usando las ecuaciones de{' '}
          <strong>Sean Terrill</strong> (cúbica, óptima al final de la fermentación) y{' '}
          <strong>Petr Novotny</strong> (cuadrática, óptima en fermentación activa).
        </div>
      </div>

      <SectionCard title="Lecturas Brix y Calibración">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Brix Inicial (OG)"
            value={refracOGBrix}
            onChange={(v) => setRefracOGBrix(sanitizePositiveNumber(v, 12, 60))}
            unit="°Bx"
            step="0.1"
          />
          <InputGroup
            label="Brix Final Aparente (FG)"
            value={refracFGBrix}
            onChange={(v) => setRefracFGBrix(sanitizePositiveNumber(v, 6, 60))}
            unit="°Bx"
            step="0.1"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
          <div>
            <InputGroup
              label="Factor Corrección Mosto (WCF)"
              value={refracWCF}
              onChange={(v) =>
                setRefracWCF(sanitizeNumber(v, { fallback: 1.04, min: 0.9, max: 1.2 }))
              }
              step="0.01"
            />
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 -mt-2">
              Normalmente 1.04. Ajusta según el perfil de tu mosto.
            </p>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Algoritmo de Corrección
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as RefractometerModel)}
              className="w-full p-2.5 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 font-bold text-sm focus:ring-2 focus:ring-copper/50 outline-none"
            >
              <option value="AUTO">Automático (Terrill / Novotny)</option>
              <option value="TERRILL">Sean Terrill (Cúbica)</option>
              <option value="NOVOTNY">Petr Novotny (Cuadrática)</option>
            </select>
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <ResultCard
          title="OG Corregida"
          value={refrac.ogSG.toFixed(3)}
          subtext={`${refrac.ogPlato.toFixed(1)} °P`}
          colorClass="text-amber-400"
        />
        <ResultCard
          title={`FG Corregida (${refrac.activeModel})`}
          value={refrac.fgSG.toFixed(3)}
          subtext={`Terrill: ${refrac.fgSGTerrill.toFixed(3)} | Novotny: ${refrac.fgSGNovotny.toFixed(3)}`}
          colorClass="text-violet-400"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ResultCard
          title="ABV Estimado"
          value={refrac.abvHall.toFixed(1)}
          unit="%"
          subtext={`Lineal: ${refrac.abvStandard.toFixed(1)}%`}
          colorClass="text-green-400"
        />
        <ResultCard
          title="Atenuación Aparente"
          value={refrac.apparentAttenuation.toFixed(0)}
          unit="%"
          subtext={`Atenuación Real: ${refrac.realAttenuation.toFixed(0)}% (RE: ${refrac.realExtractPlato.toFixed(1)} °P)`}
          colorClass="text-sky-400"
        />
      </div>
    </>
  );
};
