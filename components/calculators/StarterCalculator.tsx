import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';

export const StarterCalculator: React.FC = () => {
  const [starterVol, setStarterVol] = useState<number>(2);
  const [starterGravity, setStarterGravity] = useState<number>(1.036);

  const calculateStarter = () => {
    const plato = (starterGravity - 1) * 1000 / 4; 
    const dmeGrams = starterVol * 10 * plato; 
    return {
      dme: dmeGrams.toFixed(0),
      water: starterVol.toFixed(2)
    };
  };

  const current = calculateStarter();

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">Calcula la cantidad de Extracto de Malta Seco (DME) para preparar tu starter de levadura.</div>
      <SectionCard title="Parámetros del Starter">
          <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Volumen Starter" value={starterVol} onChange={setStarterVol} step="0.1" unit="L" />
              <InputGroup label="Densidad Objetivo" value={starterGravity} onChange={setStarterGravity} step="0.001" />
          </div>
      </SectionCard>
      
      <SectionCard title="Preparación">
          <div className="bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 p-4 rounded-xl border border-amber-100 dark:border-amber-800 mb-4">
              <h4 className="font-bold mb-2">Instrucciones:</h4>
              <ol className="list-decimal list-inside text-sm space-y-1">
                  <li>Pesar <strong className="font-bold">{current.dme}g</strong> de DME.</li>
                  <li>Agregar agua hasta alcanzar <strong className="font-bold">{current.water}L</strong> totales.</li>
                  <li>Hervir por 10-15 minutos.</li>
                  <li>Enfriar a temperatura de inoculación.</li>
              </ol>
          </div>
          <div className="grid grid-cols-2 gap-4">
             <ResultCard title="DME Necesario" value={current.dme} unit="g" colorClass="text-amber-500" />
             <ResultCard title="Volumen Total" value={current.water} unit="L" colorClass="text-sky-500" />
          </div>
      </SectionCard>
    </>
  );
};
