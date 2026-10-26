import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateMashEfficiency,
  sanitizeGravity,
  sanitizePositiveNumber,
} from '../../lib/brewmath';

export const EfficiencyCalculator: React.FC = () => {
  const [effVolume, setEffVolume] = useState<number>(250);
  const [effGravity, setEffGravity] = useState<number>(1.050);
  const [effGrainKg, setEffGrainKg] = useState<number>(55);

  const eff = useMemo(
    () => calculateMashEfficiency(effGravity, effVolume, effGrainKg),
    [effGravity, effVolume, effGrainKg]
  );

  let effColor = 'text-red-400';
  let effMsg = 'Bajo rendimiento';
  if (eff >= 65) {
    effColor = 'text-yellow-400';
    effMsg = 'Aceptable';
  }
  if (eff >= 75) {
    effColor = 'text-green-400';
    effMsg = 'Óptimo';
  }
  if (eff >= 85) {
    effColor = 'text-blue-400';
    effMsg = 'Excelente';
  }

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
        Calcula qué porcentaje de los azúcares potenciales de la malta extrajiste realmente.
      </div>

      <SectionCard title="Insumos">
        <InputGroup
          label="Peso Total Granos"
          value={effGrainKg}
          onChange={(v) => setEffGrainKg(sanitizePositiveNumber(v, 55))}
          unit="kg"
          step="0.1"
        />
      </SectionCard>

      <SectionCard title="Medición Real">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Volumen Obtenido"
            value={effVolume}
            onChange={(v) => setEffVolume(sanitizePositiveNumber(v, 250))}
            unit="L"
          />
          <InputGroup
            label="Densidad (OG)"
            value={effGravity}
            onChange={(v) => setEffGravity(sanitizeGravity(v, 1.05))}
            step="0.001"
          />
        </div>
      </SectionCard>

      <ResultCard
        title="Eficiencia del Sistema"
        value={eff.toFixed(1)}
        unit="%"
        colorClass={effColor}
        subtext={effMsg}
      />
    </>
  );
};
