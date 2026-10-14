import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const PrimingCalculator = () => {
  const [primingVol, setPrimingVol] = useState<number>(300);
const [primingTemp, setPrimingTemp] = useState<number>(20);
const [primingTargetCO2, setPrimingTargetCO2] = useState<number>(2.5);
const [primingSugarType, setPrimingSugarType] = useState<'TABLE' | 'DEXTROSE' | 'HONEY' | 'DME'>('TABLE');

  const calculatePriming = () => {
    // Residual CO2 at fermentation temp (approx)
    const residualCO2 = 3.0378 - (0.050062 * primingTemp) + (0.00026555 * Math.pow(primingTemp, 2));
    const neededCO2 = primingTargetCO2 - residualCO2;
    if (neededCO2 <= 0) return { sugar: '0', total: '0', perBottle: '0' };
    
    // Grams per liter for each sugar type
    let factor = 1;
    if (primingSugarType === 'TABLE') factor = 1; // Sucrose baseline
    if (primingSugarType === 'DEXTROSE') factor = 1.11; // ~10-15% moisture => 1/0.9
    if (primingSugarType === 'HONEY') factor = 1.25; // ~20% moisture => 1/0.8
    if (primingSugarType === 'DME') factor = 1.54; // DME is ~65% fermentable sugars
    
    const gramsPerLiter = neededCO2 * 4.0 * factor; // ~4g sucrose per vol CO2 per liter
    const totalGrams = gramsPerLiter * primingVol;
    const perBottle = (totalGrams / (primingVol / 0.33)).toFixed(1); // 330ml bottles
    
    return { sugar: gramsPerLiter.toFixed(1), total: totalGrams.toFixed(0), perBottle };
  };

  const priming = calculatePriming();
        const sugarLabels: Record<string, string> = { TABLE: 'Azúcar de Mesa', DEXTROSE: 'Dextrosa', HONEY: 'Miel', DME: 'Extracto Seco (DME)' };
  return (
          <>
            <div className="mb-5 bg-lime-50 dark:bg-lime-900/20 text-lime-900 dark:text-lime-300 p-4 shadow-sm rounded-xl text-xs border border-lime-100 dark:border-lime-800 flex items-start gap-2">
                <Info size={16} className="shrink-0 mt-0.5" />
                <div>Calcula la cantidad de azúcar para carbonatar en <strong>botella</strong>. La temperatura de fermentación determina el CO2 residual.</div>
            </div>
            <SectionCard title="Datos del Lote">
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Volumen a Embotellar" value={primingVol} onChange={setPrimingVol} unit="L" />
                    <InputGroup label="Temp. Máx Fermentación" value={primingTemp} onChange={setPrimingTemp} unit="°C" />
                </div>
                <InputGroup label="Volúmenes CO2 Deseados" value={primingTargetCO2} onChange={setPrimingTargetCO2} step="0.1" />
                <div className="flex gap-2 overflow-x-auto pb-2">
                   {[{v: 2.0, s: 'Stout'}, {v: 2.3, s: 'Ale'}, {v: 2.5, s: 'Lager'}, {v: 3.0, s: 'Weizen'}, {v: 3.5, s: 'Belga'}].map(p => (
                       <button key={p.v} onClick={() => setPrimingTargetCO2(p.v)} className={`px-3 py-1 text-xs rounded-xl whitespace-nowrap transition ${primingTargetCO2 === p.v ? 'bg-lime-500 text-white' : 'bg-zinc-100 dark:bg-zinc-900/60 text-zinc-700/80 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700/80'}`}>
                           {p.v} ({p.s})
                       </button>
                   ))}
                </div>
            </SectionCard>

            <SectionCard title="Tipo de Azúcar">
                <div className="flex flex-col gap-2">
                    {(['TABLE', 'DEXTROSE', 'HONEY', 'DME'] as const).map(t => (
                        <button key={t} onClick={() => setPrimingSugarType(t)} className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${primingSugarType === t ? 'bg-lime-50 dark:bg-lime-900/30 border-lime-500 text-lime-900 dark:text-lime-200 font-medium' : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'}`}>
                            <span>{sugarLabels[t]}</span>
                            {primingSugarType === t && <Check size={16} />}
                        </button>
                    ))}
                </div>
            </SectionCard>

            <div className="grid grid-cols-3 gap-3">
                <ResultCard title="g/Litro" value={priming.sugar} unit="g/L" colorClass="text-lime-400" />
                <ResultCard title="Total" value={priming.total} unit="g" colorClass="text-lime-400" />
                <ResultCard title="Por Botella" value={priming.perBottle} unit="g (330ml)" colorClass="text-lime-300" />
            </div>
          </>
        );
};
