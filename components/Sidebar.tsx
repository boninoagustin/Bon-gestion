import React, { useState } from 'react';
import { LayoutDashboard, Factory, Package, CircleDot, Calculator, Bot, Beer, X, Milk, Settings, Users, BookOpen, Calendar } from 'lucide-react';
import { BatchStatus, ViewState } from '../types';
import { MENU_ITEMS } from '../constants';
import { useBreweryStore } from '../context/store';
import { SettingsModal } from './SettingsModal';

interface SidebarProps {
  currentView: ViewState;
  setCurrentView: (view: ViewState) => void;
  isMobileOpen: boolean;
  closeMobileMenu: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, isMobileOpen, closeMobileMenu }) => {
  const batches = useBreweryStore(s => s.batches);
  const settings = useBreweryStore(s => s.settings);
  const fermenters = useBreweryStore(s => s.fermenters);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard': return <LayoutDashboard size={20} />;
      case 'Factory': return <Factory size={20} />;
      case 'Package': return <Package size={20} />;
      case 'CircleDot': return <CircleDot size={20} />;
      case 'Calculator': return <Calculator size={20} />;
      case 'Bot': return <Bot size={20} />;
      case 'Milk': return <Milk size={20} />;
      case 'Beer': return <Beer size={20} />;
      case 'Users': return <Users size={20} />;
      case 'BookOpen': return <BookOpen size={20} />;
      case 'Calendar': return <Calendar size={20} />;
      default: return <Beer size={20} />;
    }
  };

  // Dynamic Plant Status Calculation
  const totalFermenters = fermenters.length > 0 ? fermenters.length : (settings.fermenterCapacity || 3);
  const occupiedFermenters = fermenters.length > 0 
    ? fermenters.filter(f => f.status === 'OCCUPIED').length
    : batches.filter(b => b.status === BatchStatus.FERMENTING || b.status === BatchStatus.CONDITIONING).length;
  const occupancyPercentage = Math.min(100, Math.round((occupiedFermenters / totalFermenters) * 100));
  const isPlantFull = occupiedFermenters >= totalFermenters;

  return (
    <>
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />

      {/* Mobile Overlay */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        bg-slate-dark text-slate-100 flex flex-col h-screen
        fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out
        lg:static lg:translate-x-0
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="py-6 px-4 flex items-center justify-center border-b border-zinc-800 relative">
          <div className="w-full flex items-center justify-center">
             <img src="icon.png" alt="BON Artesanal" className="w-full object-contain" />
          </div>
          <button onClick={closeMobileMenu} className="lg:hidden absolute right-4 text-zinc-400 hover:text-white bg-slate-dark/50 p-1 rounded">
            <X size={24} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentView(item.id);
                closeMobileMenu();
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                currentView === item.id
                  ? 'bg-gradient-to-r from-copper to-copper-dark text-white font-bold shadow-md shadow-copper/20'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-white'
              }`}
            >
              {getIcon(item.icon)}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-zinc-800">
          <div className="bg-black/20 rounded-lg p-4 text-sm">
            <div className="flex justify-between mb-2">
              <span className="text-zinc-400">Estado Planta</span>
              <span className={`${isPlantFull ? 'text-red-400' : 'text-green-400'} font-bold`}>
                {isPlantFull ? 'Llena' : 'Activa'}
              </span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div
                className={`${isPlantFull ? 'bg-red-500' : 'bg-green-500'} h-full transition-all duration-500`}
                style={{ width: `${occupancyPercentage}%` }}
              ></div>
            </div>
            <p className="text-xs text-zinc-500 mt-2">Fermentadores: {occupiedFermenters}/{totalFermenters} Ocupados</p>
            
            <button 
                onClick={() => { setIsSettingsOpen(true); closeMobileMenu(); }}
                className="w-full mt-4 py-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 rounded flex items-center justify-center gap-2 transition text-xs uppercase font-bold tracking-wide"
            >
                <Settings size={14} /> Config. / Backup
            </button>
          </div>
        </div>
      </div>
    </>
  );
};