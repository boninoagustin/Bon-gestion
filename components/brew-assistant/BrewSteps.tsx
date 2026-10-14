import React from 'react';
import { BrewSession, Batch, BrewStep, TimerLog } from '../../types';
import { useBreweryStore } from '../../context/store';
import { BrewTimer } from './BrewTimer';
import { PartigyleCalculator } from '../calculators/PartigyleCalculator';
import { WaterChemCalculator } from '../calculators/WaterChemCalculator';
import { StrikeCalculator } from '../calculators/StrikeCalculator';
import { AcidCalculator } from '../calculators/AcidCalculator';
import { SpargeCalculator } from '../calculators/SpargeCalculator';
import { KettleCalculator } from '../calculators/KettleCalculator';
import { IBUCalculator } from '../calculators/IBUCalculator';
import { DensityCalculator } from '../calculators/DensityCalculator';
import { EfficiencyCalculator } from '../calculators/EfficiencyCalculator';
import { DilutionCalculator } from '../calculators/DilutionCalculator';
import { PitchCalculator } from '../calculators/PitchCalculator';
import { StarterCalculator } from '../calculators/StarterCalculator';
import { DebouncedInput } from '../ui/DebouncedInput';
import { DebouncedTextarea } from '../ui/DebouncedInput';
import { Calculator } from 'lucide-react';

const CalculatorToggle = ({ title, description, children }: { title: string, description: string, children: React.ReactNode }) => {
  const [show, setShow] = React.useState(false);
  return (
    <div className="bg-white dark:bg-zinc-800 rounded-xl border border-slate-200 dark:border-zinc-700 shadow-sm overflow-hidden mb-6">
      <div className="flex justify-between items-center p-4">
        <div>
          <h4 className="font-bold text-slate-800 dark:text-slate-100">{title}</h4>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
        <button 
          onClick={() => setShow(!show)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-colors ${show ? 'bg-copper text-white' : 'bg-slate-100 dark:bg-zinc-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-600'}`}
        >
          <Calculator size={16} />
          {show ? 'Ocultar' : 'Calculadora'}
        </button>
      </div>
      {show && (
        <div className="p-4 border-t border-slate-100 dark:border-zinc-700 bg-slate-50/50 dark:bg-zinc-900/50 animate-in fade-in slide-in-from-top-4 duration-300">
          {children}
        </div>
      )}
    </div>
  );
};

/** Reusable notes field for any step */
const StepNotes = ({ value, onChange, placeholder }: { value: string, onChange: (v: string) => void, placeholder?: string }) => (
  <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
    <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Notas del Paso</label>
    <DebouncedTextarea
      className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-sm text-slate-800 dark:text-white min-h-[60px] resize-y outline-none focus:border-copper"
      placeholder={placeholder || "Ej: Se ajustó la temperatura manualmente..."}
      value={value || ''}
      onDebouncedChange={onChange}
    />
  </div>
);

export interface StepProps {
  session: BrewSession;
  batch: Batch;
  updateSession: (updates: Partial<BrewSession>) => void;
}

const updateMetrics = (session: BrewSession, updateSession: any, section: keyof BrewSession['metrics'], updates: any) => {
  updateSession({ metrics: { ...session.metrics, [section]: { ...session.metrics[section], ...updates } } });
};

const handleTimerStart = (session: BrewSession, updateSession: any, stepId: TimerLog['stepId']) => {
  const newTimer: TimerLog = { id: crypto.randomUUID(), stepId, startTime: Date.now(), accumulatedMs: 0 };
  updateSession({ timers: [...session.timers, newTimer] });
};

const handleTimerPause = (session: BrewSession, updateSession: any, stepId: TimerLog['stepId'], accumulatedMs: number) => {
  const nextTimers = session.timers.map(t => {
    if (t.stepId === stepId && !t.endTime && !t.isPaused) {
      return { ...t, isPaused: true, accumulatedMs };
    }
    return t;
  });
  updateSession({ timers: nextTimers });
};

const handleTimerResume = (session: BrewSession, updateSession: any, stepId: TimerLog['stepId'], accumulatedMs: number) => {
  const nextTimers = session.timers.map(t => {
    if (t.stepId === stepId && t.isPaused && !t.endTime) {
      return { ...t, isPaused: false, startTime: Date.now(), accumulatedMs };
    }
    return t;
  });
  updateSession({ timers: nextTimers });
};

const handleTimerStop = (session: BrewSession, updateSession: any, stepId: TimerLog['stepId'], elapsedMs: number) => {
  const nextTimers = session.timers.map(t => {
    if (t.stepId === stepId && !t.endTime) {
      return { ...t, endTime: Date.now(), durationMs: elapsedMs, isPaused: false };
    }
    return t;
  });
  updateSession({ timers: nextTimers });
};

/** Gets the active (most recent non-ended, or last ended) timer for a step */
const getTimerLog = (session: BrewSession, stepId: TimerLog['stepId']): TimerLog | undefined => {
  // First look for an active (non-ended) timer
  const active = session.timers.find(t => t.stepId === stepId && !t.endTime);
  if (active) return active;
  // Otherwise return the most recent completed one
  return session.timers.slice().reverse().find(t => t.stepId === stepId);
};

/** Check if a step has data (for sidebar completion indicator) */
export const isStepCompleted = (session: BrewSession, stepIndex: number): boolean => {
  const m = session.metrics;
  switch (stepIndex) {
    case 0: return m.milling.waterTreated || Object.values(session.ingredientsChecklist || {}).some(Boolean);
    case 1: return m.heating.waterVolume > 0 || m.heating.actualWaterTemp > 0;
    case 2: return m.mashIn.actualTemp > 0;
    case 3: return m.saccharification.iodineTest !== 'not_done' || m.saccharification.pH > 0;
    case 4: return m.mashOut.actualTemp > 0;
    case 5: return m.lautering.vorlauf.wortClear || m.lautering.sparge.volumeCollected > 0;
    case 6: return m.boil.postBoilVolume > 0;
    case 7: return session.timers.some(t => t.stepId === BrewStep.WHIRLPOOL && t.endTime);
    case 8: return m.cooling.volumeToFermenter > 0 || m.cooling.actualTemp > 0;
    case 9: return m.preFermentation.og > 0;
    case 10: return m.pitching.yeastName.length > 0 || m.pitching.chamberTemp > 0;
    case 11: return (session.notes || []).length > 0;
    default: return false;
  }
};

/** Common timer props builder */
const timerProps = (session: BrewSession, updateSession: any, stepId: TimerLog['stepId'], defaultMins?: number) => ({
  timerLog: getTimerLog(session, stepId),
  onStart: () => handleTimerStart(session, updateSession, stepId),
  onPause: (ms: number) => handleTimerPause(session, updateSession, stepId, ms),
  onResume: (ms: number) => handleTimerResume(session, updateSession, stepId, ms),
  onStop: (ms: number) => handleTimerStop(session, updateSession, stepId, ms),
  defaultDurationMinutes: defaultMins,
  alarmMuted: session.alarmMuted,
  onToggleMute: () => updateSession({ alarmMuted: !session.alarmMuted }),
});

export const Step01_Preparation: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.milling;
  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Ajuste de Química del Agua" description="Calculadora para tratar el agua (cloruros, sulfatos, etc).">
        <WaterChemCalculator />
      </CalculatorToggle>
      <BrewTimer 
        label="Cronómetro de Preparación" 
        {...timerProps(session, updateSession, BrewStep.PREPARATION)}
      />
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg">
          <input type="checkbox" className="w-5 h-5 accent-copper rounded border-slate-300" 
                 checked={m.waterTreated} 
                 onChange={e => updateMetrics(session, updateSession, 'milling', { waterTreated: e.target.checked })} />
          <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Agua de Macerado tratada y declorada</span>
        </label>
      </div>
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Checklist de Ingredientes</h4>
        <div className="space-y-3">
          {batch.ingredientsUsed.map((ing, idx) => {
            const isChecked = session.ingredientsChecklist?.[ing.inventoryId] || false;
            return (
              <label key={idx} className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${isChecked ? 'bg-copper/5 border-copper/20' : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 hover:border-copper/50'}`}>
                <div className="flex items-center gap-3">
                  <input 
                    type="checkbox" 
                    className="w-5 h-5 accent-copper rounded border-slate-300" 
                    checked={isChecked}
                    onChange={() => {
                      const current = session.ingredientsChecklist || {};
                      updateSession({ ingredientsChecklist: { ...current, [ing.inventoryId]: !isChecked } });
                    }}
                  />
                  <div>
                    <span className={`text-sm font-medium ${isChecked ? 'text-slate-500 line-through' : 'text-slate-700 dark:text-slate-300'}`}>{ing.name}</span>
                    <span className="block text-xs text-slate-400 capitalize">{ing.type.toLowerCase()}</span>
                  </div>
                </div>
                <span className={`font-mono text-sm font-bold ${isChecked ? 'text-slate-400 line-through' : 'text-copper'}`}>{ing.amountUsed} {ing.unit}</span>
              </label>
            );
          })}
        </div>
      </div>
      <StepNotes value={m.notes} onChange={v => updateMetrics(session, updateSession, 'milling', { notes: v })} />
    </div>
  );
};

export const Step02_Heating: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.heating;
  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Volumen de Olla (Kettle)" description="Estima cuánta agua necesitas cargar inicialmente.">
        <KettleCalculator />
      </CalculatorToggle>
      <CalculatorToggle title="Temperatura de Strike" description="Calcula a qué temperatura calentar el agua inicial.">
        <StrikeCalculator />
      </CalculatorToggle>
      <BrewTimer 
        label="Calentamiento de Agua (Strike)" 
        {...timerProps(session, updateSession, BrewStep.WATER_HEATING)}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Volumen de Agua (L)</label>
          <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                 value={m.waterVolume || ''} onDebouncedChange={v => {
                   const parsed = parseFloat(v.replace(',', '.'));
                   updateMetrics(session, updateSession, 'heating', { waterVolume: !isNaN(parsed) ? parsed : 0 });
                 }} />
        </div>
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temperatura Real Alcanzada (°C)</label>
          <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                 value={m.actualWaterTemp || ''} onDebouncedChange={v => {
                   const parsed = parseFloat(v.replace(',', '.'));
                   updateMetrics(session, updateSession, 'heating', { actualWaterTemp: !isNaN(parsed) ? parsed : 0 });
                 }} />
        </div>
      </div>
      <StepNotes value={m.notes || ''} onChange={v => updateMetrics(session, updateSession, 'heating', { notes: v })} />
    </div>
  );
};

export const Step03_MashIn: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.mashIn;
  return (
    <div className="space-y-6 animate-fade-in">
      <BrewTimer 
        label="Cronómetro Empaste" 
        {...timerProps(session, updateSession, BrewStep.MASH_IN)}
      />
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temperatura inicial de empaste (°C)</label>
        <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                value={m.actualTemp || ''} onDebouncedChange={v => {
                  const parsed = parseFloat(v.replace(',', '.'));
                  updateMetrics(session, updateSession, 'mashIn', { actualTemp: !isNaN(parsed) ? parsed : 0 });
                }} />
      </div>
      <StepNotes value={m.notes} onChange={v => updateMetrics(session, updateSession, 'mashIn', { notes: v })} />
    </div>
  );
};

export const Step04_Saccharification: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.saccharification;
  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Acidificación" description="Calculadora para reducir el pH si es necesario.">
        <AcidCalculator />
      </CalculatorToggle>
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 p-4 rounded-xl">
        <h4 className="text-sm font-bold text-blue-800 dark:text-blue-300 flex items-center gap-2 mb-1">⏰ Recordatorio</h4>
        <p className="text-xs text-blue-700 dark:text-blue-400">Comenzar a calentar el agua de lavado (aprox. 76°C) para tenerla lista al terminar este paso.</p>
      </div>

      <BrewTimer 
        label="Maceración (Sacarificación)" 
        {...timerProps(session, updateSession, BrewStep.MASHING, 60)}
      />
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">pH del Macerado</label>
          <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                  placeholder="Ej: 5.3"
                  value={m.pH || ''} onDebouncedChange={v => {
                    const parsed = parseFloat(v.replace(',', '.'));
                    updateMetrics(session, updateSession, 'saccharification', { pH: !isNaN(parsed) ? parsed : 0 });
                  }} />
          <p className="text-[11px] text-slate-400 mt-1">Rango ideal: 5.2 – 5.6</p>
        </div>
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Test de Yodo</label>
          <select className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white"
                  value={m.iodineTest} onChange={e => updateMetrics(session, updateSession, 'saccharification', { iodineTest: e.target.value })}>
            <option value="not_done">No realizado</option>
            <option value="positive">Positivo (Almidón presente)</option>
            <option value="negative">Negativo (Conversión completa)</option>
          </select>
        </div>
      </div>
      <StepNotes value={m.notes || ''} onChange={v => updateMetrics(session, updateSession, 'saccharification', { notes: v })} />
    </div>
  );
};

export const Step05_MashOut: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.mashOut;
  return (
    <div className="space-y-6 animate-fade-in">
      <BrewTimer 
        label="Mash Out" 
        {...timerProps(session, updateSession, BrewStep.MASH_OUT, 10)}
      />
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temp Mash Out Alcanzada (°C)</label>
        <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                value={m.actualTemp || ''} onDebouncedChange={v => {
                  const parsed = parseFloat(v.replace(',', '.'));
                  updateMetrics(session, updateSession, 'mashOut', { actualTemp: !isNaN(parsed) ? parsed : 0 });
                }} />
      </div>
      <StepNotes value={m.notes || ''} onChange={v => updateMetrics(session, updateSession, 'mashOut', { notes: v })} />
    </div>
  );
};

export const Step06_Lautering: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.lautering;
  
  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Corrección de Densidad" description="Corrige la lectura del densímetro del mosto caliente.">
        <DensityCalculator />
      </CalculatorToggle>
      <CalculatorToggle title="Volumen de Lavado" description="Calcula cuánta agua necesitas para el lavado.">
        <SpargeCalculator />
      </CalculatorToggle>
      <CalculatorToggle title="Parti-gyle" description="¿Vas a dividir este macerado en dos cocciones separadas?">
        <PartigyleCalculator />
      </CalculatorToggle>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-4">
          <h4 className="font-bold text-slate-700 dark:text-slate-300">1. Recirculado (Vorlauf)</h4>
          <BrewTimer 
            label="Cronómetro Recirculado" 
            {...timerProps(session, updateSession, 'MASH_RECIRCULATION', 15)}
          />
          <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg">
              <input type="checkbox" className="w-5 h-5 accent-copper rounded border-slate-300" 
                    checked={m.vorlauf.wortClear} 
                    onChange={e => updateMetrics(session, updateSession, 'lautering', { vorlauf: { ...m.vorlauf, wortClear: e.target.checked } })} />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Mosto Claro (Libre de partículas)</span>
            </label>
          </div>
        </div>

        <div className="space-y-4">
          <h4 className="font-bold text-slate-700 dark:text-slate-300">2. Lavado (Sparge)</h4>
          <BrewTimer 
            label="Cronómetro Lavado" 
            {...timerProps(session, updateSession, 'MASH_SPARGE')}
          />
          <div className="grid grid-cols-1 gap-4">
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Volumen Recolectado (L) a hervir</label>
              <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                      value={m.sparge.volumeCollected || ''} onDebouncedChange={v => {
                        const parsed = parseFloat(v.replace(',', '.'));
                        updateMetrics(session, updateSession, 'lautering', { sparge: { ...m.sparge, volumeCollected: !isNaN(parsed) ? parsed : 0 } });
                      }} />
            </div>
            <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Densidad Pre-Hervor</label>
              <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                      placeholder="Ej: 1.045"
                      value={m.sparge.preBoilGravity || ''} onDebouncedChange={v => {
                        const parsed = parseFloat(v.replace(',', '.'));
                        updateMetrics(session, updateSession, 'lautering', { sparge: { ...m.sparge, preBoilGravity: !isNaN(parsed) ? parsed : 0 } });
                      }} />
              <p className="text-[11px] text-slate-400 mt-1">Mide después de recolectar todo el mosto, antes de encender el fuego.</p>
            </div>
          </div>
        </div>
      </div>
      <StepNotes value={m.vorlauf.notes || ''} onChange={v => updateMetrics(session, updateSession, 'lautering', { vorlauf: { ...m.vorlauf, notes: v } })} />
    </div>
  );
};

export const Step07_Boil: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.boil;
  const recipes = useBreweryStore(state => state.masterRecipes);
  const recipe = recipes.find(r => r.id === batch.recipeId);
  const hops = batch.ingredientsUsed.filter(i => i.type === 'HOP');

  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Volumen de Olla (Kettle)" description="Estima mermas y volumen a hervir.">
        <KettleCalculator />
      </CalculatorToggle>
      <CalculatorToggle title="Cálculo de Amargor (IBU)" description="Calcula los IBU según el lúpulo.">
        <IBUCalculator />
      </CalculatorToggle>
      
      {recipe?.batchSize && (
        <div className="bg-copper/10 border border-copper/20 rounded-lg p-3 flex justify-between items-center">
          <span className="text-sm font-bold text-copper-800 dark:text-copper-400">Volumen Pre-Hervor Esperado (Receta)</span>
          <span className="font-mono font-bold text-copper">{recipe.batchSize} L</span>
        </div>
      )}

      <BrewTimer 
        label="Hervor (General)" 
        {...timerProps(session, updateSession, BrewStep.BOILING, 60)}
      />

      <BrewTimer 
        label="Clarificante (Últimos 15 min)" 
        {...timerProps(session, updateSession, 'BOIL_CLARIFIER', 15)}
      />

      {hops.length > 0 && (
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-4">
          <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Cronómetros de Lúpulo</h4>
          <p className="text-xs text-slate-500 mb-2">Inicia un cronómetro para cada adición de lúpulo requerida en el hervor.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {hops.map((hop, idx) => {
              const hopStepId = `HOP_${hop.inventoryId}`;
              return (
                <BrewTimer 
                  key={idx}
                  label={hop.name} 
                  {...timerProps(session, updateSession, hopStepId)}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Volumen Post-Hervor (L)</label>
        <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                value={m.postBoilVolume || ''} onDebouncedChange={v => {
                  const parsed = parseFloat(v.replace(',', '.'));
                  updateMetrics(session, updateSession, 'boil', { postBoilVolume: !isNaN(parsed) ? parsed : 0 });
                }} />
      </div>
      <StepNotes value={m.notes} onChange={v => updateMetrics(session, updateSession, 'boil', { notes: v })} />
    </div>
  );
};

export const Step08_Whirlpool: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.whirlpool;
  return (
    <div className="space-y-6 animate-fade-in">
      <BrewTimer 
        label="Hop Stand" 
        {...timerProps(session, updateSession, 'HOP_STAND', 20)}
      />
      <BrewTimer 
        label="Whirlpool" 
        {...timerProps(session, updateSession, BrewStep.WHIRLPOOL, 20)}
      />
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temperatura al Agregar Lúpulo (°C)</label>
        <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono"
                placeholder="Ej: 80"
                value={m.tempAtAddition || ''} onDebouncedChange={v => {
                  const parsed = parseFloat(v.replace(',', '.'));
                  updateMetrics(session, updateSession, 'whirlpool', { tempAtAddition: !isNaN(parsed) ? parsed : 0 });
                }} />
      </div>
      <StepNotes value={m.notes || ''} onChange={v => updateMetrics(session, updateSession, 'whirlpool', { notes: v })} />
    </div>
  );
};

export const Step09_Cooling: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.cooling;
  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Corrección de Densidad" description="Corrige la lectura del densímetro por la temperatura.">
        <DensityCalculator />
      </CalculatorToggle>
      <BrewTimer 
        label="Enfriamiento" 
        {...timerProps(session, updateSession, BrewStep.COOLING)}
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temp. Inicio (°C)</label>
          <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                  placeholder="Ej: 95"
                  value={m.startTemp || ''} onDebouncedChange={v => {
                    const parsed = parseFloat(v.replace(',', '.'));
                    updateMetrics(session, updateSession, 'cooling', { startTemp: !isNaN(parsed) ? parsed : 0 });
                  }} />
        </div>
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temp. Objetivo (°C)</label>
          <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                  placeholder="Ej: 20"
                  value={m.targetTemp || ''} onDebouncedChange={v => {
                    const parsed = parseFloat(v.replace(',', '.'));
                    updateMetrics(session, updateSession, 'cooling', { targetTemp: !isNaN(parsed) ? parsed : 0 });
                  }} />
        </div>
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temp. Alcanzada (°C)</label>
          <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                  placeholder="Ej: 21"
                  value={m.actualTemp || ''} onDebouncedChange={v => {
                    const parsed = parseFloat(v.replace(',', '.'));
                    updateMetrics(session, updateSession, 'cooling', { actualTemp: !isNaN(parsed) ? parsed : 0 });
                  }} />
        </div>
      </div>
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Volumen Transferido al Fermentador (L)</label>
        <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                value={m.volumeToFermenter || ''} onDebouncedChange={v => {
                  const parsed = parseFloat(v.replace(',', '.'));
                  updateMetrics(session, updateSession, 'cooling', { volumeToFermenter: !isNaN(parsed) ? parsed : 0 });
                }} />
      </div>
      <StepNotes value={m.notes || ''} onChange={v => updateMetrics(session, updateSession, 'cooling', { notes: v })} />
    </div>
  );
};

export const Step10_PreFermentation: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.preFermentation;
  const recipes = useBreweryStore(state => state.masterRecipes);
  const recipe = recipes.find(r => r.id === batch.recipeId);

  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Eficiencia de Equipo" description="Verifica si llegaste a la eficiencia deseada.">
        <EfficiencyCalculator />
      </CalculatorToggle>
      <CalculatorToggle title="Dilución / Concentración" description="Calcula si necesitas diluir o agregar extracto para corregir OG.">
        <DilutionCalculator />
      </CalculatorToggle>
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 relative overflow-hidden">
        {recipe?.targetOG && (
          <div className="absolute top-0 right-0 bg-copper/10 text-copper px-3 py-1 rounded-bl-xl text-xs font-bold">
            Target OG: {recipe.targetOG}
          </div>
        )}
        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Densidad Original (OG) Medida</label>
        <DebouncedInput 
          type="text" 
          inputMode="decimal" 
          className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono text-lg" 
          value={m.og || ''} 
          onDebouncedChange={val => {
            const parsed = parseFloat(val.replace(',', '.'));
            updateMetrics(session, updateSession, 'preFermentation', { 
              og: !isNaN(parsed) ? parsed : 0 
            });
          }} 
        />
      </div>
    </div>
  );
};

export const Step11_Pitching: React.FC<StepProps> = ({ session, batch, updateSession }) => {
  const m = session.metrics.pitching;
  return (
    <div className="space-y-6 animate-fade-in">
      <CalculatorToggle title="Tasa de Inoculación" description="Calcula gramos de levadura o paquetes necesarios.">
        <PitchCalculator />
      </CalculatorToggle>
      <CalculatorToggle title="Starter" description="Planifica un starter si usas levadura líquida.">
        <StarterCalculator />
      </CalculatorToggle>
      <BrewTimer 
        label="Inoculación y Cierre" 
        {...timerProps(session, updateSession, BrewStep.YEAST_PITCH)}
      />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Levadura Usada</label>
          <input type="text" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white" 
                  value={m.yeastName} onChange={e => updateMetrics(session, updateSession, 'pitching', { yeastName: e.target.value })} />
        </div>
        <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700">
          <label className="block text-xs font-bold text-slate-500 uppercase mb-2">Temperatura del Fermentador (°C)</label>
          <DebouncedInput type="text" inputMode="decimal" className="w-full bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-slate-800 dark:text-white font-mono" 
                  value={m.chamberTemp || ''} onDebouncedChange={v => {
                    const parsed = parseFloat(v.replace(',', '.'));
                    updateMetrics(session, updateSession, 'pitching', { chamberTemp: !isNaN(parsed) ? parsed : 0 });
                  }} />
        </div>
      </div>
      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-3">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Checklist de Cierre</h4>
        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg">
          <input type="checkbox" className="w-5 h-5 accent-copper rounded" checked={m.fermenterSealed} 
                 onChange={e => updateMetrics(session, updateSession, 'pitching', { fermenterSealed: e.target.checked })} />
          <span className="text-sm text-slate-700 dark:text-slate-300">Fermentador sellado</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg">
          <input type="checkbox" className="w-5 h-5 accent-copper rounded" checked={m.airlockInstalled} 
                 onChange={e => updateMetrics(session, updateSession, 'pitching', { airlockInstalled: e.target.checked })} />
          <span className="text-sm text-slate-700 dark:text-slate-300">Airlock instalado</span>
        </label>
        <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-slate-50 dark:hover:bg-zinc-700/50 rounded-lg">
          <input type="checkbox" className="w-5 h-5 accent-copper rounded" checked={m.oxygenation} 
                 onChange={e => updateMetrics(session, updateSession, 'pitching', { oxygenation: e.target.checked })} />
          <span className="text-sm text-slate-700 dark:text-slate-300">Oxigenación realizada</span>
        </label>
      </div>
      <StepNotes value={m.notes} onChange={v => updateMetrics(session, updateSession, 'pitching', { notes: v })} />
    </div>
  );
};

export const Step12_Logbook: React.FC<StepProps> = ({ session, updateSession }) => {
  const [newNote, setNewNote] = React.useState('');

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const note = `[${timeStr}] ${newNote.trim()}`;
    updateSession({ notes: [...(session.notes || []), note] });
    setNewNote('');
  };

  const handleDeleteNote = (idx: number) => {
    const next = [...(session.notes || [])];
    next.splice(idx, 1);
    updateSession({ notes: next });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-copper/5 border border-copper/20 p-4 rounded-xl">
        <p className="text-sm text-copper-800 dark:text-copper-400">
          Usa esta bitácora para registrar cualquier eventualidad, corte de luz, demora, o notas de calidad que ocurran fuera de los pasos normales.
        </p>
      </div>

      <div className="flex gap-2">
        <input 
          type="text" 
          placeholder="Ej: Se cortó la luz por 15 mins..." 
          className="flex-1 bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-lg p-3 text-sm text-slate-800 dark:text-white outline-none focus:border-copper"
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleAddNote()}
        />
        <button 
          onClick={handleAddNote}
          className="bg-copper hover:bg-copper-dark text-white px-4 py-2 rounded-lg font-bold shadow-sm transition"
        >
          Agregar
        </button>
      </div>

      <div className="bg-white dark:bg-zinc-800 p-4 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-2">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-4">Registro de Novedades</h4>
        {!session.notes || session.notes.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No hay notas registradas en esta sesión.</p>
        ) : (
          <div className="space-y-2">
            {session.notes.map((note, idx) => (
              <div key={idx} className="bg-slate-50 dark:bg-zinc-900 p-3 rounded-lg border border-slate-100 dark:border-zinc-700 text-sm text-slate-700 dark:text-slate-300 flex justify-between items-start gap-2">
                <span>{note}</span>
                <button 
                  onClick={() => handleDeleteNote(idx)} 
                  className="text-slate-400 hover:text-red-500 text-xs shrink-0 transition"
                  title="Eliminar nota"
                >✕</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
