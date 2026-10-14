import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Search, X, Factory, Package, Users, Beer, BookOpen, Calendar, Calculator, Bot, LayoutDashboard, ArrowRight } from 'lucide-react';
import { useBreweryStore } from '../context/store';
import { ViewState } from '../types';
import { DebouncedInput } from './ui/DebouncedInput';

interface SearchDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (view: ViewState) => void;
}

export const SearchDialog: React.FC<SearchDialogProps> = ({ isOpen, onClose, onNavigate }) => {
  const batches = useBreweryStore(s => s.batches);
  const inventory = useBreweryStore(s => s.inventory);
  const customers = useBreweryStore(s => s.customers);
  const kegs = useBreweryStore(s => s.kegs);
  const masterRecipes = useBreweryStore(s => s.masterRecipes);
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Navigation shortcuts
  const navItems = useMemo(() => [
    { label: 'Panel de Control', view: ViewState.DASHBOARD, icon: LayoutDashboard },
    { label: 'Producción', view: ViewState.PRODUCTION, icon: Factory },
    { label: 'Inventario', view: ViewState.INVENTORY, icon: Package },
    { label: 'Clientes / CRM', view: ViewState.CRM, icon: Users },
    { label: 'Envasado / Barriles', view: ViewState.PACKAGING, icon: Beer },
    { label: 'Recetas', view: ViewState.RECIPES, icon: BookOpen },
    { label: 'Calendario', view: ViewState.CALENDAR, icon: Calendar },
    { label: 'Calculadoras', view: ViewState.CALCULATORS, icon: Calculator },
    { label: 'BrewMaster AI', view: ViewState.AI_CONSULTANT, icon: Bot },
  ], []);

  const results = useMemo(() => {
    if (!query.trim()) return { nav: navItems, data: [] };

    const q = query.toLowerCase();
    const matchingNav = navItems.filter(n => n.label.toLowerCase().includes(q));

    const dataResults: { label: string; sub: string; view: ViewState; type: string }[] = [];

    // Search batches
    batches.forEach(b => {
      if (b.recipeName.toLowerCase().includes(q) || b.lotCode?.toLowerCase().includes(q) || b.style?.toLowerCase().includes(q)) {
        dataResults.push({ label: b.recipeName, sub: `Lote: ${b.lotCode} • ${b.status}`, view: ViewState.PRODUCTION, type: 'Lote' });
      }
    });

    // Search inventory
    inventory.forEach(i => {
      if (i.name.toLowerCase().includes(q) || i.type.toLowerCase().includes(q)) {
        dataResults.push({ label: i.name, sub: `${i.stockAmount} ${i.unit} • ${i.type}`, view: ViewState.INVENTORY, type: 'Insumo' });
      }
    });

    // Search customers
    customers.forEach(c => {
      if (c.name.toLowerCase().includes(q) || c.contact?.toLowerCase().includes(q)) {
        dataResults.push({ label: c.name, sub: `Deuda: $${c.debt}`, view: ViewState.CRM, type: 'Cliente' });
      }
    });

    // Search kegs
    kegs.forEach(k => {
      if (k.id.toLowerCase().includes(q) || k.currentLocation?.toLowerCase().includes(q) || k.contents?.toLowerCase().includes(q)) {
        dataResults.push({ label: `Barril #${k.id}`, sub: `${k.status} • ${k.currentLocation}`, view: ViewState.PACKAGING, type: 'Barril' });
      }
    });

    // Search recipes
    masterRecipes.forEach(r => {
      if (r.name.toLowerCase().includes(q) || r.style?.toLowerCase().includes(q)) {
        dataResults.push({ label: r.name, sub: `${r.style || 'Sin estilo'}`, view: ViewState.RECIPES, type: 'Receta' });
      }
    });

    return { nav: matchingNav, data: dataResults.slice(0, 8) };
  }, [query, batches, inventory, customers, kegs, masterRecipes, navItems]);

  if (!isOpen) return null;

  const handleSelect = (view: ViewState) => {
    onNavigate(view);
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100] search-overlay" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative flex justify-center pt-[15vh] px-4" onClick={e => e.stopPropagation()}>
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden search-dialog border border-slate-200 dark:border-zinc-700">
          {/* Search Input */}
          <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-zinc-700">
            <Search size={20} className="text-slate-400 shrink-0" />
            <DebouncedInput
              ref={inputRef}
              type="text"
              value={query}
              onDebouncedChange={val => setQuery(val.toString())}
              placeholder="Buscar lotes, insumos, clientes, barriles..."
              className="flex-1 bg-transparent text-slate-900 dark:text-white text-lg outline-none placeholder:text-slate-400"
              onKeyDown={e => { if (e.key === 'Escape') onClose(); }}
            />
            <kbd className="hidden sm:inline-flex text-xs bg-slate-100 dark:bg-zinc-800 text-slate-400 px-2 py-1 rounded font-mono">ESC</kbd>
          </div>

          {/* Results */}
          <div className="p-2 max-h-[50vh] overflow-y-auto">
            {/* Navigation */}
            {results.nav.length > 0 && (
              <div className="mb-2">
                <p className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1">Navegación</p>
                {results.nav.map(item => (
                  <button
                    key={item.view}
                    onClick={() => handleSelect(item.view)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left group"
                  >
                    <item.icon size={18} className="text-slate-400 group-hover:text-copper transition" />
                    <span className="flex-1 text-sm text-slate-700 dark:text-slate-200 font-medium">{item.label}</span>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-copper transition" />
                  </button>
                ))}
              </div>
            )}

            {/* Data Results */}
            {results.data.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase px-3 py-1 border-t border-slate-100 dark:border-zinc-800 mt-1 pt-2">Resultados</p>
                {results.data.map((item, idx) => (
                  <button
                    key={`${item.type}-${idx}`}
                    onClick={() => handleSelect(item.view)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition text-left group"
                  >
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-800 px-2 py-0.5 rounded uppercase w-14 text-center shrink-0">{item.type}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 dark:text-slate-200 font-medium truncate">{item.label}</p>
                      <p className="text-xs text-slate-400 truncate">{item.sub}</p>
                    </div>
                    <ArrowRight size={14} className="text-slate-300 group-hover:text-copper transition shrink-0" />
                  </button>
                ))}
              </div>
            )}

            {query && results.nav.length === 0 && results.data.length === 0 && (
              <div className="py-8 text-center text-slate-400">
                <Search size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Sin resultados para "{query}"</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-3 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>Navegar con ↑ ↓ • Seleccionar con Enter</span>
            <span className="hidden sm:block">⌘K para buscar</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
