import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';

export const RecipeCalculator: React.FC = () => {
  const [recipeVol, setRecipeVol] = useState<number>(250);
  const [recipeTargetOg, setRecipeTargetOg] = useState<number>(1.050);
  const [recipeInputKg, setRecipeInputKg] = useState<number>(55);
  const [recipeEfficiency, setRecipeEfficiency] = useState<number>(75);
  const [maltPotential, setMaltPotential] = useState<number>(300);

  const calculateRecipeGrainBill = () => {
    const totalPoints = recipeVol * (recipeTargetOg - 1) * 1000;
    const effectivePotential = maltPotential * (recipeEfficiency / 100);
    if (effectivePotential <= 0) return '0';
    return (totalPoints / effectivePotential).toFixed(2);
  };

  const calculateRecipeMaltOG = () => {
    const effectivePotential = maltPotential * (recipeEfficiency / 100);
    if (recipeVol <= 0) return '1.000';
    const totalPoints = recipeInputKg * effectivePotential;
    const og = 1 + (totalPoints / recipeVol) / 1000;
    return og.toFixed(3);
  };

  return (
    <>
      <div className="mb-4 text-sm text-slate-600 dark:text-slate-400">
          Calcula kilos de malta base necesarios para alcanzar tu densidad objetivo, ajustado por eficiencia y calidad del grano.
      </div>
      
      <SectionCard title="Parámetros de Equipo">
          <div className="grid grid-cols-2 gap-4 mb-3">
             <InputGroup label="Eficiencia Equipo" value={recipeEfficiency} onChange={setRecipeEfficiency} unit="%" />
             <InputGroup label="Potencial Malta" value={maltPotential} onChange={setMaltPotential} unit="L°/kg" />
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-xs font-medium text-amber-900 dark:text-amber-400 border border-amber-100 dark:border-amber-800/50 shadow-sm">
             <strong className="font-bold text-amber-950 dark:text-amber-300">Potenciales típicos (L°/kg):</strong>
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
                 <InputGroup label="Volumen Final" value={recipeVol} onChange={setRecipeVol} unit="L" />
              </div>
              <InputGroup label="Densidad Objetivo" value={recipeTargetOg} onChange={setRecipeTargetOg} step="0.001" />
              <ResultCard 
                  title="Total Granos" 
                  value={calculateRecipeGrainBill()} 
                  unit="kg" 
                  subtext={`Eficiencia: ${(recipeEfficiency * (maltPotential/300)).toFixed(1)}%`}
                  colorClass="text-amber-500"
              />
              <InputGroup label="Granos Usados" value={recipeInputKg} onChange={setRecipeInputKg} unit="kg" />
              <ResultCard 
                  title="Densidad Estimada" 
                  value={calculateRecipeMaltOG()} 
                  colorClass="text-sky-500"
              />
          </div>
      </SectionCard>
    </>
  );
};
