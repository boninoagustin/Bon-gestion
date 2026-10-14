import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useBreweryStore } from '../../context/store';
import { Batch, BrewStep, TimerLog, BrewSession, BatchStatus } from '../../types';
import { ArrowLeft, Download, Flame, Droplet, Thermometer, FlaskConical, Clock, CheckCircle, BookOpen, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useToast } from '../Toast';
import { 
  Step01_Preparation, Step02_Heating, Step03_MashIn, Step04_Saccharification,
  Step05_MashOut, Step06_Lautering, Step07_Boil, Step08_Whirlpool,
  Step09_Cooling, Step10_PreFermentation, Step11_Pitching, Step12_Logbook,
  isStepCompleted
} from './BrewSteps';

interface BrewAssistantProps {
  batchId: string;
}

const STEPS = [
  { title: "Preparación", icon: Clock, component: Step01_Preparation },
  { title: "Calentar Agua", icon: Flame, component: Step02_Heating },
  { title: "Empaste", icon: Droplet, component: Step03_MashIn },
  { title: "Macerado", icon: FlaskConical, component: Step04_Saccharification },
  { title: "Mash Out", icon: Thermometer, component: Step05_MashOut },
  { title: "Lavado", icon: Droplet, component: Step06_Lautering },
  { title: "Hervor", icon: Flame, component: Step07_Boil },
  { title: "Whirlpool", icon: Clock, component: Step08_Whirlpool },
  { title: "Enfriamiento", icon: Thermometer, component: Step09_Cooling },
  { title: "Medición", icon: FlaskConical, component: Step10_PreFermentation },
  { title: "Inoculación", icon: CheckCircle, component: Step11_Pitching },
  { title: "Bitácora Global", icon: BookOpen, component: Step12_Logbook }
];

export const BrewAssistant: React.FC<BrewAssistantProps> = ({ batchId }) => {
  const batches = useBreweryStore(s => s.batches);
  const brewSessions = useBreweryStore(s => s.brewSessions);
  const addBrewSession = useBreweryStore(s => s.addBrewSession);
  const updateBrewSession = useBreweryStore(s => s.updateBrewSession);
  const setActiveBrewBatchId = useBreweryStore(s => s.setActiveBrewBatchId);
  const updateBatch = useBreweryStore(s => s.updateBatch);
  const { showToast } = useToast();

  const [globalTime, setGlobalTime] = useState<number>(0);
  const [showSummary, setShowSummary] = useState(false);

  const batch = batches.find(b => b.id === batchId);
  
  const session = useMemo(() => {
    return brewSessions.find(s => s.batchId === batchId);
  }, [brewSessions, batchId]);

  // Persist activeTab from session, default to 0
  const [activeTab, setActiveTab] = useState<number>(session?.activeStepIndex || 0);

  // Save active step to session when it changes
  const changeTab = useCallback((idx: number) => {
    setActiveTab(idx);
    if (session) {
      if (idx > activeTab) {
        // Pausar cronómetros al avanzar
        const now = Date.now();
        const updatedTimers = session.timers.map(t => {
          if (!t.endTime && !t.isPaused && t.startTime) {
            const currentSegment = now - t.startTime;
            return {
              ...t,
              isPaused: true,
              accumulatedMs: (t.accumulatedMs || 0) + currentSegment
            };
          }
          return t;
        });
        updateBrewSession(session.id, { activeStepIndex: idx, timers: updatedTimers });
      } else {
        updateBrewSession(session.id, { activeStepIndex: idx });
      }
    }
  }, [session, activeTab, updateBrewSession]);

  // Create session if not exists (Bug 6: use batch.recipeId)
  useEffect(() => {
    if (!session && batch) {
      const newSession: BrewSession = {
        id: crypto.randomUUID(),
        batchId: batch.id,
        recipeId: batch.recipeId || '', // Bug 6 fix: use batch.recipeId
        startTime: Date.now(),
        globalElapsed: 0,
        status: 'IN_PROGRESS',
        currentStep: BrewStep.PREPARATION,
        timers: [],
        notes: [],
        metrics: {
            coldSteeping: { done: false, grainKg: 0, waterL: 0, notes: '' },
            milling: { grainsWeighed: [], totalGrainReal: 0, waterTreated: false, notes: '' },
            heating: { waterVolume: 0, strikeTemp: 0, actualWaterTemp: 0, notes: '' },
            mashIn: { targetTemp: 0, actualTemp: 0, notes: '' },
            saccharification: { tempReadings: [], iodineTest: 'not_done', spargeWaterReminder: false, pH: 0, notes: '' },
            mashOut: { targetTemp: 0, actualTemp: 0, notes: '' },
            lautering: { vorlauf: { wortClear: false, notes: '' }, sparge: { waterVolume: 0, waterTemp: 0, fwhDone: false, volumeCollected: 0, preBoilGravity: 0, notes: '' } },
            boil: { additions: [], postBoilVolume: 0, notes: '' },
            whirlpool: { tempAtAddition: 0, hopsAdded: [], notes: '' },
            cooling: { startTemp: 0, targetTemp: 0, actualTemp: 0, method: 'plates', volumeToFermenter: 0, notes: '' },
            preFermentation: { og: 0, efficiencyCalc: 0, finalVolume: 0 },
            pitching: { yeastName: '', yeastAmount: 0, yeastUnit: 'g', rehydrated: false, oxygenation: false, wortTemp: 0, fermenterSealed: false, airlockInstalled: false, chamberTemp: 0, notes: '' }
        },
        activeStepIndex: 0,
        alarmMuted: false,
        lastUpdatedAt: Date.now()
      };
      addBrewSession(newSession);
    }
  }, [session, batch, addBrewSession]);

  // Bug 2 fix: Initialize globalTime correctly, handle completed sessions
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (session && session.status === 'IN_PROGRESS') {
      interval = setInterval(() => {
        setGlobalTime(Math.floor((Date.now() - session.startTime) / 1000));
      }, 1000);
    } else if (session && session.status === 'COMPLETED' && session.globalElapsed) {
      setGlobalTime(session.globalElapsed);
    }
    return () => clearInterval(interval);
  }, [session?.status, session?.startTime, session?.globalElapsed]);

  // Keyboard navigation (Mejora 11)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      
      if (e.key === 'ArrowLeft' && activeTab > 0) {
        e.preventDefault();
        changeTab(activeTab - 1);
      } else if (e.key === 'ArrowRight' && activeTab < STEPS.length - 1) {
        e.preventDefault();
        changeTab(activeTab + 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, changeTab]);

  if (!batch || !session) return <div className="p-8 text-center text-slate-500">Cargando asistente...</div>;

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const ActiveComponent = STEPS[activeTab].component;

  // Mejora 3: Confirmación al salir
  const handleExit = () => {
    if (session.status === 'IN_PROGRESS') {
      if (!window.confirm('¿Salir del asistente? Tu progreso está guardado y podrás retomar desde donde lo dejaste.')) return;
    }
    setActiveBrewBatchId(null);
  };

  const handleFinish = () => {
    setShowSummary(true);
  };

  const confirmFinish = () => {
    const finalElapsed = Math.floor((Date.now() - session.startTime) / 1000);
    const now = Date.now();
    
    // Finalizar todos los cronómetros activos
    const updatedTimers = session.timers.map(t => {
      if (!t.endTime) {
        const totalMs = !t.isPaused && t.startTime
          ? (t.accumulatedMs || 0) + (now - t.startTime)
          : (t.accumulatedMs || 0);
        return {
          ...t,
          isRunning: false,
          isPaused: false,
          endTime: now,
          durationMs: totalMs
        };
      }
      return t;
    });

    updateBrewSession(session.id, {
      status: 'COMPLETED',
      globalElapsed: finalElapsed,
      timers: updatedTimers,
      lastUpdatedAt: Date.now()
    });

    updateBatch(batch.id, {
      status: BatchStatus.FERMENTING,
      originalGravity: session.metrics.preFermentation.og || batch.originalGravity || 0,
      volumeKettle: session.metrics.lautering.sparge.volumeCollected || batch.volumeKettle || 0,
      volumeFermenter: session.metrics.cooling.volumeToFermenter || batch.volumeFermenter || 0
    });

    setShowSummary(false);
    setActiveBrewBatchId(null);
    showToast({ message: 'Cocción finalizada exitosamente. El lote ahora está en Fermentación.', type: 'success' });
  };

  // Mejora 10: Export legible
  const generateExport = () => {
    const m = session.metrics;
    const line = (label: string, value: any, unit = '') => value ? `  ${label}: ${value}${unit}\n` : '';
    const divider = '═'.repeat(50) + '\n';
    
    let content = `${'═'.repeat(50)}\n`;
    content += `  REPORTE DE COCCIÓN - ${batch.recipeName.toUpperCase()}\n`;
    content += divider;
    content += `  Lote: ${batch.lotCode}\n`;
    content += `  Fecha: ${new Date(session.startTime).toLocaleDateString('es-AR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    content += `  Tiempo Total: ${formatTime(globalTime)}\n`;
    content += `  Estado: ${session.status === 'COMPLETED' ? 'Completada' : 'En Progreso'}\n`;
    content += divider;
    
    content += `\n📋 PREPARACIÓN\n${'─'.repeat(30)}\n`;
    content += `  Agua tratada: ${m.milling.waterTreated ? 'Sí' : 'No'}\n`;
    if (m.milling.notes) content += `  Notas: ${m.milling.notes}\n`;
    
    content += `\n🔥 CALENTAMIENTO\n${'─'.repeat(30)}\n`;
    content += line('Volumen de agua', m.heating.waterVolume, ' L');
    content += line('Temp. alcanzada', m.heating.actualWaterTemp, ' °C');
    if (m.heating.notes) content += `  Notas: ${m.heating.notes}\n`;
    
    content += `\n💧 EMPASTE\n${'─'.repeat(30)}\n`;
    content += line('Temp. empaste', m.mashIn.actualTemp, ' °C');
    if (m.mashIn.notes) content += `  Notas: ${m.mashIn.notes}\n`;
    
    content += `\n🧪 MACERADO\n${'─'.repeat(30)}\n`;
    content += line('pH', m.saccharification.pH);
    content += `  Test de yodo: ${m.saccharification.iodineTest === 'negative' ? 'Negativo ✓' : m.saccharification.iodineTest === 'positive' ? 'Positivo ✗' : 'No realizado'}\n`;
    if (m.saccharification.notes) content += `  Notas: ${m.saccharification.notes}\n`;
    
    content += `\n🌡️ MASH OUT\n${'─'.repeat(30)}\n`;
    content += line('Temp. alcanzada', m.mashOut.actualTemp, ' °C');
    if (m.mashOut.notes) content += `  Notas: ${m.mashOut.notes}\n`;
    
    content += `\n💧 LAVADO\n${'─'.repeat(30)}\n`;
    content += `  Vorlauf claro: ${m.lautering.vorlauf.wortClear ? 'Sí' : 'No'}\n`;
    content += line('Vol. recolectado', m.lautering.sparge.volumeCollected, ' L');
    content += line('Densidad pre-hervor', m.lautering.sparge.preBoilGravity);
    
    content += `\n🔥 HERVOR\n${'─'.repeat(30)}\n`;
    content += line('Vol. post-hervor', m.boil.postBoilVolume, ' L');
    if (m.boil.notes) content += `  Notas: ${m.boil.notes}\n`;
    
    content += `\n🌀 WHIRLPOOL\n${'─'.repeat(30)}\n`;
    content += line('Temp. adición lúpulo', m.whirlpool.tempAtAddition, ' °C');
    if (m.whirlpool.notes) content += `  Notas: ${m.whirlpool.notes}\n`;
    
    content += `\n❄️ ENFRIAMIENTO\n${'─'.repeat(30)}\n`;
    content += line('Temp. inicio', m.cooling.startTemp, ' °C');
    content += line('Temp. objetivo', m.cooling.targetTemp, ' °C');
    content += line('Temp. alcanzada', m.cooling.actualTemp, ' °C');
    content += line('Vol. al fermentador', m.cooling.volumeToFermenter, ' L');
    if (m.cooling.notes) content += `  Notas: ${m.cooling.notes}\n`;
    
    content += `\n📊 MEDICIÓN\n${'─'.repeat(30)}\n`;
    content += line('OG medida', m.preFermentation.og);
    
    content += `\n🧫 INOCULACIÓN\n${'─'.repeat(30)}\n`;
    content += line('Levadura', m.pitching.yeastName);
    content += line('Temp. fermentador', m.pitching.chamberTemp, ' °C');
    content += `  Fermentador sellado: ${m.pitching.fermenterSealed ? 'Sí' : 'No'}\n`;
    content += `  Airlock instalado: ${m.pitching.airlockInstalled ? 'Sí' : 'No'}\n`;
    content += `  Oxigenación: ${m.pitching.oxygenation ? 'Sí' : 'No'}\n`;
    if (m.pitching.notes) content += `  Notas: ${m.pitching.notes}\n`;
    
    content += `\n⏱️ CRONÓMETROS\n${'─'.repeat(30)}\n`;
    session.timers.filter(t => t.endTime).forEach(t => {
      const ms = t.durationMs || (t.endTime! - t.startTime);
      const secs = Math.floor(ms / 1000);
      content += `  ${t.stepId}: ${formatTime(secs)}\n`;
    });
    
    if (session.notes && session.notes.length > 0) {
      content += `\n📝 BITÁCORA\n${'─'.repeat(30)}\n`;
      session.notes.forEach(n => { content += `  ${n}\n`; });
    }
    
    content += `\n${divider}`;
    content += `  Generado por BON Gestión - ${new Date().toLocaleString('es-AR')}\n`;
    content += divider;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Coccion_${batch.lotCode}_${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    // Bug 7 fix: delay revokeObjectURL to ensure download starts
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // Mejora 9: Summary modal
  const SummaryModal = () => {
    const m = session.metrics;
    const completedSteps = STEPS.filter((_, i) => isStepCompleted(session, i)).length;
    
    return createPortal(
      <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowSummary(false)}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto border border-slate-200 dark:border-zinc-700" onClick={e => e.stopPropagation()}>
          <div className="p-6 border-b border-slate-100 dark:border-zinc-800">
            <h3 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <FileText size={22} className="text-copper" />
              Resumen de Cocción
            </h3>
            <p className="text-sm text-slate-500 mt-1">Revisa antes de finalizar. El lote pasará a Fermentación.</p>
          </div>
          
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Pasos completados</span>
              <span className="font-bold text-copper">{completedSteps} / {STEPS.length}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
              <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Tiempo total</span>
              <span className="font-mono font-bold text-slate-800 dark:text-white">{formatTime(globalTime)}</span>
            </div>
            
            <div className="space-y-2">
              {m.heating.waterVolume > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Agua calentada</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.heating.waterVolume} L @ {m.heating.actualWaterTemp}°C</span>
                </div>
              )}
              {m.mashIn.actualTemp > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Temp. empaste</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.mashIn.actualTemp}°C</span>
                </div>
              )}
              {m.saccharification.pH > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">pH macerado</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.saccharification.pH}</span>
                </div>
              )}
              {m.lautering.sparge.volumeCollected > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Vol. recolectado</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.lautering.sparge.volumeCollected} L</span>
                </div>
              )}
              {m.lautering.sparge.preBoilGravity > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Densidad pre-hervor</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.lautering.sparge.preBoilGravity}</span>
                </div>
              )}
              {m.boil.postBoilVolume > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Vol. post-hervor</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.boil.postBoilVolume} L</span>
                </div>
              )}
              {m.cooling.volumeToFermenter > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Vol. al fermentador</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.cooling.volumeToFermenter} L</span>
                </div>
              )}
              {m.preFermentation.og > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">OG medida</span>
                  <span className="font-mono font-bold text-copper">{m.preFermentation.og}</span>
                </div>
              )}
              {m.pitching.yeastName && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Levadura</span>
                  <span className="text-slate-700 dark:text-slate-300">{m.pitching.yeastName}</span>
                </div>
              )}
              {m.pitching.chamberTemp > 0 && (
                <div className="flex justify-between text-sm px-3 py-1">
                  <span className="text-slate-500">Temp. fermentador</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{m.pitching.chamberTemp}°C</span>
                </div>
              )}
            </div>

            {/* Warnings for incomplete critical data */}
            {(m.preFermentation.og === 0 || m.cooling.volumeToFermenter === 0) && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 p-3 rounded-lg">
                <p className="text-xs font-bold text-amber-700 dark:text-amber-400">⚠️ Datos faltantes:</p>
                <ul className="text-xs text-amber-600 dark:text-amber-400 mt-1 list-disc list-inside">
                  {m.preFermentation.og === 0 && <li>OG no registrada</li>}
                  {m.cooling.volumeToFermenter === 0 && <li>Volumen al fermentador no registrado</li>}
                </ul>
              </div>
            )}
          </div>
          
          <div className="p-6 border-t border-slate-100 dark:border-zinc-800 flex gap-3">
            <button 
              onClick={() => setShowSummary(false)} 
              className="flex-1 bg-slate-100 dark:bg-zinc-800 hover:bg-slate-200 dark:hover:bg-zinc-700 text-slate-700 dark:text-slate-300 px-4 py-3 rounded-xl font-bold transition"
            >
              Volver
            </button>
            <button 
              onClick={confirmFinish} 
              className="flex-1 bg-copper hover:bg-copper-dark text-white px-4 py-3 rounded-xl font-bold shadow transition flex items-center justify-center gap-2"
            >
              <CheckCircle size={18} /> Confirmar y Finalizar
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-zinc-900 absolute inset-0 z-40 rounded-xl overflow-hidden shadow-2xl">
      {/* SUMMARY MODAL */}
      {showSummary && <SummaryModal />}
      
      {/* HEADER / GLOBAL TIMER */}
      <div className="bg-slate-dark text-white p-4 shadow-md flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={handleExit}
            className="text-slate-400 hover:text-white p-2 rounded hover:bg-slate-800 transition"
            title="Salir del asistente (Progreso guardado)"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-copper">{batch.recipeName}</h2>
            <p className="text-xs text-slate-400">Lote: {batch.lotCode} &bull; Paso {activeTab + 1}/{STEPS.length}</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-center bg-slate-900/50 px-6 py-2 rounded-xl border border-slate-700/50">
             <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Tiempo Total Cocción</p>
             <div className="text-3xl font-mono font-bold text-white tracking-wider">{formatTime(globalTime)}</div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={generateExport}
              className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition flex items-center gap-2"
              title="Exportar Registro de Cocción"
            >
              <Download size={16} /> <span className="hidden sm:inline">Exportar</span>
            </button>
            <button 
              onClick={handleFinish}
              className="bg-copper hover:bg-copper-dark text-white px-4 py-2 rounded-lg text-sm font-bold shadow transition flex items-center gap-2"
            >
              <CheckCircle size={16} /> <span className="hidden sm:inline">Finalizar Cocción</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* SIDEBAR STEPS with completion indicators */}
        <div className="w-64 bg-white dark:bg-zinc-950 border-r border-slate-200 dark:border-zinc-800 overflow-y-auto shrink-0 p-4 space-y-2">
          {STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = activeTab === idx;
            const completed = isStepCompleted(session, idx);
            return (
              <button
                key={idx}
                onClick={() => changeTab(idx)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 transition-all ${
                  isActive 
                  ? 'bg-copper text-white shadow-md font-bold' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                  isActive ? 'bg-white/20' 
                  : completed ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                  : 'bg-slate-200 dark:bg-zinc-800'
                }`}>
                  {completed && !isActive ? '✓' : idx + 1}
                </div>
                <Icon size={16} className="shrink-0" />
                <span className="text-sm truncate">{step.title}</span>
              </button>
            );
          })}

          {/* Keyboard hint */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
            <p className="text-[10px] text-slate-400 text-center flex items-center justify-center gap-1">
              <ChevronLeft size={10} /> <ChevronRight size={10} /> para navegar
            </p>
          </div>
        </div>

        {/* STEP CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50 dark:bg-zinc-900">
           <div className="max-w-3xl mx-auto">
             <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-sm p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center gap-3">
                    {React.createElement(STEPS[activeTab].icon, { className: "text-copper", size: 28 })}
                    {STEPS[activeTab].title}
                  </h3>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => activeTab > 0 && changeTab(activeTab - 1)} 
                      disabled={activeTab === 0}
                      className="p-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button 
                      onClick={() => activeTab < STEPS.length - 1 && changeTab(activeTab + 1)} 
                      disabled={activeTab === STEPS.length - 1}
                      className="p-2 rounded-lg border border-slate-200 dark:border-zinc-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
                
                <ActiveComponent session={session} batch={batch} updateSession={(u) => updateBrewSession(session.id, u)} />
             </div>
           </div>
        </div>
      </div>
    </div>
  );
};
