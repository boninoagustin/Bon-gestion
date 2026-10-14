import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Play, Pause, Square, RotateCcw, Bell, BellOff, Check, Pencil } from 'lucide-react';
import { TimerLog } from '../../types';
import { useToast } from '../Toast';

interface BrewTimerProps {
  label: string;
  timerLog?: TimerLog;
  onStart: () => void;
  onPause: (accumulatedMs: number) => void;
  onStop: (durationMs: number) => void;
  onResume: (accumulatedMs: number) => void;
  defaultDurationMinutes?: number;
  alarmMuted?: boolean;
  onToggleMute?: () => void;
}

export const BrewTimer: React.FC<BrewTimerProps> = ({ 
  label, timerLog, onStart, onPause, onStop, onResume, 
  defaultDurationMinutes, alarmMuted = false, onToggleMute 
}) => {
  const [elapsed, setElapsed] = useState(0);
  const [alarmTriggered, setAlarmTriggered] = useState(false);
  const { showToast } = useToast();
  
  // Custom duration logic
  const [customDurationMinutes, setCustomDurationMinutes] = useState(defaultDurationMinutes || 0);
  const [isEditingDuration, setIsEditingDuration] = useState(false);
  const [tempDuration, setTempDuration] = useState((defaultDurationMinutes || 0).toString());

  useEffect(() => {
    setCustomDurationMinutes(defaultDurationMinutes || 0);
    setTempDuration((defaultDurationMinutes || 0).toString());
  }, [defaultDurationMinutes]);

  const targetSecs = customDurationMinutes * 60;

  const isRunning = timerLog?.startTime && !timerLog.endTime && !timerLog.isPaused;
  const isPaused = timerLog?.isPaused === true && !timerLog.endTime;
  const isCompleted = !!timerLog?.endTime;

  // Sound generator with volume control
  const playBeep = useCallback(() => {
    if (alarmMuted) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const gainNode = ctx.createGain();
      gainNode.connect(ctx.destination);

      // 3 ascending beeps for a more pleasant alarm
      const frequencies = [660, 880, 1100];
      frequencies.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.25);
        
        const beepGain = ctx.createGain();
        beepGain.gain.setValueAtTime(0, ctx.currentTime + i * 0.25);
        beepGain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + i * 0.25 + 0.05);
        beepGain.gain.linearRampToValueAtTime(0, ctx.currentTime + i * 0.25 + 0.2);
        
        osc.connect(beepGain);
        beepGain.connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.25);
        osc.stop(ctx.currentTime + i * 0.25 + 0.25);
      });
    } catch(e) {
      console.error('Audio playback failed', e);
    }
  }, [alarmMuted]);

  const triggerAlarm = useCallback(() => {
    if (alarmTriggered) return;
    setAlarmTriggered(true);
    
    playBeep();
    showToast({ message: `¡Tiempo cumplido: ${label}!`, type: 'info' });

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(`¡Tiempo Cumplido!`, {
        body: `El cronómetro para "${label}" ha finalizado.`,
        icon: '/vite.svg'
      });
    }
  }, [alarmTriggered, playBeep, showToast, label]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning && timerLog) {
      interval = setInterval(() => {
        const accumulated = timerLog.accumulatedMs || 0;
        const currentSegment = Date.now() - timerLog.startTime;
        const totalMs = accumulated + currentSegment;
        const currentElapsed = Math.floor(totalMs / 1000);
        setElapsed(currentElapsed);
        
        if (targetSecs > 0 && currentElapsed >= targetSecs && !alarmTriggered) {
          triggerAlarm();
        }
      }, 1000);
    } else if (isPaused && timerLog) {
      setElapsed(Math.floor((timerLog.accumulatedMs || 0) / 1000));
    } else if (isCompleted && timerLog?.durationMs) {
      setElapsed(Math.floor(timerLog.durationMs / 1000));
    } else if (!timerLog) {
      setElapsed(0);
    }
    
    return () => clearInterval(interval);
  }, [timerLog?.startTime, timerLog?.endTime, timerLog?.isPaused, timerLog?.accumulatedMs, targetSecs, alarmTriggered, triggerAlarm]);

  const handleAction = () => {
    if (isRunning && timerLog) {
      // Pause: accumulate time
      const currentSegment = Date.now() - timerLog.startTime;
      const totalAccumulated = (timerLog.accumulatedMs || 0) + currentSegment;
      onPause(totalAccumulated);
    } else if (isPaused && timerLog) {
      // Resume from pause
      onResume(timerLog.accumulatedMs || 0);
    } else {
      // Fresh start
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
      onStart();
      setAlarmTriggered(false);
    }
  };

  const handleStop = () => {
    if (!timerLog || isCompleted) return;
    const totalMs = isRunning 
      ? (timerLog.accumulatedMs || 0) + (Date.now() - timerLog.startTime)
      : (timerLog.accumulatedMs || 0);
    onStop(totalMs);
  };

  const formatTime = (totalSeconds: number) => {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progress = targetSecs > 0 ? Math.min(100, (elapsed / targetSecs) * 100) : 0;
  const remaining = targetSecs > 0 ? Math.max(0, targetSecs - elapsed) : 0;

  return (
    <div className={`p-4 rounded-xl border flex flex-col gap-3 transition-colors ${
      isCompleted 
        ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800/50' 
        : alarmTriggered 
          ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-300 dark:border-amber-700/50' 
          : 'bg-slate-100 dark:bg-zinc-800/80 border-slate-200 dark:border-zinc-700'
    }`}>
      <div className="flex justify-between items-center">
        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
          {label}
          {alarmTriggered && <Bell size={14} className="text-amber-500 animate-pulse" />}
          {isCompleted && timerLog?.endTime && (
            <span className="text-green-500 text-xs font-medium" title="Hora de finalización">
              ✓ Completado a las {new Date(timerLog.endTime).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}
            </span>
          )}
          {isCompleted && !timerLog?.endTime && <span className="text-green-500 text-xs font-medium">✓ Completado</span>}
          {isPaused && <span className="text-amber-500 text-xs font-medium animate-pulse">⏸ Pausado</span>}
        </h4>
        <div className="flex items-center gap-2">
          {isEditingDuration ? (
            <div className="flex items-center gap-1">
              <input 
                type="number" 
                value={tempDuration}
                onChange={e => setTempDuration(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const val = parseInt(tempDuration, 10);
                    if (!isNaN(val) && val > 0) setCustomDurationMinutes(val);
                    setIsEditingDuration(false);
                  }
                }}
                className="w-14 px-1 py-0.5 text-xs border rounded bg-white dark:bg-slate-700 border-slate-300 dark:border-slate-600 text-slate-800 dark:text-white focus:outline-none focus:border-copper"
                autoFocus
              />
              <button 
                onClick={() => {
                  const val = parseInt(tempDuration, 10);
                  if (!isNaN(val) && val > 0) setCustomDurationMinutes(val);
                  setIsEditingDuration(false);
                }}
                className="p-0.5 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
              >
                <Check size={14} />
              </button>
            </div>
          ) : (
            targetSecs > 0 && (
              <span 
                className="text-xs text-slate-500 dark:text-slate-400 cursor-pointer hover:text-copper transition-colors flex items-center gap-1"
                onClick={() => { if(!isRunning && !isCompleted) setIsEditingDuration(true); }}
                title={!isRunning && !isCompleted ? "Hacé clic para editar el tiempo objetivo" : ""}
              >
                {isRunning && remaining > 0 ? `Faltan ${formatTime(remaining)}` : `Objetivo: ${customDurationMinutes} min`}
                {!isRunning && !isCompleted && <Pencil size={10} className="opacity-50" />}
              </span>
            )
          )}
          {onToggleMute && (
            <button
              onClick={onToggleMute}
              className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
              title={alarmMuted ? "Activar sonido" : "Silenciar alarma"}
            >
              {alarmMuted ? <BellOff size={14} /> : <Bell size={14} />}
            </button>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4">
        <div className={`text-3xl font-mono font-bold tracking-wider min-w-[5ch] ${
          isCompleted ? 'text-green-600 dark:text-green-400' 
          : alarmTriggered ? 'text-amber-500 dark:text-amber-400 animate-pulse' 
          : isPaused ? 'text-amber-600 dark:text-amber-400'
          : 'text-slate-800 dark:text-copper'
        }`}>
          {formatTime(elapsed)}
        </div>
        
        <div className="flex gap-2">
          {/* Play / Pause button */}
          {!isCompleted && (
            <button 
              onClick={handleAction}
              className={`w-10 h-10 rounded-full flex items-center justify-center text-white transition-transform active:scale-95 shadow-md ${
                isRunning ? 'bg-amber-500 hover:bg-amber-600' 
                : isPaused ? 'bg-blue-500 hover:bg-blue-600' 
                : 'bg-green-500 hover:bg-green-600'
              }`}
              title={isRunning ? "Pausar" : isPaused ? "Reanudar" : "Iniciar"}
            >
              {isRunning 
                ? <Pause size={18} fill="currentColor" /> 
                : <Play size={18} fill="currentColor" className="ml-0.5" />
              }
            </button>
          )}
          
          {/* Stop button - only when running or paused */}
          {(isRunning || isPaused) && (
            <button 
              onClick={handleStop}
              className="w-10 h-10 rounded-full flex items-center justify-center bg-red-500 hover:bg-red-600 text-white transition-transform active:scale-95 shadow-md"
              title="Detener y finalizar"
            >
              <Square size={16} fill="currentColor" />
            </button>
          )}
        </div>
      </div>

      {targetSecs > 0 && (
        <div className="w-full bg-slate-200 dark:bg-zinc-700 h-1.5 rounded-full overflow-hidden mt-1 relative">
          <div 
            className={`h-full rounded-full transition-all duration-1000 ${
              progress >= 100 ? 'bg-amber-500' : 'bg-copper'
            }`} 
            style={{ width: `${progress}%` }}
          />
        </div>
      )}
    </div>
  );
};
