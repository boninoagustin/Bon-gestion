import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const AcidCalculator = () => {
  const [acidVol, setAcidVol] = useState<number>(300);
  const [acidAlkalinity, setAcidAlkalinity] = useState<number>(100);
  const [acidTargetPh, setAcidTargetPh] = useState<number>(5.4);
  const [acidType, setAcidType] = useState<'CITRIC' | 'LACTIC' | 'PHOSPHORIC'>('CITRIC');

  const calculateAcid = () => {
    // Logic: To drop pH to ~5.4, we need to neutralize roughly 90% of alkalinity.
    // Factors:
    // Citric Acid Monohydrate: ~0.21g per Liter neutralizes 100ppm Alkalinity
    // Lactic Acid 88%: ~0.12ml per Liter neutralizes 100ppm Alkalinity
    // Phosphoric Acid 85%: ~0.10ml per Liter neutralizes 100ppm Alkalinity (Variable buffering)
    
    // Adjustment for Target pH (Linear approx for brewing range 5.2 - 5.8)
    // Base target is neutralizing 100% of alkalinity for pH 5.2, 90% for 5.4, 70% for 5.6
    let neutralizationFactor = 0.9;
    if (acidTargetPh <= 5.2) neutralizationFactor = 1.0;
    else if (acidTargetPh >= 5.8) neutralizationFactor = 0.6;
    else neutralizationFactor = 1 - ((acidTargetPh - 5.2) / 0.6) * 0.4;

    const ppmToNeutralize = acidAlkalinity * neutralizationFactor;

    let amount = 0;
    let unit = "g";
    
    if (acidType === 'CITRIC') {
        // 0.0021 g per ppm per Liter
        amount = acidVol * ppmToNeutralize * 0.0021;
    } else if (acidType === 'LACTIC') {
        // 0.0012 ml per ppm per Liter
        amount = acidVol * ppmToNeutralize * 0.0012;
        unit = "ml";
    } else {
        // Phosphoric approx 0.001 ml per ppm per Liter
        amount = acidVol * ppmToNeutralize * 0.001;
        unit = "ml";
    }
    
    return { amount: amount.toFixed(1), unit };
  };

  const acidResult = calculateAcid();
  return (
            <>
                <div className="mb-5 bg-rose-50 dark:bg-rose-900/20 text-rose-900 dark:text-rose-300 p-4 shadow-sm rounded-xl text-xs border border-rose-100 dark:border-rose-800 flex items-start gap-2">
                    <Info size={16} className="shrink-0 mt-0.5" />
                    <div>
                        El cálculo depende de la <strong>Alcalinidad Residual</strong>. Si no tienes reporte de agua, usa referencias: RO=0, Blanda=50, Grifo=100+.
                    </div>
                </div>

                <SectionCard title="Agua a Tratar">
                    <div className="grid grid-cols-2 gap-4">
                        <InputGroup label="Volumen Agua" value={acidVol} onChange={setAcidVol} unit="L" />
                        <InputGroup label="Alcalinidad (HCO3)" value={acidAlkalinity} onChange={setAcidAlkalinity} unit="ppm" />
                    </div>
                    <div className="mt-3">
                        <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-1 uppercase tracking-wider">pH Objetivo</label>
                        <div className="flex items-center gap-3">
                            <input 
                                type="range" 
                                min="5.0" 
                                max="6.0" 
                                step="0.1" 
                                value={acidTargetPh} 
                                onChange={(e) => setAcidTargetPh(parseFloat(e.target.value))}
                                className="flex-1 h-2 bg-zinc-200 dark:bg-zinc-700/80 rounded-xl appearance-none cursor-pointer accent-rose-500"
                            />
                            <span className="font-mono font-bold text-lg text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/30 px-2 rounded">{acidTargetPh}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 mt-1">
                            <span>Macerado (5.2-5.4)</span>
                            <span>Lavado (5.5-5.8)</span>
                        </div>
                    </div>
                </SectionCard>

                <SectionCard title="Tipo de Ácido">
                    <div className="flex flex-col gap-2">
                        <button 
                            onClick={() => setAcidType('CITRIC')}
                            className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${acidType === 'CITRIC' ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-200 font-medium' : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'}`}
                        >
                            <span>Ácido Cítrico (Polvo)</span>
                            {acidType === 'CITRIC' && <Check size={16} />}
                        </button>
                        <button 
                            onClick={() => setAcidType('LACTIC')}
                            className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${acidType === 'LACTIC' ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-200 font-medium' : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'}`}
                        >
                            <span>Ácido Láctico 88%</span>
                            {acidType === 'LACTIC' && <Check size={16} />}
                        </button>
                        <button 
                            onClick={() => setAcidType('PHOSPHORIC')}
                            className={`p-3 rounded-xl border text-left text-sm flex justify-between items-center ${acidType === 'PHOSPHORIC' ? 'bg-rose-50 dark:bg-rose-900/30 border-rose-500 text-rose-900 dark:text-rose-200 font-medium' : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-700/80 text-zinc-700/80 dark:text-zinc-300'}`}
                        >
                            <span>Ácido Fosfórico 85%</span>
                            {acidType === 'PHOSPHORIC' && <Check size={16} />}
                        </button>
                    </div>
                </SectionCard>

                <ResultCard 
                    title="Cantidad a Agregar" 
                    value={acidResult.amount} 
                    unit={acidResult.unit} 
                    colorClass="text-rose-500"
                    subtext={`Neutraliza ~${Math.round(acidAlkalinity * (acidTargetPh <= 5.2 ? 1 : 0.9))} ppm de alcalinidad`}
                />
            </>
        );
};
