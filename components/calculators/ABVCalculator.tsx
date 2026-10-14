import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';

export const ABVCalculator: React.FC = () => {
  const [og, setOg] = useState<number>(1.050);
  const [fg, setFg] = useState<number>(1.010);

  const calculateABV = () => {
      if (og <= fg) return '0.0';
      const abv = (76.08 * (og - fg) / (1.775 - og)) * (fg / 0.794);
      return Math.max(0, abv).toFixed(1);
  };

  const calculateAttenuation = () => {
      if (og <= 1 || fg >= og) return '0';
      const att = ((og - fg) / (og - 1)) * 100;
      return Math.max(0, Math.min(100, att)).toFixed(0);
  };

  return (
    <>
      <SectionCard title="Datos de Densidad">
          <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Inicial (OG)" value={og} onChange={setOg} step="0.001" />
              <InputGroup label="Final (FG)" value={fg} onChange={setFg} step="0.001" />
          </div>
      </SectionCard>
      <div className="grid grid-cols-2 gap-4">
          <ResultCard title="Alcohol por Volumen" value={calculateABV()} unit="%" colorClass="text-slate-200" />
          <ResultCard title="Atenuación Aparente" value={calculateAttenuation()} unit="%" colorClass="text-sky-400" />
      </div>
    </>
  );
};
