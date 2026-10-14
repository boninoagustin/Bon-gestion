import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const RefractometerCalculator = () => {
  const [refracOGBrix, setRefracOGBrix] = useState<number>(12);
const [refracFGBrix, setRefracFGBrix] = useState<number>(6);
const [refracWCF, setRefracWCF] = useState<number>(1.04);

  const calculateRefractometer = () => {
    const ogBrix = refracOGBrix / refracWCF;
    const fgBrix = refracFGBrix / refracWCF;
    // Convert OG Brix to SG
    const ogSG = 1 + (ogBrix / (258.6 - ((ogBrix * 227.1) / 258.2)));
    // Sean Terrill correlation for FG with alcohol present
    const fgSG = 1.0000 - 0.0044993 * ogBrix + 0.011774 * fgBrix + 0.00027581 * Math.pow(ogBrix,2) - 0.0012717 * Math.pow(fgBrix,2) - 0.0000072800 * Math.pow(ogBrix,3) + 0.000063293 * Math.pow(fgBrix,3);
    const abv = ((ogSG - fgSG) * 131.25);
    const attenuation = ogSG > 1 ? ((ogSG - fgSG) / (ogSG - 1)) * 100 : 0;
    return {
      ogSG: ogSG.toFixed(3),
      fgSG: fgSG.toFixed(3),
      abv: abv.toFixed(1),
      attenuation: attenuation.toFixed(0)
    };
  };

  const refrac = calculateRefractometer();
  return (
          <>
            <div className="mb-5 bg-violet-50 dark:bg-violet-900/20 text-violet-900 dark:text-violet-300 p-4 shadow-sm rounded-xl text-xs border border-violet-100 dark:border-violet-800 flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>Corrige la lectura del refractómetro cuando hay <strong>alcohol presente</strong> (post-fermentación). Sin corrección, el refractómetro sobreestima la densidad final.</div>
            </div>
            <SectionCard title="Lecturas Brix">
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Brix Inicial (OG)" value={refracOGBrix} onChange={setRefracOGBrix} unit="°Bx" step="0.1" />
                    <InputGroup label="Brix Final (FG)" value={refracFGBrix} onChange={setRefracFGBrix} unit="°Bx" step="0.1" />
                </div>
                <div className="mt-2">
                    <InputGroup label="Factor Corrección (WCF)" value={refracWCF} onChange={setRefracWCF} step="0.01" />
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-500 -mt-2">Normalmente 1.04. Calibra con solución conocida si difiere.</p>
                </div>
            </SectionCard>
            <div className="grid grid-cols-2 gap-4 mb-4">
                <ResultCard title="OG Corregida" value={refrac.ogSG} colorClass="text-amber-400" />
                <ResultCard title="FG Corregida" value={refrac.fgSG} colorClass="text-violet-400" />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <ResultCard title="ABV" value={refrac.abv} unit="%" colorClass="text-green-400" />
                <ResultCard title="Atenuación" value={refrac.attenuation} unit="%" colorClass="text-sky-400" />
            </div>
          </>
        );
};
