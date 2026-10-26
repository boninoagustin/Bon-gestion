import React, { useState } from 'react';
import {
  LayoutDashboard,
  Factory,
  Package,
  CircleDot,
  Calculator,
  Bot,
  Beer,
  X,
  Milk,
  Settings,
  Users,
  BookOpen,
  Calendar,
} from 'lucide-react';
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

export const Sidebar: React.FC<SidebarProps> = ({
  currentView,
  setCurrentView,
  isMobileOpen,
  closeMobileMenu,
}) => {
  const batches = useBreweryStore((s) => s.batches);
  const settings = useBreweryStore((s) => s.settings);
  const fermenters = useBreweryStore((s) => s.fermenters);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'LayoutDashboard':
        return <LayoutDashboard size={20} />;
      case 'Factory':
        return <Factory size={20} />;
      case 'Package':
        return <Package size={20} />;
      case 'CircleDot':
        return <CircleDot size={20} />;
      case 'Calculator':
        return <Calculator size={20} />;
      case 'Bot':
        return <Bot size={20} />;
      case 'Milk':
        return <Milk size={20} />;
      case 'Beer':
        return <Beer size={20} />;
      case 'Users':
        return <Users size={20} />;
      case 'BookOpen':
        return <BookOpen size={20} />;
      case 'Calendar':
        return <Calendar size={20} />;
      default:
        return <Beer size={20} />;
    }
  };

  const totalFermenters =
    fermenters.length > 0
      ? fermenters.length
      : settings.fermenterCapacity || 3;
  const occupiedFermenters =
    fermenters.length > 0
      ? fermenters.filter((f) => f.status === 'OCCUPIED').length
      : batches.filter(
          (b) =>
            b.status === BatchStatus.FERMENTING ||
            b.status === BatchStatus.CONDITIONING
        ).length;
  const dirtyFermenters = fermenters.filter((f) => f.status === 'DIRTY').length;
  const occupancyPercentage = Math.min(
    100,
    Math.round((occupiedFermenters / Math.max(1, totalFermenters)) * 100)
  );
  const isPlantFull = occupiedFermenters >= totalFermenters;

  return (
    <>
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/65 backdrop-blur-sm z-40 lg:hidden"
          onClick={closeMobileMenu}
        />
      )}

      <aside
        className={`
          bg-[#121417] text-slate-100 border-r border-[#2c3138] flex flex-col h-screen
          fixed inset-y-0 left-0 z-50 w-64 transition-transform duration-300 ease-in-out
          lg:static lg:translate-x-0
          ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="py-5 px-4 flex items-center justify-center border-b border-[#2c3138] relative">
          <div className="w-full flex items-center justify-center">
            <img
              src="icon.png"
              alt="BON Artesanal"
              className="w-full max-h-14 object-contain"
            />
          </div>
          <button
            type="button"
            onClick={closeMobileMenu}
            className="lg:hidden absolute right-3 min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-white bg-[#1a1d21] rounded-xl border border-[#2c3138]"
            aria-label="Cerrar menú"
          >
            <X size={22} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1.5 overflow-y-auto">
          {MENU_ITEMS.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setCurrentView(item.id);
                  closeMobileMenu();
                }}
                className={`w-full min-h-[46px] flex items-center space-x-3 px-4 py-2.5 rounded-xl transition-all text-sm select-none ${
                  isActive
                    ? 'bg-gradient-to-r from-[#d97706] to-[#f59e0b] text-white font-bold shadow-copper-glow'
                    : 'text-slate-400 hover:bg-[#1a1d21] hover:text-slate-100'
                }`}
              >
                <span className={isActive ? 'text-white' : 'text-[#f59e0b]/80'}>
                  {getIcon(item.icon)}
                </span>
                <span className="tracking-tight">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-3.5 border-t border-[#2c3138] bg-[#1a1d21]/70">
          <div className="bg-[#121417] border border-[#2c3138] rounded-xl p-3.5 text-xs">
            <div className="flex justify-between items-center mb-2">
              <span className="text-slate-400 uppercase font-bold tracking-wider text-[10px]">
                Sala de Fermentación
              </span>
              <span
                className={`inline-flex items-center gap-1.5 font-mono font-bold text-[11px] ${
                  isPlantFull ? 'text-[#ef4444]' : 'text-[#10b981]'
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    isPlantFull
                      ? 'bg-[#ef4444] animate-pulse'
                      : 'bg-[#10b981] animate-pulse'
                  }`}
                />
                {isPlantFull ? 'CAPACIDAD 100%' : 'OPERATIVA'}
              </span>
            </div>

            <div className="fermentation-progress-track h-2.5 my-2">
              <div
                className={
                  isPlantFull
                    ? 'fermentation-progress-bar fermentation-progress-bar--alert'
                    : 'fermentation-progress-bar'
                }
                style={{ width: `${occupancyPercentage}%` }}
              />
            </div>

            <div className="flex justify-between items-center text-[11px] font-mono text-slate-400 mt-1.5">
              <span>
                Ocupados: <strong className="text-slate-200">{occupiedFermenters}/{totalFermenters}</strong>
              </span>
              {dirtyFermenters > 0 && (
                <span className="text-[#f59e0b] font-bold">
                  CIP: {dirtyFermenters}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                setIsSettingsOpen(true);
                closeMobileMenu();
              }}
              className="w-full mt-3.5 min-h-[44px] py-2.5 bg-[#1a1d21] hover:bg-[#22262b] active:scale-95 border border-[#2c3138] text-slate-200 rounded-xl flex items-center justify-center gap-2 transition text-xs uppercase font-bold tracking-wider"
            >
              <Settings size={16} className="text-[#f59e0b]" />
              <span>Config. / Backup</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};