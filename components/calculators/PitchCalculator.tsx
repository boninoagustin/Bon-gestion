import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculatePitchingRate,
  sanitizeGravity,
  sanitizeNumber,
  sanitizePositiveNumber,
  YeastPitchStyle,
} from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum, prefillStr } from '../../services/ai/calculatorBridge';

const STYLE_LABELS: Record<YeastPitchStyle, string> = {
  ALE: 'Ale Estándar (0.75 M/mL/°P)',
  HIGH_GRAVITY_ALE: 'Ale Alta Densidad (1.00 M/mL/°P)',
  HYBRID: 'Híbrida / Kölsch (1.00 M/mL/°P)',
  LAGER: 'Lager Estándar (1.50 M/mL/°P)',
  HIGH_GRAVITY_LAGER: 'Lager Alta Densidad (2.00 M/mL/°P)',
};

const STYLES_LIST = ['ALE', 'HIGH_GRAVITY_ALE', 'HYBRID', 'LAGER', 'HIGH_GRAVITY_LAGER'] as const;

export const PitchCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('PITCH');
  const [pitchOg, setPitchOg] = useState<number>(() => prefillNum(prefill, 'og', 1.050));
  const [batchVol, setBatchVol] = useState<number>(() => prefillNum(prefill, 'batchVolumeL', 250));
  const [yeastType, setYeastType] = useState<YeastPitchStyle>(() => prefillStr(prefill, 'pitchStyle', STYLES_LIST, 'ALE'));
  const [cellCount, setCellCount] = useState<number>(() => prefillNum(prefill, 'cellsPerPackBillions', 200));
  const [viabilityPercent, setViabilityPercent] = useState<number>(() => prefillNum(prefill, 'viabilityPercent', 95));

  React.useEffect(() => {
    if (typeof prefill.og === 'number') setPitchOg(prefill.og);
    if (typeof prefill.batchVolumeL === 'number') setBatchVol(prefill.batchVolumeL);
    if (typeof prefill.pitchStyle === 'string') setYeastType(prefillStr(prefill, 'pitchStyle', STYLES_LIST, 'ALE'));
    if (typeof prefill.cellsPerPackBillions === 'number') setCellCount(prefill.cellsPerPackBillions);
    if (typeof prefill.viabilityPercent === 'number') setViabilityPercent(prefill.viabilityPercent);
  }, [prefill]);

  const pitch = useMemo(
    () =>
      calculatePitchingRate({
        batchVolumeL: batchVol,
        og: pitchOg,
        yeastType,
        cellsPerPackBillions: cellCount,
        viabilityPercent,
      }),
    [batchVol, pitchOg, yeastType, cellCount, viabilityPercent]
  );

  return (
    <>
      <div className="mb-5 bg-sky-50 dark:bg-sky-900/20 text-sky-900 dark:text-sky-400 p-4 rounded-xl text-xs font-medium border border-sky-100 dark:border-sky-800/50 shadow-sm">
        Calcula la tasa de inoculación exacta en <strong>celdas/mL/°P</strong> usando conversión polinómica ASBC a Grados Plato ({pitch.plato.toFixed(1)} °P).
        {pitch.isHighGravity && (
          <span className="block mt-1 font-bold text-amber-600 dark:text-amber-400">
            ⚡ Mosto High Gravity detectado (&gt; 1.060): tasa escalada a {pitch.targetRateCellsPerMlPlato.toFixed(2)} M cel/mL/°P ({STYLE_LABELS[pitch.effectiveStyle]}).
          </span>
        )}
      </div>

      <SectionCard title="Detalles del Lote">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Volumen Lote"
            value={batchVol}
            onChange={(v) => setBatchVol(sanitizePositiveNumber(v, 250))}
            unit="L"
          />
          <InputGroup
            label="Densidad Original (OG)"
            value={pitchOg}
            onChange={(v) => setPitchOg(sanitizeGravity(v, 1.05))}
            step="0.001"
          />
        </div>
      </SectionCard>

      <SectionCard title="Perfil de Levadura y Viabilidad">
        <div className="space-y-3">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">
              Estilo de Fermentación (Tasa Celdas/mL/°P)
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {(
                [
                  { id: 'ALE', label: 'ALE (0.75)' },
                  { id: 'LAGER', label: 'LAGER (1.50)' },
                  { id: 'HYBRID', label: 'HÍBRIDA (1.00)' },
                  { id: 'HIGH_GRAVITY_ALE', label: 'HIGH GRAV ALE (1.00)' },
                  { id: 'HIGH_GRAVITY_LAGER', label: 'HIGH GRAV LAGER (2.00)' },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  onClick={() => setYeastType(option.id)}
                  className={`py-2.5 px-3 rounded-xl border-2 font-bold text-xs transition-all ${
                    yeastType === option.id
                      ? 'bg-copper text-white border-copper shadow-md'
                      : 'bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-800/80'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2">
            <InputGroup
              label="Células Nominales / Paquete"
              value={cellCount}
              onChange={(v) => setCellCount(sanitizePositiveNumber(v, 200))}
              unit="Billones"
            />
            <InputGroup
              label="Viabilidad Estimada"
              value={viabilityPercent}
              onChange={(v) =>
                setViabilityPercent(sanitizeNumber(v, { fallback: 95, min: 1, max: 100 }))
              }
              unit="%"
            />
          </div>
        </div>
      </SectionCard>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <ResultCard
          title="Células Viables"
          value={pitch.totalCellsBillions.toFixed(0)}
          unit="B"
          subtext={`Tasa: ${pitch.targetRateCellsPerMlPlato.toFixed(2)} M/mL/°P • ${pitch.plato.toFixed(1)} °P`}
          colorClass="text-amber-400"
        />
        <ResultCard
          title="Paquetes Líquidos"
          value={pitch.packsNeeded.toFixed(1)}
          unit="paq"
          subtext={`${pitch.viableCellsPerPackBillions.toFixed(0)} B viables/paq`}
          colorClass="text-amber-400"
        />
        <ResultCard
          title="Levadura Seca"
          value={pitch.dryYeastGrams.toFixed(0)}
          unit="g"
          subtext="Base ~10 B cel/g viables"
          colorClass="text-sky-400"
        />
      </div>
    </>
  );
};
