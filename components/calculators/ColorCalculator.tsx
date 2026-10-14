import React, { useState } from 'react';
import { SectionCard, InputGroup } from './Shared';
import { PlusCircle, Trash2 } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const ColorCalculator: React.FC = () => {
  const [colorMaltEntries, setColorMaltEntries] = useState<{id: string, name: string, lovibond: number, kg: number}[]>([
    { id: '1', name: 'Pilsen', lovibond: 2, kg: 40 },
    { id: '2', name: 'Caramelo 60', lovibond: 60, kg: 5 },
  ]);
  const [colorVolume, setColorVolume] = useState<number>(250);

  const calculateColor = () => {
    let totalMCU = 0;
    colorMaltEntries.forEach(m => {
      const mcu = (m.lovibond * m.kg * 2.20462) / (colorVolume * 0.264172); // Convert to gallons
      totalMCU += mcu;
    });
    const srm = 1.4922 * Math.pow(totalMCU, 0.6859);
    const ebc = srm * 1.97;
    return { srm: Math.min(srm, 40).toFixed(1), ebc: ebc.toFixed(1), mcu: totalMCU.toFixed(1) };
  };

  const getSRMColor = (srm: number): string => {
    const colors: Record<number, string> = {
      1: '#FFE699', 2: '#FFD878', 3: '#FFCA5A', 4: '#FFBF42', 5: '#FBB123',
      6: '#F8A600', 7: '#F39C00', 8: '#EA8F00', 9: '#E58500', 10: '#DE7C00',
      11: '#D77200', 12: '#CF6900', 13: '#CB6200', 14: '#C35900', 15: '#BB5100',
      16: '#B54C00', 17: '#B04500', 18: '#A63E00', 19: '#A13700', 20: '#9B3200',
      25: '#7C2900', 30: '#5E1E00', 35: '#401500', 40: '#261000'
    };
    const keys = Object.keys(colors).map(Number).sort((a,b) => a-b);
    let closest = keys[0];
    for (const k of keys) { if (k <= srm) closest = k; }
    return colors[closest] || '#1A0A00';
  };

  const color = calculateColor();
  const srmNum = parseFloat(color.srm);

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">Estima el color final de tu cerveza según los granos (Fórmula Morey).</div>
      <SectionCard title="Volumen">
          <InputGroup label="Volumen Final" value={colorVolume} onChange={setColorVolume} unit="L" />
      </SectionCard>
      <SectionCard title="Granos">
          <div className="space-y-3">
              {colorMaltEntries.map((m) => (
                  <div key={m.id} className="flex gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl items-end">
                      <div className="flex-1">
                          <label className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Nombre</label>
                          <DebouncedInput type="text" value={m.name || ''} onDebouncedChange={(val) => setColorMaltEntries(colorMaltEntries.map(x => x.id === m.id ? {...x, name: val} : x))} className="w-full p-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm bg-white dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100" />
                      </div>
                      <div className="w-20">
                          <label className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">°L</label>
                          <DebouncedInput type="number" value={m.lovibond || ''} onDebouncedChange={(val) => setColorMaltEntries(colorMaltEntries.map(x => x.id === m.id ? {...x, lovibond: val === '' ? '' as any : parseFloat(val)} : x))} className="w-full p-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono bg-white dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100" />
                      </div>
                      <div className="w-20">
                          <label className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">Kg</label>
                          <DebouncedInput type="number" value={m.kg || ''} onDebouncedChange={(val) => setColorMaltEntries(colorMaltEntries.map(x => x.id === m.id ? {...x, kg: val === '' ? '' as any : parseFloat(val)} : x))} className="w-full p-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono bg-white dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100" />
                      </div>
                      <button onClick={() => setColorMaltEntries(colorMaltEntries.filter(x => x.id !== m.id))} className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 mb-1"><Trash2 size={16} /></button>
                  </div>
              ))}
              <button onClick={() => setColorMaltEntries([...colorMaltEntries, { id: crypto.randomUUID(), name: 'Malta', lovibond: 5, kg: 1 }])} className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700/80 text-zinc-500 dark:text-zinc-400 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/60 flex items-center justify-center gap-2 text-sm">
                  <PlusCircle size={16} /> Agregar Grano
              </button>
          </div>
      </SectionCard>

      {/* Color Preview */}
      <div className="bg-zinc-900 dark:bg-zinc-950 rounded-xl p-6 text-center mb-4 border border-zinc-900/60">
          <div className="w-24 h-24 rounded-full mx-auto mb-3 shadow-lg border-4 border-zinc-700/80" style={{ backgroundColor: getSRMColor(srmNum) }} />
          <div className="flex justify-center gap-8">
              <div><p className="text-zinc-400 text-xs uppercase font-bold">SRM</p><p className="text-2xl font-bold font-mono text-amber-400">{color.srm}</p></div>
              <div><p className="text-zinc-400 text-xs uppercase font-bold">EBC</p><p className="text-2xl font-bold font-mono text-amber-300">{color.ebc}</p></div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">MCU Total: {color.mcu}</p>
      </div>
    </>
  );
};
