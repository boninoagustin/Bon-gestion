
import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Database, Download, Upload, Key, CheckCircle2, AlertTriangle, Moon, Sun, Globe, DollarSign, Folder, LogOut, Cpu } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { DebouncedInput } from './ui/DebouncedInput';
import { downloadErrorLogs } from '../lib/errorLogger';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CURRENCIES = [
  { code: 'ARS', symbol: '$', name: 'Peso Argentino' },
  { code: 'USD', symbol: 'US$', name: 'Dólar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'BRL', symbol: 'R$', name: 'Real' },
  { code: 'CLP', symbol: 'CL$', name: 'Peso Chileno' },
  { code: 'MXN', symbol: 'MX$', name: 'Peso Mexicano' },
  { code: 'UYU', symbol: 'UY$', name: 'Peso Uruguayo' },
];

interface ModelOption {
  id: string;
  name: string;
  category: string;
  recommended?: boolean;
}

const OPENAI_MODELS: ModelOption[] = [
  // Serie GPT-6
  { id: 'gpt-6-astra', name: 'GPT-6 Astra (Insignia Omnipotente)', category: 'Serie GPT-6 (Máxima Potencia)', recommended: true },
  { id: 'gpt-6.1-sol', name: 'GPT-6.1 Sol (Veloz y Analítico)', category: 'Serie GPT-6 (Máxima Potencia)' },
  { id: 'gpt-6-sol', name: 'GPT-6 Sol (Alto Rendimiento)', category: 'Serie GPT-6 (Máxima Potencia)' },
  { id: 'gpt-6-luna', name: 'GPT-6 Luna (Equilibrado y Eficiente)', category: 'Serie GPT-6 (Máxima Potencia)' },

  // Serie GPT-5.6
  { id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol (Rendimiento Avanzado)', category: 'Serie GPT-5.6' },
  { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra (Tareas Operativas)', category: 'Serie GPT-5.6' },
  { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna (Rápido y Optimizado)', category: 'Serie GPT-5.6' },
  { id: 'gpt-5.6-cyber', name: 'GPT-5.6 Cyber (Sistemas y Lógica)', category: 'Serie GPT-5.6' },

  // Serie GPT-5
  { id: 'gpt-5.4', name: 'GPT-5.4', category: 'Serie GPT-5' },
  { id: 'gpt-5.3', name: 'GPT-5.3', category: 'Serie GPT-5' },
  { id: 'gpt-5.2', name: 'GPT-5.2', category: 'Serie GPT-5' },
  { id: 'gpt-5.1', name: 'GPT-5.1', category: 'Serie GPT-5' },
  { id: 'gpt-5', name: 'GPT-5', category: 'Serie GPT-5' },

  // Serie GPT-4.1
  { id: 'gpt-4.1', name: 'GPT-4.1 (Estándar Confiable)', category: 'Serie GPT-4.1' },
  { id: 'gpt-4.1-mini', name: 'GPT-4.1 mini (Rápido y Liviano)', category: 'Serie GPT-4.1' },
  { id: 'gpt-4.1-nano', name: 'GPT-4.1 nano (Ultra Rápido)', category: 'Serie GPT-4.1' },

  // Modelos Abiertos (Open Weights)
  { id: 'gpt-oss-120b', name: 'gpt-oss-120b (Gran Escala Abierta)', category: 'Modelos Abiertos (OSS)' },
  { id: 'gpt-oss-20b', name: 'gpt-oss-20b (Compacto y Rápido)', category: 'Modelos Abiertos (OSS)' },
  { id: 'gpt-oss-safeguard', name: 'gpt-oss-safeguard (Filtro de Seguridad)', category: 'Modelos Abiertos (OSS)' },

  // Live & Audio
  { id: 'gpt-live-1', name: 'GPT-Live-1 (Interactivo)', category: 'Live & Tiempo Real' },
  { id: 'gpt-live-1-mini', name: 'GPT-Live-1-mini', category: 'Live & Tiempo Real' },
  { id: 'gpt-audio-1.5', name: 'GPT-Audio-1.5', category: 'Live & Tiempo Real' },
  { id: 'gpt-realtime-2.1', name: 'GPT-Realtime-2.1', category: 'Live & Tiempo Real' },
  { id: 'gpt-realtime-2.1-mini', name: 'GPT-Realtime-2.1 Mini', category: 'Live & Tiempo Real' },

  // Multimedia
  { id: 'gpt-image-2.5', name: 'GPT Image 2.5', category: 'Multimedia y Generación' },
  { id: 'sora-2', name: 'Sora 2', category: 'Multimedia y Generación' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const settings = useBreweryStore(s => s.settings);
  const updateSettings = useBreweryStore(s => s.updateSettings);
  const downloadBackup = useBreweryStore(s => s.downloadBackup);
  const restoreBackup = useBreweryStore(s => s.restoreBackup);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showSaved, setShowSaved] = useState(false);
  
  // State for custom restore flow
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // ChatGPT connection state & dynamic models
  const [chatGptConnected, setChatGptConnected] = useState<boolean | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [remoteModels, setRemoteModels] = useState<{ id: string; name?: string }[]>([]);
  const [isCustomModel, setIsCustomModel] = useState(false);
  const [customModelInput, setCustomModelInput] = useState('');

  const isDarkMode = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');

  const checkChatGptStatus = () => {
    if (typeof window !== 'undefined' && (window as any).electronAPI?.checkOpenAIStatus) {
      (window as any).electronAPI.checkOpenAIStatus().then(async (res: any) => {
        const isConn = !!res?.connected;
        setChatGptConnected(isConn);
        if (isConn && (window as any).electronAPI?.getOpenAIModels) {
          try {
            const modRes = await (window as any).electronAPI.getOpenAIModels();
            if (modRes?.models && Array.isArray(modRes.models)) {
              setRemoteModels(modRes.models.map((m: any) => ({
                id: m.id || m.slug,
                name: m.name || m.slug || m.id
              })));
            }
          } catch (_) {}
        }
      }).catch(() => {
        setChatGptConnected(false);
      });
    }
  };

  useEffect(() => {
      if (isOpen) {
          setApiKeyInput(settings.apiKey || '');
          setPendingFile(null);
          setRestoreStatus('idle');
          checkChatGptStatus();

          const current = settings.chatGptModel || 'gpt-6-astra';
          const isStandard = OPENAI_MODELS.some(m => m.id === current);
          if (!isStandard && current) {
            setIsCustomModel(true);
            setCustomModelInput(current);
          } else {
            setIsCustomModel(false);
          }
      }
  }, [isOpen, settings.apiKey, settings.chatGptModel]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setPendingFile(file);
      setRestoreStatus('idle');
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const confirmRestore = async () => {
      if (!pendingFile) return;
      const success = await restoreBackup(pendingFile);
      if (!success) {
          setRestoreStatus('error');
          setPendingFile(null);
      }
  };

  const cancelRestore = () => {
      setPendingFile(null);
      setRestoreStatus('idle');
  };

  const handleSaveApiKey = () => {
      updateSettings({ apiKey: apiKeyInput.trim() });
      setShowSaved(true);
      setTimeout(() => setShowSaved(false), 2000);
  };

  const toggleDarkMode = () => {
    const newValue = !isDarkMode;
    document.documentElement.classList.toggle('dark', newValue);
    document.body.classList.toggle('dark', newValue);
    localStorage.setItem('bon_dark_mode', String(newValue));
  };

  if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4 backdrop-blur-md animate-in fade-in">
            <div className="bg-white/95 dark:bg-zinc-900/95 rounded-2xl shadow-2xl backdrop-blur-xl w-full max-w-sm overflow-hidden flex flex-col max-h-[90vh] border border-white/20 dark:border-zinc-700/50">
                <div className="p-5 border-b border-zinc-200/50 dark:border-zinc-800/50 flex justify-between items-center bg-zinc-50/50 dark:bg-zinc-800/30">
                    <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                        <Database size={20} className="text-copper"/> Configuración Global
                    </h3>
                    <button onClick={onClose} className="p-2 rounded-full hover:bg-zinc-200/50 dark:hover:bg-zinc-700/50 transition-colors"><X size={18} className="text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200" /></button>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                
                {/* DARK MODE & DISPLAY */}
                <div>
                    <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">Apariencia</h4>
                    <button 
                        onClick={toggleDarkMode}
                        className="w-full flex items-center justify-between p-3.5 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-700/80 hover:border-copper/50 transition-all shadow-sm active:scale-[0.98]"
                    >
                        <div className="flex items-center gap-3">
                            {isDarkMode ? <Moon size={18} className="text-blue-400" /> : <Sun size={18} className="text-amber-500" />}
                            <span className="text-sm font-bold text-zinc-700 dark:text-zinc-200">{isDarkMode ? 'Modo Oscuro' : 'Modo Claro'}</span>
                        </div>
                        <div className={`w-11 h-6 rounded-full relative transition-colors ${isDarkMode ? 'bg-copper' : 'bg-zinc-300 dark:bg-zinc-600'}`}>
                            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isDarkMode ? 'left-[22px]' : 'left-0.5'}`} />
                        </div>
                    </button>
                </div>

                {/* CURRENCY */}
                <div>
                    <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Globe size={16} className="text-copper"/> Moneda
                    </h4>
                    <select 
                        value={settings.currency || 'ARS'}
                        onChange={(e) => updateSettings({ currency: e.target.value })}
                        className="w-full border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-3 text-sm bg-white dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none shadow-sm transition-all font-medium"
                    >
                        {CURRENCIES.map(c => (
                            <option key={c.code} value={c.code}>{c.symbol} — {c.name} ({c.code})</option>
                        ))}
                    </select>
                </div>

                <div className="border-t border-zinc-200/50 dark:border-zinc-800/50"></div>

                {/* API KEY SECTION */}
                <div>
                    <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2"><Key size={16} className="text-copper"/> Configuración de IA</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mb-3 leading-relaxed">Selecciona el motor de Inteligencia Artificial que prefieres usar.</p>
                    
                    <div className="mb-4">
                        <select
                            value={settings.aiProvider || 'gemini'}
                            onChange={(e) => updateSettings({ aiProvider: e.target.value as 'gemini' | 'chatgpt' })}
                            className="w-full border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-3 text-sm bg-white dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none shadow-sm"
                        >
                            <option value="gemini">Google Gemini (API Key)</option>
                            <option value="chatgpt">ChatGPT (vía OAuth) - Solo en Escritorio</option>
                        </select>
                    </div>

                    {(!settings.aiProvider || settings.aiProvider === 'gemini') && (
                        <>
                            <div className="relative">
                                <DebouncedInput 
                                    type="password" 
                                    value={apiKeyInput}
                                    onDebouncedChange={(val) => setApiKeyInput(val.toString())}
                                    placeholder="Pega tu API Key de Gemini aquí..."
                                    className="w-full border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-3 pr-10 text-sm bg-white dark:bg-zinc-900/60 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-copper/50 outline-none shadow-sm font-mono"
                                />
                                {showSaved && <CheckCircle2 className="absolute right-3 top-3 text-emerald-500 animate-in zoom-in" size={18} />}
                            </div>
                            <button onClick={handleSaveApiKey} className="mt-3 text-xs bg-zinc-900 dark:bg-zinc-800 hover:bg-zinc-800 dark:hover:bg-zinc-700 text-white dark:text-zinc-200 px-3 py-2.5 rounded-xl font-bold border border-transparent dark:border-zinc-700/50 transition-all shadow-sm w-full active:scale-95">
                                Guardar Key
                            </button>
                        </>
                    )}
                    <div className="mt-3 text-[10px] text-zinc-400 text-center">
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="underline hover:text-copper transition-colors">Conseguir API Key Gratis</a>
                    </div>
                </div>

                <div className="border-t border-zinc-200/50 dark:border-zinc-800/50"></div>

                {settings.aiProvider === 'chatgpt' && (
                    <div>
                        <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center justify-between">
                            <span className="flex items-center gap-2"><Globe size={16} className="text-copper"/> Conexión con ChatGPT (OAuth)</span>
                            {chatGptConnected !== null && (
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1.5 ${chatGptConnected ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-500'}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${chatGptConnected ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`}></span>
                                    {chatGptConnected ? 'Conectado' : 'Sin vincular'}
                                </span>
                            )}
                        </h4>
                        <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mb-3 leading-relaxed">Conecta tu cuenta personal de ChatGPT. Las peticiones viajan desde tu IP local a través de la aplicación de escritorio.</p>
                        
                        <div className="w-full flex flex-col p-4 bg-zinc-50 dark:bg-zinc-900/60 rounded-xl border border-zinc-200 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 space-y-3">
                            {typeof window !== 'undefined' && (window as any).electronAPI ? (
                                <>
                                    {chatGptConnected ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between p-2.5 bg-emerald-50/50 dark:bg-emerald-950/20 rounded-lg border border-emerald-200/50 dark:border-emerald-800/40 text-xs">
                                                <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-semibold">
                                                    <CheckCircle2 size={16} /> Sesión activa vinculada
                                                </div>
                                                <button
                                                    onClick={async () => {
                                                        const res = await (window as any).electronAPI.logoutOpenAI();
                                                        if (res?.success) {
                                                            setChatGptConnected(false);
                                                        }
                                                    }}
                                                    className="text-[11px] text-rose-500 hover:text-rose-600 font-bold hover:underline flex items-center gap-1"
                                                >
                                                    <LogOut size={12} /> Desvincular
                                                </button>
                                            </div>

                                            {/* Selector de modelo */}
                                            <div>
                                                <div className="flex items-center justify-between mb-1.5">
                                                    <label className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider flex items-center gap-1">
                                                        <Cpu size={12} className="text-copper" /> Modelo de Inteligencia
                                                    </label>
                                                    <span className="text-[9px] text-zinc-400 font-mono">Actualizado 2026</span>
                                                </div>
                                                <select
                                                    value={isCustomModel ? '__custom__' : (settings.chatGptModel || 'gpt-6-astra')}
                                                    onChange={(e) => {
                                                        if (e.target.value === '__custom__') {
                                                            setIsCustomModel(true);
                                                        } else {
                                                            setIsCustomModel(false);
                                                            updateSettings({ chatGptModel: e.target.value });
                                                        }
                                                    }}
                                                    className="w-full border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-2.5 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-copper/50"
                                                >
                                                    {Array.from(new Set(OPENAI_MODELS.map(m => m.category))).map(cat => (
                                                        <optgroup key={cat} label={cat}>
                                                            {OPENAI_MODELS.filter(m => m.category === cat).map(m => (
                                                                <option key={m.id} value={m.id}>
                                                                    {m.name}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    ))}

                                                    {/* Modelos adicionales detectados dinámicamente de la cuenta */}
                                                    {remoteModels.filter(rm => !OPENAI_MODELS.some(om => om.id === rm.id)).length > 0 && (
                                                        <optgroup label="Modelos Adicionales de tu Cuenta">
                                                            {remoteModels.filter(rm => !OPENAI_MODELS.some(om => om.id === rm.id)).map(rm => (
                                                                <option key={rm.id} value={rm.id}>
                                                                    {rm.name || rm.id}
                                                                </option>
                                                            ))}
                                                        </optgroup>
                                                    )}

                                                    <optgroup label="Personalizado">
                                                        <option value="__custom__">✏️ Escribir otro modelo manualmente...</option>
                                                    </optgroup>
                                                </select>

                                                {isCustomModel && (
                                                    <div className="mt-2 flex gap-2 animate-in fade-in">
                                                        <input
                                                            type="text"
                                                            value={customModelInput}
                                                            onChange={(e) => setCustomModelInput(e.target.value)}
                                                            placeholder="Ej: gpt-6-astra..."
                                                            className="flex-1 border border-zinc-200 dark:border-zinc-700/80 rounded-xl p-2 text-xs bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 outline-none focus:ring-2 focus:ring-copper/50 font-mono"
                                                        />
                                                        <button
                                                            onClick={() => {
                                                                if (customModelInput.trim()) {
                                                                    updateSettings({ chatGptModel: customModelInput.trim() });
                                                                    setShowSaved(true);
                                                                    setTimeout(() => setShowSaved(false), 2000);
                                                                }
                                                            }}
                                                            className="bg-copper hover:bg-copper/90 text-white px-3 py-1.5 rounded-xl text-xs font-bold shadow-sm active:scale-95 transition-all"
                                                        >
                                                            Aplicar
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="text-center space-y-2">
                                            <p className="text-xs text-zinc-500">Haz clic para abrir el inicio de sesión en tu navegador y vincular tu cuenta.</p>
                                            <button 
                                                disabled={isLoggingIn}
                                                onClick={async () => {
                                                    setIsLoggingIn(true);
                                                    try {
                                                        const res = await (window as any).electronAPI.loginOpenAI();
                                                        if (res?.error) {
                                                            alert("Error: " + res.error);
                                                        } else {
                                                            checkChatGptStatus();
                                                        }
                                                    } finally {
                                                        setIsLoggingIn(false);
                                                    }
                                                }}
                                                className="w-full bg-copper hover:bg-copper/90 text-white font-bold py-2.5 px-4 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 text-xs active:scale-95 disabled:opacity-50"
                                            >
                                                <Globe size={16} />
                                                {isLoggingIn ? "Esperando inicio de sesión..." : "Vincular cuenta de ChatGPT"}
                                            </button>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="text-xs text-amber-600 dark:text-amber-400 font-medium text-center">
                                    Esta funcionalidad requiere ejecutar BON como aplicación de escritorio (Electron).
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <div className="border-t border-zinc-200/50 dark:border-zinc-800/50"></div>

                {/* ERROR LOGS */}
                <div>
                    <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-2"><AlertTriangle size={16} className="text-amber-500"/> Logs de Error</h4>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-500 mb-3 leading-relaxed">Descarga el registro de fallos técnicos para soporte.</p>
                    <button 
                        onClick={() => {
                            downloadErrorLogs();
                        }}
                        className="w-full py-2.5 bg-zinc-50/50 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-700/50 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 rounded-xl text-xs font-bold shadow-sm active:scale-95"
                    >
                        <Download size={16} /> Descargar Logs
                    </button>
                </div>

                <div className="border-t border-zinc-200/50 dark:border-zinc-800/50"></div>

                {/* BACKUP SECTION */}
                <div className="text-center pb-4">
                    <h4 className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-4 flex items-center justify-center gap-2">Copias de Seguridad</h4>
                    
                    {pendingFile ? (
                        <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-700/50 rounded-xl p-5 text-left animate-in zoom-in-95 duration-200 shadow-sm">
                            <div className="flex items-start gap-4 mb-4">
                                <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={24} />
                                <div>
                                    <h5 className="font-bold text-amber-900 dark:text-amber-200 text-sm">¿Restaurar Copia de Seguridad?</h5>
                                    <p className="text-[10px] text-amber-800/80 dark:text-amber-300/80 mt-1.5 leading-relaxed">
                                        <strong>ADVERTENCIA CRÍTICA:</strong> Esta acción SOBRESCRIBIRÁ todos los datos actuales de la aplicación (Lotes, Inventario, Ventas). No se puede deshacer.
                                    </p>
                                    <p className="text-[10px] text-amber-900/60 dark:text-amber-200/50 mt-3 font-mono bg-white/50 dark:bg-black/20 p-1.5 rounded-lg truncate inline-block max-w-full border border-amber-200/50 dark:border-amber-700/30">{pendingFile.name}</p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <button onClick={cancelRestore} className="flex-1 py-2.5 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700/80 text-zinc-600 dark:text-zinc-300 rounded-xl text-xs font-bold hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors shadow-sm active:scale-95">
                                    Cancelar
                                </button>
                                <button onClick={confirmRestore} className="flex-1 py-2.5 bg-red-600 dark:bg-red-600/90 text-white rounded-xl text-xs font-bold hover:bg-red-700 dark:hover:bg-red-600 shadow-sm shadow-red-500/20 transition-all active:scale-95">
                                    Sí, Restaurar
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                            {typeof window !== 'undefined' && (window as any).electronAPI?.openBackupFolder && (
                                <button 
                                    onClick={() => (window as any).electronAPI.openBackupFolder()} 
                                    className="w-full py-2.5 bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/80 text-zinc-700 dark:text-zinc-300 rounded-xl font-bold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all flex items-center justify-center gap-2 mb-3 text-xs active:scale-95"
                                >
                                    <Folder size={16} className="text-copper" /> Abrir Carpeta de Backups Locales
                                </button>
                            )}

                            <button onClick={downloadBackup} className="w-full py-3 bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-400 rounded-xl font-bold hover:bg-emerald-100 dark:hover:bg-emerald-900/20 transition-all flex items-center justify-center gap-2 mb-3 shadow-sm active:scale-95">
                                <Download size={18} /> Descargar Backup
                            </button>

                            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".json" className="hidden" />
                            <button onClick={() => fileInputRef.current?.click()} className="w-full py-3 bg-white dark:bg-zinc-900/60 border-2 border-copper/80 text-copper rounded-xl font-bold hover:bg-copper/5 hover:border-copper transition-all flex items-center justify-center gap-2 shadow-sm active:scale-95">
                                <Upload size={18} /> Restaurar Datos
                            </button>
                            
                            {restoreStatus === 'error' && (
                                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-700/50 text-red-600 dark:text-red-400 text-xs rounded-xl font-medium flex items-center justify-center gap-2 animate-in slide-in-from-top-2">
                                    <X size={16} className="shrink-0" /> Error: Archivo dañado o inválido.
                                </div>
                            )}

                            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-4 leading-relaxed max-w-[250px] mx-auto">Útil para transferir datos entre PC y Celular, o resguardar tu progreso.</p>
                        </>
                    )}
                </div>
            </div>
        </div>
    </div>,
    document.body
  );
};
