import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const PitchCalculator = () => {
  const [pitchOg, setPitchOg] = useState<number>(1.050);
  const [batchVol, setBatchVol] = useState<number>(250);
  const [yeastType, setYeastType] = useState<'ALE' | 'LAGER'>('ALE');
  const [cellCount, setCellCount] = useState<number>(200);

  const calculatePitch = () => {
    const plato = (pitchOg - 1) * 250; 
    let targetRate = yeastType === 'ALE' ? 0.75 : 1.5;
    if (pitchOg > 1.060) {
      targetRate = yeastType === 'ALE' ? 1.0 : 2.0;
    }
    const totalCellsNeeded = targetRate * (batchVol * 1000) * plato; 
    const packsNeeded = (totalCellsNeeded / 1000) / (cellCount); 
    return {
      cells: (totalCellsNeeded / 1000).toFixed(1), 
      packs: packsNeeded.toFixed(1)
    };
  };

  const pitch = calculatePitch();
  return (
          <>
            <div className="mb-5 bg-sky-50 dark:bg-sky-900/20 text-sky-900 dark:text-sky-400 p-4 rounded-xl text-xs font-medium border border-sky-100 dark:border-sky-800/50 shadow-sm">
              Calcula inoculación basada en densidad (Plato) y volumen.
            </div>
            
            <SectionCard title="Detalles del Lote">
                <div className="grid grid-cols-2 gap-4">
                    <InputGroup label="Volumen Lote" value={batchVol} onChange={setBatchVol} unit="L" />
                    <InputGroup label="Densidad (OG)" value={pitchOg} onChange={setPitchOg} step="0.001" />
                </div>
            </SectionCard>
            
            <SectionCard title="Levadura">
                <div className="space-y-3">
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 dark:text-zinc-400 mb-1.5 uppercase tracking-wider">Tipo Cepa</label>
                        <div className="flex gap-3">
                            <button onClick={()=>setYeastType('ALE')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${yeastType === 'ALE' ? 'bg-copper text-white border-copper shadow-md' : 'bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-800/80'}`}>ALE</button>
                            <button onClick={()=>setYeastType('LAGER')} className={`flex-1 py-3 rounded-xl border-2 font-bold text-sm transition-all ${yeastType === 'LAGER' ? 'bg-copper text-white border-copper shadow-md' : 'bg-slate-50 dark:bg-zinc-900/60 text-slate-600 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/80 hover:bg-slate-100 dark:hover:bg-zinc-800/80'}`}>LAGER</button>
                        </div>
                    </div>
                    <InputGroup label="Células/Paquete" value={cellCount} onChange={setCellCount} unit="Billones" />
                </div>
            </SectionCard>

            <div className="grid grid-cols-2 gap-4">
              <ResultCard title="Células Necesarias" value={pitch.cells} unit="B" colorClass="text-amber-400" />
              <ResultCard title="Paquetes (Estimado)" value={pitch.packs} unit="paq" colorClass="text-amber-400" />
            </div>
          </>
        );
};
