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

  const tabs: { id: Tab; label: string; icon: React.ElementType; highlight?: boolean }[] = [
    { id: 'FERMENTERS', label: 'Fermentadores', icon: Droplets },
    { id: 'KEGS', label: 'Barriles', icon: Beer },
    { id: 'BOTTLES', label: 'Botellas', icon: Milk },
    { id: 'TAPROOM', label: 'Pizarra', icon: GlassWater, highlight: true },
    { id: 'HISTORY', label: 'Historial', icon: History },
  ];

  return (
    <div className="space-y-5">
      {/* Tabs Header — Industrial Craft Touch Bar (>=44px) */}
      <div className="bg-white dark:bg-[#1a1d21] p-1.5 rounded-2xl border border-slate-200 dark:border-[#2c3138] shadow-sm flex flex-wrap sm:flex-nowrap gap-1.5">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-[115px] min-h-[44px] flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs uppercase tracking-wider font-extrabold transition-all duration-200 cursor-pointer ${
                isActive
                  ? tab.highlight
                    ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white shadow-copper-glow border border-[#f59e0b]/40'
                    : 'bg-[#121417] text-white dark:bg-[#121417] shadow-md border border-[#2c3138]'
                  : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#22262b] hover:text-slate-800 dark:hover:text-slate-200 border border-transparent'
              }`}
            >
              <Icon
                size={17}
                className={
                  isActive
                    ? tab.highlight
                      ? 'text-white'
                      : 'text-[#f59e0b]'
                    : 'text-slate-400 dark:text-slate-500'
                }
              />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div className="animate-fade-in">
        {activeTab === 'FERMENTERS' && <FermenterTracking />}
        {activeTab === 'KEGS' && <KegTracking />}
        {activeTab === 'BOTTLES' && <BottleStockView />}
        {activeTab === 'TAPROOM' && <Taproom />}
        {activeTab === 'HISTORY' && <SalesHistory />}
      </div>
    </div>
  );
});