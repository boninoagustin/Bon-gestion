import React, { useState, useMemo } from 'react';
import { SectionCard, InputGroup } from './Shared';
import { PlusCircle, Trash2 } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';
import {
  calculateMoreyColor,
  MaltColorAdditionInput,
  sanitizePositiveNumber,
} from '../../lib/brewmath';

interface MaltColorEntry extends MaltColorAdditionInput {
  id: string;
  name: string;
}

export const ColorCalculator: React.FC = () => {
  const [colorMaltEntries, setColorMaltEntries] = useState<MaltColorEntry[]>([
    { id: '1', name: 'Pilsen', lovibond: 2, kg: 40 },
    { id: '2', name: 'Caramelo 60', lovibond: 60, kg: 5 },
  ]);
  const [colorVolume, setColorVolume] = useState<number>(250);

  const color = useMemo(
    () => calculateMoreyColor(colorMaltEntries, colorVolume),
    [colorMaltEntries, colorVolume]
  );

  return (
    <>
      <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400">
        Estima el color final de tu cerveza según los granos (Fórmula de Dan Morey).
      </div>
      <SectionCard title="Volumen">
        <InputGroup
          label="Volumen Final"
          value={colorVolume}
          onChange={(v) => setColorVolume(sanitizePositiveNumber(v, 250))}
          unit="L"
        />
      </SectionCard>
      <SectionCard title="Granos">
        <div className="space-y-3">
          {colorMaltEntries.map((m) => (
            <div
              key={m.id}
              className="flex gap-2 p-3 bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-700/80 rounded-xl items-end"
            >
              <div className="flex-1">
                <label className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">
                  Nombre
                </label>
                <DebouncedInput
                  type="text"
                  value={m.name}
                  onDebouncedChange={(val) =>
                    setColorMaltEntries((prev) =>
                      prev.map((x) => (x.id === m.id ? { ...x, name: val } : x))
                    )
                  }
                  className="w-full p-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm bg-white dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div className="w-20">
                <label className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">
                  °L
                </label>
                <DebouncedInput
                  type="text"
                  inputMode="decimal"
                  value={m.lovibond}
                  onDebouncedChange={(val) =>
                    setColorMaltEntries((prev) =>
                      prev.map((x) =>
                        x.id === m.id
                          ? { ...x, lovibond: sanitizePositiveNumber(val, 0, 1000) }
                          : x
                      )
                    )
                  }
                  className="w-full p-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono bg-white dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100"
                />
              </div>
              <div className="w-20">
                <label className="text-[10px] text-zinc-400 dark:text-zinc-500 uppercase">
                  Kg
                </label>
                <DebouncedInput
                  type="text"
                  inputMode="decimal"
                  value={m.kg}
                  onDebouncedChange={(val) =>
                    setColorMaltEntries((prev) =>
                      prev.map((x) =>
                        x.id === m.id
                          ? { ...x, kg: sanitizePositiveNumber(val, 0, 10000) }
                          : x
                      )
                    )
                  }
                  className="w-full p-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl text-sm font-mono bg-white dark:bg-zinc-900/60 text-zinc-950 dark:text-zinc-100"
                />
              </div>
              <button
                onClick={() =>
                  setColorMaltEntries((prev) => prev.filter((x) => x.id !== m.id))
                }
                className="text-red-400 hover:text-red-600 dark:hover:text-red-300 p-1 mb-1"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              setColorMaltEntries((prev) => [
                ...prev,
                {
                  id:
                    typeof crypto !== 'undefined' && crypto.randomUUID
                      ? crypto.randomUUID()
                      : String(Date.now()),
                  name: 'Malta',
                  lovibond: 5,
                  kg: 1,
                },
              ])
            }
            className="w-full py-2 border border-dashed border-zinc-300 dark:border-zinc-700/80 text-zinc-500 dark:text-zinc-400 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-900/60 flex items-center justify-center gap-2 text-sm"
          >
            <PlusCircle size={16} /> Agregar Grano
          </button>
        </div>
      </SectionCard>

      <div className="bg-zinc-900 dark:bg-zinc-950 rounded-xl p-6 text-center mb-4 border border-zinc-900/60">
        <div
          className="w-24 h-24 rounded-full mx-auto mb-3 shadow-lg border-4 border-zinc-700/80"
          style={{ backgroundColor: color.hexColor }}
        />
        <div className="flex justify-center gap-8">
          <div>
            <p className="text-zinc-400 text-xs uppercase font-bold">SRM</p>
            <p className="text-2xl font-bold font-mono text-amber-400">
              {color.srm.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-zinc-400 text-xs uppercase font-bold">EBC</p>
            <p className="text-2xl font-bold font-mono text-amber-300">
              {color.ebc.toFixed(1)}
            </p>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-2">
          MCU Total: {color.mcu.toFixed(1)}
        </p>
      </div>
    </>
  );
};
