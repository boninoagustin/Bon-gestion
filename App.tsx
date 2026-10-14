import { ErrorBoundary } from "./components/ErrorBoundary";


import React, { useState, useEffect, lazy, Suspense } from 'react';
import { Sidebar } from './components/Sidebar';
import { IntroAnimation } from './components/IntroAnimation';
import { SettingsModal } from './components/SettingsModal';
import { SearchDialog } from './components/SearchDialog';
import { ToastProvider, useToast } from './components/Toast';
import { ViewState } from './types';
import { LayoutDashboard, Factory, Beer, Bot, Package, Calculator, Users, Settings, BookOpen, Calendar, Search, Moon, Sun, Menu, X } from 'lucide-react';
import { BreweryProvider, useBrewery } from './context/BreweryContext';
import { useBreweryStore } from './context/store';
import { VoiceAssistant } from './components/VoiceAssistant';

const AlarmSystem = () => {
  const { calendarEvents, batches, inventory } = useBrewery();
  const { showToast } = useToast();

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const todaysEvents = calendarEvents.filter(e => e.start === today && !e.completed);

    // Insumos críticos sin stock
    const criticalStockItems = (inventory || []).filter(i => i.stockAmount <= 0);

    const alreadyNotified = sessionStorage.getItem('bon_alarm_notified');
    if (alreadyNotified !== today) {
      if (todaysEvents.length > 0 || criticalStockItems.length > 0) {
        try {
          const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          if (audioCtx.state === 'suspended') {
              const playOnInteraction = () => {
                 if (audioCtx.state === 'suspended') audioCtx.resume();
                 const oscillator = audioCtx.createOscillator();
                 const gainNode = audioCtx.createGain();
                 oscillator.type = 'sine';
                 oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
                 gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                 oscillator.connect(gainNode);
                 gainNode.connect(audioCtx.destination);
                 oscillator.start();
                 setTimeout(() => oscillator.stop(), 300);
                 document.removeEventListener('click', playOnInteraction);
              };
              document.addEventListener('click', playOnInteraction);
          } else {
             const oscillator = audioCtx.createOscillator();
             const gainNode = audioCtx.createGain();
             oscillator.type = 'sine';
             oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
             gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
             oscillator.connect(gainNode);
             gainNode.connect(audioCtx.destination);
             oscillator.start();
             setTimeout(() => oscillator.stop(), 300);
          }
        } catch(e) {
          console.error("Audio API not supported or blocked");
        }

        // Notificación en Toast de la app
        let message = '';
        if (todaysEvents.length > 0) {
          message = `⏰ ¡Tenés ${todaysEvents.length} recordatorio(s) pendiente(s) para hoy!`;
        } else if (criticalStockItems.length > 0) {
          message = `⚠️ Insumo(s) crítico(s) sin stock: ${criticalStockItems.map(i => i.name).slice(0, 2).join(', ')}`;
        }
        
        if (message) {
          showToast({ message, type: 'info' });
        }

        // Notificación nativa de escritorio en Electron
        if (typeof window !== 'undefined' && (window as any).electronAPI?.sendNotification) {
          if (todaysEvents.length > 0) {
            (window as any).electronAPI.sendNotification(
              'Recordatorios de Hoy - BON',
              `Tienes ${todaysEvents.length} tarea(s) o cocción(es) programadas para hoy.`
            );
          } else if (criticalStockItems.length > 0) {
            (window as any).electronAPI.sendNotification(
              'Alerta de Stock - BON',
              `${criticalStockItems.length} insumo(s) agotados en inventario.`
            );
          }
        }
        
        sessionStorage.setItem('bon_alarm_notified', today);
      }
    }
  }, [calendarEvents, batches, inventory, showToast]);

  return null;
};

const AutoBackupSystem = () => {
  useEffect(() => {
    if (typeof window === 'undefined' || !(window as any).electronAPI?.saveAutoBackup) return;

    const performBackup = async () => {
      try {
        const state = useBreweryStore.getState();
        const backupData = {
          timestamp: new Date().toISOString(),
          version: "1.2",
          batches: state.batches,
          inventory: state.inventory,
          kegs: state.kegs,
          bottles: state.bottles,
          fermenters: state.fermenters,
          sales: state.sales,
          expenses: state.expenses,
          settings: state.settings,
          financialHistory: state.financialHistory,
          customers: state.customers,
          payments: state.payments,
          shoppingList: state.shoppingList,
          masterRecipes: state.masterRecipes,
          calendarEvents: state.calendarEvents,
          annualOverrides: state.annualOverrides,
          brewSessions: state.brewSessions
        };
        await (window as any).electronAPI.saveAutoBackup(backupData);
      } catch (err) {
        console.error("Auto backup error:", err);
      }
    };

    // Respaldo silencioso 3 segundos después del inicio
    const initTimer = setTimeout(performBackup, 3000);

    // Respaldo periódico cada 30 minutos
    const interval = setInterval(performBackup, 30 * 60 * 1000);

    // Respaldo al cerrar
    const handleBeforeUnload = () => {
      performBackup();
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearTimeout(initTimer);
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

  return null;
};

// Lazy load heavy components for code splitting
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Production = lazy(() => import('./components/Production').then(m => ({ default: m.Production })));
const Inventory = lazy(() => import('./components/Inventory').then(m => ({ default: m.Inventory })));
const Packaging = lazy(() => import('./components/Packaging').then(m => ({ default: m.Packaging })));
const Calculators = lazy(() => import('./components/Calculators').then(m => ({ default: m.Calculators })));
const AiConsultant = lazy(() => import('./components/AiConsultant').then(m => ({ default: m.AiConsultantMemo })));
const CRM = lazy(() => import('./components/CRM').then(m => ({ default: m.CRM })));
const RecipeLibrary = lazy(() => import('./components/RecipeLibrary').then(m => ({ default: m.RecipeLibrary })));
const ProductionCalendar = lazy(() => import('./components/ProductionCalendar').then(m => ({ default: m.ProductionCalendar })));

// Loading fallback for lazy components
const LoadingFallback = () => (
  <div className="space-y-4 animate-fade-in">
    <div className="skeleton h-8 w-48"></div>
    <div className="skeleton h-4 w-32"></div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
      <div className="skeleton h-32 rounded-xl"></div>
      <div className="skeleton h-32 rounded-xl"></div>
      <div className="skeleton h-32 rounded-xl"></div>
    </div>
    <div className="skeleton h-64 rounded-xl mt-4"></div>
  </div>
);

export default function App() {
  return (
    <BreweryProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </BreweryProvider>
  );
}

function AppContent() {
  const [currentView, setCurrentView] = useState<ViewState>(ViewState.DASHBOARD);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMobileMoreOpen, setIsMobileMoreOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bon_dark_mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const { isLoading: isDbLoading } = useBrewery();

  // Dark mode effect
  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.body.classList.toggle('dark', isDarkMode);
    localStorage.setItem('bon_dark_mode', String(isDarkMode));
  }, [isDarkMode]);

  // Global keyboard shortcut for search (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Escuchar navegación solicitada por el asistente IA (voz o texto)
  useEffect(() => {
    const handleAiNavigate = (e: any) => {
      if (e.detail?.view) {
        setCurrentView(e.detail.view);
      }
    };
    window.addEventListener('bon:navigate', handleAiNavigate);
    return () => window.removeEventListener('bon:navigate', handleAiNavigate);
  }, []);

  const renderContent = () => {
    if (isDbLoading) return <LoadingFallback />;
    switch (currentView) {
      case ViewState.DASHBOARD:
        return <Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>;
      case ViewState.PRODUCTION:
        return (
          <ErrorBoundary>
            <Suspense fallback={<LoadingFallback />}><Production /></Suspense>
          </ErrorBoundary>
        );
      case ViewState.RECIPES:
        return <Suspense fallback={<LoadingFallback />}><RecipeLibrary /></Suspense>;
      case ViewState.CALENDAR:
        return <Suspense fallback={<LoadingFallback />}><ProductionCalendar /></Suspense>;
      case ViewState.INVENTORY:
        return <Suspense fallback={<LoadingFallback />}><Inventory /></Suspense>;
      case ViewState.PACKAGING:
        return <Suspense fallback={<LoadingFallback />}><Packaging /></Suspense>;
      case ViewState.CALCULATORS:
        return <Suspense fallback={<LoadingFallback />}><Calculators /></Suspense>;
      case ViewState.AI_CONSULTANT:
        return <Suspense fallback={<LoadingFallback />}><AiConsultant /></Suspense>;
      case ViewState.CRM:
        return <Suspense fallback={<LoadingFallback />}><CRM /></Suspense>;
      default:
        return <Suspense fallback={<LoadingFallback />}><Dashboard /></Suspense>;
    }
  };

  const BottomNavItem = ({ view, label, icon: Icon }: { view: ViewState, label: string, icon: React.ElementType }) => {
    const isActive = currentView === view;
    return (
      <button
        onClick={() => {
          setCurrentView(view);
          setIsMobileMoreOpen(false);
        }}
        className={`flex flex-col items-center justify-center min-w-[60px] py-2 transition-all duration-200 ${
          isActive ? 'text-copper scale-105' : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
        <span className="text-[9px] mt-1 font-medium leading-none whitespace-nowrap">{label}</span>
      </button>
    );
  };

  return (
    <>
      <AlarmSystem />
      <AutoBackupSystem />
      {/* Splash Screen Animation */}
      <IntroAnimation />

      {/* Search Dialog */}
      <SearchDialog isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} onNavigate={setCurrentView} />

      <div className="flex min-h-screen bg-craft font-sans text-slate-900 dark:text-slate-100 overflow-hidden">
        
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

        {/* Desktop Sidebar */}
        <div className="hidden lg:block">
          <Sidebar 
            currentView={currentView} 
            setCurrentView={setCurrentView} 
            isMobileOpen={false}
            closeMobileMenu={() => {}}
          />
        </div>
        
        <main className="flex-1 flex flex-col h-screen relative w-full">
          {/* Mobile Top Header */}
          <div className="lg:hidden bg-slate-dark/90 dark:bg-zinc-950/80 backdrop-blur-md text-white px-4 py-3 flex items-center justify-between shrink-0 z-10 shadow-md sticky top-0 border-b border-white/5">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 flex items-center justify-center">
                 <img src="icon.png" alt="BON" className="w-full h-full object-contain" />
               </div>
               <div className="text-copper">
                 <h1 className="font-extrabold text-lg leading-none font-display tracking-tight">BON</h1>
                 <p className="italic text-xs -mt-1 font-display">artesanal</p>
               </div>
            </div>
            <div className="flex items-center gap-2">
                {/* Search Button */}
                <button 
                    onClick={() => setIsSearchOpen(true)}
                    className="text-slate-300 hover:text-copper p-2 rounded-full hover:bg-slate-700/50 transition"
                    title="Buscar (Ctrl+K)"
                >
                    <Search size={18} />
                </button>
                {/* Dark mode toggle */}
                <button 
                    onClick={() => setIsDarkMode(!isDarkMode)}
                    className="text-slate-300 hover:text-copper p-2 rounded-full hover:bg-slate-700/50 transition"
                    title="Modo oscuro"
                >
                    {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
                </button>
                <button 
                    onClick={() => setIsSettingsOpen(true)}
                    className="text-slate-300 hover:text-copper p-2 rounded-full hover:bg-slate-700/50 transition"
                    title="Configuración / Backup"
                >
                    <Settings size={18} />
                </button>
            </div>
          </div>

          {/* Desktop Top Bar with Search */}
          <div className="hidden lg:flex items-center justify-between px-8 py-3 bg-white/90 dark:bg-zinc-950/80 backdrop-blur-md border-b border-slate-200 dark:border-zinc-800 shrink-0 sticky top-0 z-10">
            <button 
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-3 px-4 py-2 bg-slate-100 dark:bg-zinc-800 rounded-xl text-slate-400 text-sm hover:bg-slate-200 dark:hover:bg-zinc-700 transition w-80 border border-transparent hover:border-slate-300 dark:hover:border-zinc-600"
            >
              <Search size={16} />
              <span>Buscar lotes, insumos, clientes...</span>
              <kbd className="ml-auto text-xs bg-white dark:bg-zinc-700 px-2 py-0.5 rounded font-mono border border-slate-200 dark:border-zinc-600">⌘K</kbd>
            </button>
            <div className="flex items-center gap-2">
              <button 
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-lg text-slate-400 hover:text-copper hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
                  title="Modo oscuro"
              >
                  {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
              </button>
            </div>
          </div>

          {/* Scrollable Content Area */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden bg-craft dark:bg-zinc-950">
            {/* Padding bottom accounts for bottom nav on mobile */}
            <div className="p-4 lg:p-8 pb-24 lg:pb-8 max-w-7xl mx-auto animate-fade-in">
               {renderContent()}
            </div>
          </div>

          {/* Mobile Bottom Navigation */}
          <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 border-t border-slate-200 dark:border-zinc-800 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] z-40 pb-safe">
            <div className="grid grid-cols-5 px-1 pb-1 pt-1 gap-1">
              <BottomNavItem view={ViewState.DASHBOARD} label="Panel" icon={LayoutDashboard} />
              <BottomNavItem view={ViewState.PRODUCTION} label="Prod." icon={Factory} />
              <BottomNavItem view={ViewState.INVENTORY} label="Stock" icon={Package} />
              <BottomNavItem view={ViewState.PACKAGING} label="Envase" icon={Beer} />
              <button
                onClick={() => setIsMobileMoreOpen(true)}
                className={`flex flex-col items-center justify-center min-w-[60px] py-2 transition-all duration-200 text-slate-500 dark:text-slate-400`}
              >
                <Menu size={20} strokeWidth={2} />
                <span className="text-[9px] mt-1 font-medium leading-none whitespace-nowrap">Más</span>
              </button>
            </div>
          </div>

          {/* Mobile More Menu (Bottom Sheet) */}
          {isMobileMoreOpen && (
            <>
              <div 
                className="lg:hidden fixed inset-0 bg-black/50 z-50 backdrop-blur-sm animate-fade-in" 
                onClick={() => setIsMobileMoreOpen(false)}
              />
              <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-zinc-900 z-50 rounded-t-2xl shadow-xl transform transition-transform duration-300 pb-safe">
                <div className="p-4 border-b border-slate-100 dark:border-zinc-800 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 dark:text-white">Más Herramientas</h3>
                  <button onClick={() => setIsMobileMoreOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-slate-100 dark:bg-zinc-800 rounded-full">
                    <X size={20} />
                  </button>
                </div>
                <div className="grid grid-cols-4 gap-4 p-4">
                  <BottomNavItem view={ViewState.RECIPES} label="Recetas" icon={BookOpen} />
                  <BottomNavItem view={ViewState.CALENDAR} label="Cal." icon={Calendar} />
                  <BottomNavItem view={ViewState.CRM} label="CRM" icon={Users} />
                  <BottomNavItem view={ViewState.CALCULATORS} label="Calc." icon={Calculator} />
                  <BottomNavItem view={ViewState.AI_CONSULTANT} label="AI" icon={Bot} />
                </div>
              </div>
            </>
          )}
          
          <VoiceAssistant />
        </main>
      </div>
    </>
  );
}