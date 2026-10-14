import React, { useState } from 'react';
import { SectionCard, InputGroup, ResultCard, WATER_PROFILES } from './Shared';
import { Info, Flame, Trash2, PlusCircle, Check } from 'lucide-react';
import { DebouncedInput } from '../ui/DebouncedInput';

export const CarbCalculator = () => {
  const [carbMode, setCarbMode] = useState<'QUICK' | 'EQUILIBRIUM'>('QUICK');
  const [carbTimeLeft, setCarbTimeLeft] = useState<number>(300);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [carbTemp, setCarbTemp] = useState<number>(4);
  const [carbVol, setCarbVol] = useState<number>(2.5);

  const calculateCarbPressure = () => {
    // Standard Regression Formula (approximate) in PSI
    // P = -16.6999 - 0.0101059*T + 0.00116512*T^2 + 0.173354*T*V + 4.24267*V - 0.0684226*V^2
    const T = (carbTemp * 9/5) + 32; // Convert C to F
    const V = carbVol;
    
    const psi = -16.6999 - (0.0101059 * T) + (0.00116512 * Math.pow(T, 2)) + (0.173354 * T * V) + (4.24267 * V) - (0.0684226 * Math.pow(V, 2));
    
    const psiVal = Math.max(0, psi);
    const barVal = psiVal * 0.0689476;
    
    return {
        psi: psiVal.toFixed(1),
        bar: barVal.toFixed(2)
    };
  };
const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const pressure = calculateCarbPressure();
  return (
          <div className="space-y-6">
             <div className="flex bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl mb-4">
                 <button 
                    onClick={() => setCarbMode('QUICK')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${carbMode === 'QUICK' ? 'bg-white dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 shadow' : 'text-zinc-500 dark:text-zinc-400'}`}
                 >
                    RÁPIDO (Agitado)
                 </button>
                 <button 
                    onClick={() => setCarbMode('EQUILIBRIUM')}
                    className={`flex-1 py-2 text-xs font-bold rounded-md transition ${carbMode === 'EQUILIBRIUM' ? 'bg-white dark:bg-zinc-900/60 text-amber-600 dark:text-amber-400 shadow' : 'text-zinc-500 dark:text-zinc-400'}`}
                 >
                    LENTO (Equilibrio)
                 </button>
             </div>

             {carbMode === 'QUICK' ? (
                <div className="text-center space-y-8 py-2">
                     <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-amber-900 dark:text-amber-200 text-sm text-left border border-amber-100 dark:border-amber-800 shadow-sm">
                        <div className="flex items-start gap-2 mb-2">
                            <Info className="shrink-0 mt-1" size={16} />
                            <h4 className="font-bold">Método Ross (Shake & Bake)</h4>
                        </div>
                        <ol className="list-decimal ml-8 space-y-2 text-xs">
                            <li>Enfría el barril a temperatura de servicio.</li>
                            <li>Conecta CO2 a <strong>2.4 BAR (35 PSI)</strong>.</li>
                            <li>Pon el barril de costado y <strong>agita vigorosamente</strong> mientras corre el tiempo.</li>
                            <li>Al sonar la alarma: <strong>BAJA la presión</strong> o desconecta.</li>
                            <li>Deja reposar 24hs para estabilizar la espuma.</li>
                        </ol>
                        <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-700 text-xs font-bold text-amber-800 dark:text-amber-300">
                            ⚠️ Advertencia: Si dejas 2.4 Bar conectados por 24hs sin bajar, tendrás una cerveza sobrecarbonatada (Explosiva).
                        </div>
                     </div>

                     <div className="relative w-48 h-48 mx-auto flex items-center justify-center">
                        <div className={`absolute inset-0 rounded-full border-4 ${isTimerRunning ? 'border-amber-500 animate-pulse' : 'border-zinc-200 dark:border-zinc-900/60'}`}></div>
                        <div className="text-5xl font-bold text-zinc-900 dark:text-zinc-100 font-mono">
                            {formatTime(carbTimeLeft)}
                        </div>
                     </div>

                     <div className="flex gap-4 justify-center">
                        {!isTimerRunning ? (
                            <button 
                                onClick={() => setIsTimerRunning(true)}
                                className="bg-green-500 hover:bg-green-600 text-white px-8 py-3 rounded-full font-bold shadow-lg transition transform active:scale-95"
                            >
                                {carbTimeLeft < 300 ? 'Reanudar' : 'Iniciar 5 Min'}
                            </button>
                        ) : (
                            <button 
                                onClick={() => setIsTimerRunning(false)}
                                className="bg-amber-500 hover:bg-amber-600 text-white px-8 py-3 rounded-full font-bold shadow-lg"
                            >
                                Pausar
                            </button>
                        )}
                         <button 
                                onClick={() => {setIsTimerRunning(false); setCarbTimeLeft(300)}}
                                className="bg-zinc-200 hover:bg-zinc-300 text-zinc-900/60 px-4 py-3 rounded-full font-bold"
                            >
                                Reset
                        </button>
                     </div>
                </div>
             ) : (
                <>
                    <div className="mb-4 text-sm text-zinc-700/80 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900/60/30 p-3 rounded-xl border-2 transition-all border-zinc-100 dark:border-zinc-700/80">
                        Cálculo científico (Ley de Henry). Configura el regulador a esta presión y espera 5-7 días (o usa piedra difusora).
                    </div>
                    
                    <SectionCard title="Variables">
                        <div className="grid grid-cols-2 gap-4">
                            <InputGroup label="Temperatura Cerveza" value={carbTemp} onChange={setCarbTemp} unit="°C" step="0.5" />
                            <InputGroup label="Volúmenes CO2 Deseados" value={carbVol} onChange={setCarbVol} step="0.1" />
                        </div>
                        <div className="mt-2 flex gap-2 overflow-x-auto pb-2">
                           {[2.0, 2.3, 2.5, 2.8, 3.0].map(v => (
                               <button key={v} onClick={() => setCarbVol(v)} className="px-3 py-1 bg-zinc-100 dark:bg-zinc-900/60 text-xs rounded-xl hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-700/80 dark:text-zinc-300 whitespace-nowrap">
                                   {v} Vol
                               </button>
                           ))}
                        </div>
                    </SectionCard>

                    <div className="grid grid-cols-2 gap-4">
                        <ResultCard title="Presión PSI" value={pressure.psi} unit="PSI" colorClass="text-zinc-300"/>
                        <ResultCard title="Presión BARES" value={pressure.bar} unit="Bar" colorClass="text-zinc-200" />
                    </div>
                    
                    <div className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 text-center">
                        Basado en fórmula de regresión estándar ASBC.
                    </div>
                </>
             )}
          </div>
        );
};
