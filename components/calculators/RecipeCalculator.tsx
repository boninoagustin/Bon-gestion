import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import {
  calculateRecipeEstimatedOG,
  calculateRecipeGrainBill,
  sanitizeGravity,
  sanitizeNumber,
  sanitizePositiveNumber,
} from '../../lib/brewmath';

export const RecipeCalculator: React.FC = () => {
  const [recipeVol, setRecipeVol] = useState<number>(250);
  const [recipeTargetOg, setRecipeTargetOg] = useState<number>(1.050);
  const [recipeInputKg, setRecipeInputKg] = useState<number>(55);
  const [recipeEfficiency, setRecipeEfficiency] = useState<number>(75);
  const [maltPotential, setMaltPotential] = useState<number>(300);

  const grainBillKg = useMemo(
    () =>
      calculateRecipeGrainBill(
        recipeVol,
        recipeTargetOg,
        recipeEfficiency,
        maltPotential
      ),
    [recipeVol, recipeTargetOg, recipeEfficiency, maltPotential]
  );

  const estimatedOg = useMemo(
    () =>
      calculateRecipeEstimatedOG(
        recipeVol,
        recipeInputKg,
        recipeEfficiency,
        maltPotential
      ),
    [recipeVol, recipeInputKg, recipeEfficiency, maltPotential]
  );

  return (
    <>
      <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
        Calcula kilos de malta base necesarios para alcanzar tu densidad objetivo, ajustado por eficiencia y calidad del grano.
      </div>

      <SectionCard title="Parámetros de Equipo">
        <div className="grid grid-cols-2 gap-4 mb-3">
          <InputGroup
            label="Eficiencia Equipo"
            value={recipeEfficiency}
            onChange={(v) =>
              setRecipeEfficiency(sanitizeNumber(v, { fallback: 75, min: 1, max: 100 }))
            }
            unit="%"
          />
          <InputGroup
            label="Potencial Malta"
            value={maltPotential}
            onChange={(v) => setMaltPotential(sanitizePositiveNumber(v, 300, 400))}
            unit="L°/kg"
          />
        </div>
        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-xs font-medium text-amber-900 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 shadow-sm">
          <strong className="font-bold text-amber-950 dark:text-amber-300">
            Potenciales típicos (L°/kg):
          </strong>
          <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2">
            <li>• Pilsen/Pale: 295-310</li>
            <li>• Munich/Vienna: 285-295</li>
            <li>• Trigo: 290-300</li>
            <li>• Caramelo/Crystal: 250-270</li>
          </ul>
        </div>
      </SectionCard>

      <SectionCard title="Balance Cruzado">
        <div className="mb-5 bg-sky-50 dark:bg-sky-900/20 text-sky-900 dark:text-sky-400 p-4 rounded-xl text-xs font-medium border border-sky-100 dark:border-sky-800/50 shadow-sm">
          Ingresa <strong className="font-bold text-sky-950 dark:text-sky-300">Densidad Objetivo</strong> para saber cuántos granos necesitas, o ingresa <strong className="font-bold text-sky-950 dark:text-sky-300">Granos Usados</strong> para estimar tu densidad resultante.
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <InputGroup
              label="Volumen Final"
              value={recipeVol}
              onChange={(v) => setRecipeVol(sanitizePositiveNumber(v, 250))}
              unit="L"
            />
          </div>
          <InputGroup
            label="Densidad Objetivo"
            value={recipeTargetOg}
            onChange={(v) => setRecipeTargetOg(sanitizeGravity(v, 1.05))}
            step="0.001"
          />
          <ResultCard
            title="Total Granos"
            value={grainBillKg.toFixed(2)}
            unit="kg"
            subtext={`Eficiencia efectiva: ${(recipeEfficiency * (maltPotential / 300)).toFixed(1)}%`}
            colorClass="text-amber-500"
          />
          <InputGroup
            label="Granos Usados"
            value={recipeInputKg}
            onChange={(v) => setRecipeInputKg(sanitizePositiveNumber(v, 55))}
            unit="kg"
          />
          <ResultCard
            title="Densidad Estimada"
            value={estimatedOg.toFixed(3)}
            colorClass="text-sky-500"
          />
        </div>
      </SectionCard>
    </>
  );
};
