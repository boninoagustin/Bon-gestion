import React, { useState } from 'react';
import { FermenterTracking } from './FermenterTracking';
import { KegTracking } from './KegTracking';
import { BottleStockView } from './BottleStock';
import { SalesHistory } from './SalesHistory';
import { Taproom } from './Taproom';
import { Droplets, Beer, Milk, History, GlassWater } from 'lucide-react';

type Tab = 'FERMENTERS' | 'KEGS' | 'BOTTLES' | 'TAPROOM' | 'HISTORY';

export const Packaging: React.FC = React.memo(() => {
  const [activeTab, setActiveTab] = useState<Tab>('FERMENTERS');

  return (
    <div className="space-y-4">
      {/* Tabs Header */}
      <div className="bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md p-1.5 rounded-2xl border border-slate-200 dark:border-zinc-800/80 shadow-sm flex flex-wrap sm:flex-nowrap gap-1">
        <button
          onClick={() => setActiveTab('FERMENTERS')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'FERMENTERS'
              ? 'bg-slate-900 text-white dark:bg-zinc-800 shadow-md border border-transparent dark:border-zinc-700/80'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Droplets size={18} className={activeTab === 'FERMENTERS' ? 'text-copper' : ''} />
          <span>Fermentadores</span>
        </button>
        <button
          onClick={() => setActiveTab('KEGS')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'KEGS'
              ? 'bg-slate-900 text-white dark:bg-zinc-800 shadow-md border border-transparent dark:border-zinc-700/80'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Beer size={18} />
          <span>Barriles</span>
        </button>
        <button
          onClick={() => setActiveTab('BOTTLES')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'BOTTLES'
              ? 'bg-slate-900 text-white dark:bg-zinc-800 shadow-md border border-transparent dark:border-zinc-700/80'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <Milk size={18} />
          <span>Botellas</span>
        </button>
        <button
          onClick={() => setActiveTab('TAPROOM')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'TAPROOM'
              ? 'bg-amber-500 text-white shadow-md border border-transparent'
              : 'text-slate-500 dark:text-slate-400 hover:bg-amber-50 dark:hover:bg-zinc-800/50 hover:text-amber-600 dark:hover:text-amber-400'
          }`}
        >
          <GlassWater size={18} />
          <span>Pizarra</span>
        </button>
        <button
          onClick={() => setActiveTab('HISTORY')}
          className={`flex-1 min-w-[120px] flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-xl text-sm font-bold transition-all duration-200 ${
            activeTab === 'HISTORY'
              ? 'bg-slate-900 text-white dark:bg-zinc-800 shadow-md border border-transparent dark:border-zinc-700/80'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800/50 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <History size={18} />
          <span>Historial</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
        {activeTab === 'FERMENTERS' && <FermenterTracking />}
        {activeTab === 'KEGS' && <KegTracking />}
        {activeTab === 'BOTTLES' && <BottleStockView />}
        {activeTab === 'TAPROOM' && <Taproom />}
        {activeTab === 'HISTORY' && <SalesHistory />}
      </div>
    </div>
  );
});