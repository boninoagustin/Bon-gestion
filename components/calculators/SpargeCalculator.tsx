import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { DebouncedInput } from '../ui/DebouncedInput';

export const SpargeCalculator: React.FC = () => {
  const [spargeTotalWater, setSpargeTotalWater] = useState<number>(450);
  const [spargeGrainKg, setSpargeGrainKg] = useState<number>(85);
  const [spargeMashRatio, setSpargeMashRatio] = useState<number>(3.0);
  const [spargeAbsorbtion, setSpargeAbsorbtion] = useState<number>(1.0);
  const [spargeDeadSpace, setSpargeDeadSpace] = useState<number>(25);

  const calculateSparge = () => {
    const mashVol = spargeGrainKg * spargeMashRatio;
    const absorbed = spargeGrainKg * spargeAbsorbtion;
    const preSpargeVol = mashVol - absorbed - spargeDeadSpace;
    const spargeVol = spargeTotalWater - mashVol;
    const boilVol = preSpargeVol + spargeVol;

    return {
      mashVol: mashVol.toFixed(1),
      spargeVol: spargeVol > 0 ? spargeVol.toFixed(1) : "0.0",
      boilVol: boilVol > 0 ? boilVol.toFixed(1) : "0.0",
      absorbed: absorbed.toFixed(1)
    };
  };

  const current = calculateSparge();

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">Calcula los volúmenes de agua para el empaste y el lavado del grano.</div>
      <SectionCard title="Configuración de Receta">
          <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Agua Total Necesaria" value={spargeTotalWater} onChange={setSpargeTotalWater} unit="L" />
              <InputGroup label="Total de Granos" value={spargeGrainKg} onChange={setSpargeGrainKg} unit="kg" />
          </div>
      </SectionCard>
      
      <SectionCard title="Parámetros de Macerado">
          <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Relación Empaste" value={spargeMashRatio} onChange={setSpargeMashRatio} step="0.1" unit="L/kg" />
              <InputGroup label="Absorción Grano" value={spargeAbsorbtion} onChange={setSpargeAbsorbtion} step="0.1" unit="L/kg" />
              <div className="col-span-2">
                  <InputGroup label="Falso Fondo / Pérdidas" value={spargeDeadSpace} onChange={setSpargeDeadSpace} step="0.5" unit="L" />
              </div>
          </div>
      </SectionCard>

      <SectionCard title="Distribución de Agua">
          <div className="grid grid-cols-2 gap-4 mb-4">
              <ResultCard title="Agua Macerado (Mash)" value={current.mashVol} unit="L" colorClass="text-sky-400" />
              <ResultCard title="Agua Lavado (Sparge)" value={current.spargeVol} unit="L" colorClass="text-amber-400" />
              <div className="col-span-2">
                 <ResultCard title="Volumen Pre-Hervor" value={current.boilVol} unit="L" colorClass="text-green-400" />
              </div>
          </div>
          <div className="bg-zinc-50 dark:bg-zinc-900/60 p-3 rounded-xl text-xs text-zinc-500 dark:text-zinc-400">
              * El grano absorberá {current.absorbed}L y se perderán {spargeDeadSpace}L en el falso fondo.
          </div>
      </SectionCard>
    </>
  );
};
