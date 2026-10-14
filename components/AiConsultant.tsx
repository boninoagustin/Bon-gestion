
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Send, Bot, Loader2, AlertCircle, Trash2, Sparkles } from 'lucide-react';
import { analyzeBrewingData } from '../services/geminiService';
import { useBreweryStore } from '../context/store';
import { buildAppSummary } from '../services/ai/actions';
import { DebouncedInput } from './ui/DebouncedInput';
import { BatchStatus } from '../types';

// Enhanced markdown renderer: bold, lists, headers, inline code, horizontal rules
const renderMarkdown = (text: string) => {
    return text.split('\n').map((line, i) => {
        // Horizontal rule
        if (line.trim() === '---' || line.trim() === '***') {
            return <hr key={i} className="border-zinc-200 dark:border-zinc-700 my-2" />;
        }

        // Headers
        if (line.startsWith('### ')) {
            return <h4 key={i} className="font-bold text-base text-zinc-900 dark:text-zinc-100 mt-3 mb-1">{processInline(line.slice(4))}</h4>;
        }
        if (line.startsWith('## ')) {
            return <h3 key={i} className="font-bold text-lg text-zinc-900 dark:text-zinc-100 mt-3 mb-1">{processInline(line.slice(3))}</h3>;
        }

        // Unordered list items
        if (line.match(/^\s*[-*]\s/)) {
            const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
            const content = line.replace(/^\s*[-*]\s/, '');
            return (
                <div key={i} className="flex items-start gap-2 py-0.5" style={{ paddingLeft: `${Math.min(indent * 8, 32)}px` }}>
                    <span className="text-copper mt-1.5 text-[8px]">●</span>
                    <span>{processInline(content)}</span>
                </div>
            );
        }

        // Numbered list items
        if (line.match(/^\s*\d+\.\s/)) {
            const match = line.match(/^(\s*)(\d+)\.\s(.*)/);
            if (match) {
                return (
                    <div key={i} className="flex items-start gap-2 py-0.5">
                        <span className="text-copper font-bold text-xs min-w-[1.2em] text-right">{match[2]}.</span>
                        <span>{processInline(match[3])}</span>
                    </div>
                );
            }
        }

        // Empty line = spacing
        if (line.trim() === '') {
            return <div key={i} className="h-2" />;
        }

        // Regular paragraph
        return (
            <React.Fragment key={i}>
                {processInline(line)}
                {i < text.split('\n').length - 1 && <br />}
            </React.Fragment>
        );
    });
};

// Process inline formatting: **bold**, `code`, *italic*
const processInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/((?:\*\*.*?\*\*)|(?:`[^`]+`))/g);
    return parts.map((part, j) => {
        if (part.startsWith('**') && part.endsWith('**')) {
            return <strong key={j} className="font-bold text-zinc-950 dark:text-zinc-100">{part.slice(2, -2)}</strong>;
        }
        if (part.startsWith('`') && part.endsWith('`')) {
            return <code key={j} className="bg-zinc-100 dark:bg-zinc-700 text-copper px-1.5 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>;
        }
        return <span key={j}>{part}</span>;
    });
};

const AI_CHAT_DB_KEY = 'brewmaster_ai_chat';
const defaultMessages: {role: 'user' | 'ai', content: string}[] = [{ role: 'ai', content: '¡Hola! Soy BrewMaster AI. Tengo acceso a **toda tu planta**: producción, inventario, finanzas, clientes, calendario, barriles, botellas y sesiones de cocción. ¿En qué te ayudo hoy?' }];

// Singleton DB connection to avoid opening/closing on every save
let chatDbPromise: Promise<IDBDatabase> | null = null;
const getChatDb = (): Promise<IDBDatabase> => {
  if (chatDbPromise) return chatDbPromise;
  chatDbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open('brewmaster_chat', 1);
    req.onupgradeneeded = () => { req.result.createObjectStore('chat'); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      chatDbPromise = null;
      reject(req.error);
    };
  });
  return chatDbPromise;
};

// Quick action categories
const QUICK_ACTIONS = [
  { label: '📋 ¿Qué tengo para hacer hoy?', prompt: '¿Qué tengo para hacer hoy? Revisá la agenda de hoy y tareas pendientes, fermentadores y barriles sucios para limpiar con CIP, clientes con deuda para cobrarles, stock crítico y el estado de los lotes en producción.' },
  { label: '🛢️ Fermentadores', prompt: '¿Cuál es el estado de todos mis fermentadores? Decime cuáles están ocupados (con qué lote, días y gravedad), cuáles sucios para CIP y cuáles disponibles.' },
  { label: '📊 Resumen de planta', prompt: 'Dame un resumen ejecutivo del estado actual de la planta: lotes activos, fermentadores, inventario bajo, barriles sucios, próximos eventos y deudas pendientes.' },
  { label: '💰 Finanzas del mes', prompt: '¿Cuánto vendí este mes, cuáles son mis gastos y cuál es mi margen? ¿Algún cliente me debe plata?' },
  { label: '🍺 Lotes activos', prompt: 'Dame un resumen detallado de mis lotes en producción con su fermentador asignado, estado, gravedad inicial/actual, temperatura y días de fermentación.' },
  { label: '📦 Stock bajo', prompt: '¿Tengo insumos con stock bajo o que necesite reponer pronto? Revisá también si hay algo vencido.' },
  { label: '🪣 Barriles sucios', prompt: '¿Qué barriles están sucios y necesitan CIP? ¿Cuántos tengo disponibles para llenar?' },
  { label: '📅 Agenda semanal', prompt: '¿Qué tengo programado para los próximos 7 días en el calendario? ¿Sugiero algún ajuste?' },
  { label: '🧪 Calidad', prompt: 'Revisá los perfiles sensoriales de mis últimos lotes. ¿Hay algún off-flavor recurrente o tendencia?' },
  { label: '🔥 ¿Puedo cocinar?', prompt: '¿Tengo suficientes insumos y fermentadores disponibles para cocinar mi próxima receta?' },
];

export const AiConsultant: React.FC = () => {
  const batches = useBreweryStore(s => s.batches);
  const fermenters = useBreweryStore(s => s.fermenters);
  const kegs = useBreweryStore(s => s.kegs);
  const bottles = useBreweryStore(s => s.bottles);
  const inventory = useBreweryStore(s => s.inventory);
  const settings = useBreweryStore(s => s.settings);
  const masterRecipes = useBreweryStore(s => s.masterRecipes);
  const updateSettings = useBreweryStore(s => s.updateSettings);
  const updateKegStatus = useBreweryStore(s => s.updateKegStatus);
  const updateInventory = useBreweryStore(s => s.updateInventory);
  const updateBatch = useBreweryStore(s => s.updateBatch);
  const addSale = useBreweryStore(s => s.addSale);
  const addPayment = useBreweryStore(s => s.addPayment);
  const addExpense = useBreweryStore(s => s.addExpense);
  const addCustomer = useBreweryStore(s => s.addCustomer);
  const updateCustomer = useBreweryStore(s => s.updateCustomer);
  const sales = useBreweryStore(s => s.sales);
  const expenses = useBreweryStore(s => s.expenses);
  const customers = useBreweryStore(s => s.customers);
  const calendarEvents = useBreweryStore(s => s.calendarEvents);
  const brewSessions = useBreweryStore(s => s.brewSessions);
  const financialHistory = useBreweryStore(s => s.financialHistory);
  const payments = useBreweryStore(s => s.payments);

  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<{role: 'user' | 'ai', content: string}[]>(defaultMessages);
  const isInitialLoadRef = useRef(true);

  // Load messages from IndexedDB on mount
  useEffect(() => {
    const loadChat = async () => {
      try {
        const db = await getChatDb();
        const tx = db.transaction('chat', 'readonly');
        const store = tx.objectStore('chat');
        const saved = await new Promise<any>((resolve) => {
          const req = store.get(AI_CHAT_DB_KEY);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(null);
        });
        if (saved && Array.isArray(saved) && saved.length > 0) {
          setMessages(saved);
        }
        isInitialLoadRef.current = false;
      } catch (e) {
        console.warn('[AI Chat] Could not load chat history from IndexedDB:', e);
        isInitialLoadRef.current = false;
      }
    };
    loadChat();
  }, []);

  // Persist messages to IndexedDB
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    
    const saveChat = async () => {
      try {
        const db = await getChatDb();
        const tx = db.transaction('chat', 'readwrite');
        tx.objectStore('chat').put(messages, AI_CHAT_DB_KEY);
        await new Promise<void>((resolve) => {
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        });
      } catch (e) {
        console.warn('[AI Chat] Could not save chat history:', e);
      }
    };
    saveChat();
  }, [messages]);

  const [isLoading, setIsLoading] = useState(false);

  // Build lightweight summary payload (RAG will fetch details if needed)
  const appDataPayload = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sections: string[] = [];

    // Context instructions for the AI
    sections.push("INFO: Tienes acceso a herramientas (Tools) para obtener detalles completos de Recetas, Lotes Activos, Inventario, Barriles y Finanzas. Usa las herramientas si necesitas más información que este resumen general.");

    const activeBatches = batches.filter(b => b.status !== BatchStatus.COMPLETED);
    sections.push(`Lotes activos: ${activeBatches.length}`);
    activeBatches.forEach(b => sections.push(`- ${b.recipeName} (${b.status}) [Código: ${b.lotCode}]`));

    const lowStock = inventory.filter(i => i.stockAmount <= 0);
    if (lowStock.length > 0) {
      sections.push(`Sin stock: ${lowStock.map(i => i.name).join(', ')}`);
    }

    const dirtyKegs = kegs.filter(k => k.status === 'DIRTY');
    sections.push(`Barriles sucios: ${dirtyKegs.length} (${dirtyKegs.map(k => k.id).join(', ')})`);

    const debtors = customers.filter(c => c.debt > 0);
    if (debtors.length > 0) {
      const totalDebt = debtors.reduce((sum, c) => sum + c.debt, 0);
      sections.push(`Deuda total de clientes: $${totalDebt.toFixed(0)} (${debtors.length} clientes con deuda)`);
    }

    const currentMonthSales = sales.filter(s => s.date.startsWith(currentMonthKey)).reduce((sum, s) => sum + s.amount, 0);
    const currentMonthExpenses = expenses.filter(e => e.date.startsWith(currentMonthKey)).reduce((sum, e) => sum + e.amount, 0);
    sections.push(`Mes actual (${currentMonthKey}) -> Ventas: $${currentMonthSales.toFixed(0)} | Gastos: $${currentMonthExpenses.toFixed(0)}`);

    return sections.join('\n');
  }, [batches, inventory, kegs, customers, sales, expenses]);

  const handleSend = async (explicitMsg?: string) => {
    const textToUse = typeof explicitMsg === 'string' ? explicitMsg : input;
    if (!textToUse.trim()) return;

    const userMsg = textToUse;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput('');
    setIsLoading(true);

    try {
      const currentHistory = [...messages, { role: 'user' as const, content: userMsg }];
      const appSummary = buildAppSummary();
      let response = await analyzeBrewingData(currentHistory, appSummary, settings, { isVoiceMode: false });

      // Parse memory save commands
      const memoriaRegex = /\[GUARDAR_MEMORIA:\s*"(.*?)"\]/i;
      const match = response.match(memoriaRegex);
      if (match && match[1]) {
          const nuevaRegla = match[1];
          const memoriaActual = settings.aiLongTermMemory || '';
          updateSettings({ aiLongTermMemory: memoriaActual ? memoriaActual + '\n- ' + nuevaRegla : '- ' + nuevaRegla });
          response = response.replace(memoriaRegex, '').trim();
      }

      setMessages(prev => [...prev, { role: 'ai', content: response }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', content: '❌ Error al procesar tu consulta. Verificá tu conexión a internet y que la API Key sea válida.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Data summary for footer
  const dataSummary = useMemo(() => {
    const activeLots = batches.filter(b => b.status !== BatchStatus.COMPLETED).length;
    const dirtyKegs = kegs.filter(k => k.status === 'DIRTY').length;
    const dirtyFermenters = (fermenters || []).filter(f => f.status === 'DIRTY').length;
    const debtors = customers.filter(c => c.debt > 0).length;
    const upcomingEvents = calendarEvents.filter(e => {
      const d = new Date(e.start);
      const now = new Date();
      return d >= now && d <= new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) && !e.completed;
    }).length;
    return { activeLots, dirtyKegs, dirtyFermenters, debtors, upcomingEvents, inventory: inventory.length, recipes: masterRecipes.length, bottles: bottles.reduce((s, b) => s + b.quantity, 0) };
  }, [batches, kegs, fermenters, customers, calendarEvents, inventory, masterRecipes, bottles]);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col">
      <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <Bot className="text-copper" />
                BrewMaster AI
            </h2>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Consultor integral de planta by Gemini</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
                onClick={() => setMessages([{ role: 'ai', content: '¡Conversación reseteada! ¿En qué te ayudo hoy?' }])}
                className="text-xs px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center gap-2 transition-colors cursor-pointer"
                title="Borrar historial y comenzar nueva sesión">
                <Trash2 size={14} />
                Nueva Sesión
            </button>
            <div className={`text-xs px-3 py-1.5 rounded-full border flex items-center gap-2 ${settings.apiKey ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 border-green-200 dark:border-green-800/50' : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/50'}`}>
               <AlertCircle size={12} />
               <span>{settings.apiKey ? 'Conectado' : 'Modo Demo (Sin Key)'}</span>
            </div>
          </div>
      </div>

      <div className="flex-1 bg-white dark:bg-zinc-900 rounded-xl shadow-sm border border-zinc-200 dark:border-zinc-700 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-zinc-50/50 dark:bg-zinc-950/50">
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] p-4 rounded-3xl text-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-slate-dark text-white rounded-br-sm shadow-md' 
                  : 'bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-bl-sm shadow-sm'
              }`}>
                {msg.role === 'ai' && (
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-700">
                    <Sparkles size={14} className="text-copper" />
                    <span className="text-[10px] font-bold text-copper uppercase tracking-wider">BrewMaster AI</span>
                  </div>
                )}
                {renderMarkdown(msg.content)}
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
                <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-4 rounded-3xl rounded-bl-sm shadow-sm flex items-center gap-3 text-zinc-500 dark:text-zinc-400 text-sm">
                    <Loader2 className="animate-spin text-copper" size={16} />
                    <span>Analizando toda la planta...</span>
                </div>
             </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-700">
          {/* Quick Actions - scrollable */}
          <div className="flex gap-2 mb-3 overflow-x-auto pb-2 scrollbar-thin">
            {QUICK_ACTIONS.map((action, idx) => (
              <button 
                key={idx}
                onClick={() => handleSend(action.prompt)} 
                disabled={isLoading}
                className="text-[11px] whitespace-nowrap bg-zinc-50 dark:bg-zinc-700 hover:bg-copper/10 dark:hover:bg-copper/20 hover:border-copper/30 text-zinc-700 dark:text-zinc-300 px-3 py-1.5 rounded-full transition-colors border border-zinc-200 dark:border-zinc-600 disabled:opacity-50 shrink-0"
              >
                {action.label}
              </button>
            ))}
          </div>

          <div className="flex gap-2">
            <DebouncedInput
              type="text"
              value={input || ''}
              onDebouncedChange={setInput}
              onEnter={(val) => handleSend(val)}
              placeholder="Preguntame lo que necesites sobre tu planta..."
              className="flex-1 border border-zinc-300 dark:border-zinc-600 rounded-xl px-4 py-2.5 focus:ring-2 focus:ring-copper outline-none bg-white dark:bg-zinc-950 text-zinc-950 dark:text-zinc-100"
            />
            <button 
                onClick={() => handleSend()}
                disabled={isLoading}
                className="bg-copper hover:bg-copper-dark text-white p-2.5 rounded-xl disabled:opacity-50 transition shadow-sm"
            >
              <Send size={20} />
            </button>
          </div>
          
          {/* Data indicators */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-3 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
             <span className="flex items-center gap-1" title="Lotes activos"><span className="w-2 h-2 rounded-full bg-green-500 shadow-sm"></span> Lotes ({dataSummary.activeLots})</span>
             <span className="flex items-center gap-1" title="Fermentadores"><span className="w-2 h-2 rounded-full bg-cyan-500 shadow-sm"></span> Fermentadores ({fermenters.length})</span>
             <span className="flex items-center gap-1" title="Items en inventario"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-sm"></span> Inventario ({dataSummary.inventory})</span>
             <span className="flex items-center gap-1" title="Barriles"><span className="w-2 h-2 rounded-full bg-orange-500 shadow-sm"></span> Barriles ({kegs.length})</span>
             <span className="flex items-center gap-1" title="Recetas"><span className="w-2 h-2 rounded-full bg-purple-500 shadow-sm"></span> Recetas ({dataSummary.recipes})</span>
             <span className="flex items-center gap-1" title="Clientes"><span className="w-2 h-2 rounded-full bg-pink-500 shadow-sm"></span> Clientes ({customers.length})</span>
             <span className="flex items-center gap-1" title="Ventas este período"><span className="w-2 h-2 rounded-full bg-emerald-500 shadow-sm"></span> Ventas ({sales.length})</span>
             {dataSummary.dirtyFermenters > 0 && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold" title="Fermentadores sucios">🛢️ {dataSummary.dirtyFermenters} tanques sucios</span>}
             {dataSummary.dirtyKegs > 0 && <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-bold" title="Barriles sucios">⚠️ {dataSummary.dirtyKegs} barriles sucios</span>}
             {dataSummary.debtors > 0 && <span className="flex items-center gap-1 text-red-600 dark:text-red-400 font-bold" title="Clientes con deuda">💸 {dataSummary.debtors} deudores</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export const AiConsultantMemo = React.memo(AiConsultant);
