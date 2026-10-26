import React, { useState, useMemo, useEffect } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { calculateABVAdvanced, sanitizeGravity } from '../../lib/brewmath';
import { useCalculatorPrefill, prefillNum } from '../../services/ai/calculatorBridge';

export const ABVCalculator: React.FC = () => {
  const prefill = useCalculatorPrefill('ABV');
  const [og, setOg] = useState<number>(() => prefillNum(prefill, 'og', 1.050));
  const [fg, setFg] = useState<number>(() => prefillNum(prefill, 'fg', 1.010));

  useEffect(() => {
    if (typeof prefill.og === 'number') {
      setOg(prefill.og);
    }
    if (typeof prefill.fg === 'number') {
      setFg(prefill.fg);
    }
  }, [prefill]);

  const result = useMemo(() => calculateABVAdvanced(og, fg), [og, fg]);

  return (
    <>
      <SectionCard title="Datos de Densidad">
        <div className="grid grid-cols-2 gap-4">
          <InputGroup
            label="Inicial (OG)"
            value={og}
            onChange={(v) => setOg(sanitizeGravity(v, 1.05))}
            step="0.001"
          />
          <InputGroup
            label="Final (FG)"
            value={fg}
            onChange={(v) => setFg(sanitizeGravity(v, 1.01))}
            step="0.001"
          />
        </div>
      </SectionCard>
      <div className="grid grid-cols-2 gap-4">
        <ResultCard
          title="Alcohol por Volumen"
          value={result.abv.toFixed(1)}
          unit="%"
          subtext={`Lineal: ${result.abvLinear.toFixed(1)}% • ABW: ${result.abw.toFixed(1)}%`}
          colorClass="text-slate-200"
        />
        <ResultCard
          title="Atenuación Aparente"
          value={result.apparentAttenuation.toFixed(0)}
          unit="%"
          subtext={`Atenuación Real: ${result.realAttenuation.toFixed(0)}% (${result.ogPlato.toFixed(1)} → ${result.fgPlato.toFixed(1)} °P)`}
          colorClass="text-sky-400"
        />
      </div>
    </>
  );
};
