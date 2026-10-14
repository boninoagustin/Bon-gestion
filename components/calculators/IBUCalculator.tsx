import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard } from './Shared';
import { PlusCircle, Trash2 } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

type HopAddition = {
  id: string;
  amount: number; // grams
  alpha: number; // %AA
  time: number; // minutes
  type: 'BOIL' | 'HOPSTAND' | 'DRY_HOP';
};

export const IBUCalculator: React.FC = () => {
  const [ibuBoilVol, setIbuBoilVol] = useState<number>(300);
  const [ibuGravity, setIbuGravity] = useState<number>(1.050);
  const [hopAdditions, setHopAdditions] = useState<HopAddition[]>([
    { id: '1', amount: 50, alpha: 12.5, time: 60, type: 'BOIL' }
  ]);

  const calculateTotalIBU = () => {
    if (!Number.isFinite(ibuBoilVol) || ibuBoilVol <= 0) return '0.0';
    let totalIBU = 0;
    hopAdditions.forEach(hop => {
        if (hop.type === 'DRY_HOP') return; // 0 IBU
        const bignessFactor = 1.65 * Math.pow(0.000125, ibuGravity - 1);
        const timeFactor = (1 - Math.exp(-0.04 * hop.time)) / 4.15;
        let utilization = bignessFactor * timeFactor;
        if (hop.type === 'HOPSTAND') {
            utilization = utilization * 0.5; 
        }
        const ibu = (utilization * (hop.amount * hop.alpha * 10)) / ibuBoilVol;
        totalIBU += ibu;
    });
    if (ibuGravity > 1.050) {
      const fc = 1 + (ibuGravity - 1.050) / 0.2;
      totalIBU = totalIBU / fc;
    }
    return totalIBU.toFixed(1);
  };

  const addHopRow = () => {
    const newId = crypto.randomUUID();
    setHopAdditions([...hopAdditions, { id: newId, amount: 10, alpha: 5, time: 10, type: 'BOIL' }]);
  };

  const removeHopRow = (id: string) => {
    setHopAdditions(hopAdditions.filter(h => h.id !== id));
  };

  const updateHopRow = (id: string, field: keyof HopAddition, value: string | number) => {
    setHopAdditions(hopAdditions.map(h => h.id === id ? { ...h, [field]: value } : h));
  };

  return (
    <>
      <div className="mb-4 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-400 p-4 rounded-xl text-xs border border-amber-100 dark:border-amber-800/50 shadow-sm">
         <strong>Calculadora Multi-etapa:</strong>
         <ul className="mt-2 ml-4 list-disc space-y-1 font-medium">
             <li><strong>Boil:</strong> Tinseth Estándar.</li>
             <li><strong>Hopstand:</strong> Tinseth x 0.5 (Simula 80-90°C).</li>
             <li><strong>Dry Hop:</strong> 0 IBU (Solo aroma).</li>
         </ul>
      </div>

      <SectionCard title="Configuración Base">
          <div className="grid grid-cols-2 gap-4">
              <InputGroup label="Volumen Hervor" value={ibuBoilVol} onChange={setIbuBoilVol} unit="L" />
              <InputGroup label="Densidad Hervor" value={ibuGravity} onChange={setIbuGravity} step="0.001" />
          </div>
      </SectionCard>

      <SectionCard title="Adiciones de Lúpulo">
          <div className="space-y-3">
              {hopAdditions.map((hop, idx) => (
                  <div key={hop.id} className="flex flex-col gap-3 p-4 bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800/80 rounded-xl relative shadow-sm transition-all">
                      <div className="flex gap-3">
                          <div className="w-1/3">
                              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5 block">Gramos</label>
                              <DebouncedInput type="number" value={hop.amount || ''} onDebouncedChange={(val)=>updateHopRow(hop.id, 'amount', val === '' ? '' : parseFloat(val))} className="w-full p-2.5 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all" />
                          </div>
                          <div className="w-1/3">
                              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5 block">% AA</label>
                              <DebouncedInput type="number" value={hop.alpha || ''} onDebouncedChange={(val)=>updateHopRow(hop.id, 'alpha', val === '' ? '' : parseFloat(val))} className="w-full p-2.5 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all" />
                          </div>
                          <div className="w-1/3">
                              <label className="text-[10px] font-bold text-slate-500 dark:text-zinc-500 uppercase tracking-wider mb-1.5 block">Minutos</label>
                              <DebouncedInput type="number" value={hop.time || ''} onDebouncedChange={(val)=>updateHopRow(hop.id, 'time', val === '' ? '' : parseFloat(val))} className="w-full p-2.5 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono font-bold bg-white dark:bg-zinc-800/50 text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all" />
                          </div>
                      </div>
                      <div className="flex gap-3 items-center mt-1">
                          <div className="flex-1">
                              <select 
                                  value={hop.type} 
                                  onChange={(e) => updateHopRow(hop.id, 'type', e.target.value)}
                                  className="w-full p-2.5 text-sm font-medium bg-white dark:bg-zinc-800/50 border border-slate-200 dark:border-zinc-700/80 rounded-xl text-slate-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none transition-all"
                              >
                                  <option value="BOIL">Hervor (Boil)</option>
                                  <option value="HOPSTAND">Hopstand/Whirlpool</option>
                                  <option value="DRY_HOP">Dry Hop</option>
                              </select>
                          </div>
                          <button onClick={()=>removeHopRow(hop.id)} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1">
                              <Trash2 size={18} />
                          </button>
                      </div>
                  </div>
              ))}
              <button onClick={addHopRow} className="w-full py-3 border-2 border-dashed border-slate-200 dark:border-zinc-700/80 text-slate-500 dark:text-zinc-400 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 flex items-center justify-center gap-2 text-sm font-bold transition-all">
                  <PlusCircle size={18} /> Agregar Lúpulo
              </button>
          </div>
      </SectionCard>

      <ResultCard title="Amargor Total" value={calculateTotalIBU()} unit="IBUs" colorClass="text-green-400" />
    </>
  );
};
