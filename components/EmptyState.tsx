import React from 'react';
import { Package, Factory, Users, Beer, Milk, Calendar, BookOpen, TrendingUp, ShoppingCart, ClipboardList } from 'lucide-react';

interface EmptyStateProps {
  type: 'batches' | 'inventory' | 'customers' | 'kegs' | 'bottles' | 'sales' | 'events' | 'recipes' | 'shopping' | 'general';
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const configs: Record<string, { icon: React.ElementType; title: string; description: string; color: string }> = {
  batches: { icon: Factory, title: 'Sin lotes de producción', description: 'Creá tu primer lote para comenzar a registrar la producción.', color: 'text-amber-400' },
  inventory: { icon: Package, title: 'Inventario vacío', description: 'Ingresá tus insumos para controlar stock y costos automáticamente.', color: 'text-blue-400' },
  customers: { icon: Users, title: 'Sin clientes registrados', description: 'Agregá tus clientes para gestionar cuentas corrientes y deudas.', color: 'text-green-400' },
  kegs: { icon: Beer, title: 'Sin barriles', description: 'Registrá tus barriles para controlar la flota y rotación.', color: 'text-copper' },
  bottles: { icon: Milk, title: 'Sin stock de botellas', description: 'El stock se genera automáticamente al envasar desde un barril o lote.', color: 'text-purple-400' },
  sales: { icon: TrendingUp, title: 'Sin ventas registradas', description: 'Las ventas se registran al despachar barriles o vender botellas.', color: 'text-emerald-400' },
  events: { icon: Calendar, title: 'Sin eventos', description: 'Los eventos se crean automáticamente al programar lotes de producción.', color: 'text-sky-400' },
  recipes: { icon: BookOpen, title: 'Sin recetas guardadas', description: 'Creá recetas maestras para reutilizarlas en tus lotes.', color: 'text-orange-400' },
  shopping: { icon: ShoppingCart, title: 'Lista vacía', description: 'Agregá items a tu lista de compras.', color: 'text-pink-400' },
  general: { icon: ClipboardList, title: 'Sin datos', description: 'No hay información para mostrar.', color: 'text-slate-400' },
};

export const EmptyState: React.FC<EmptyStateProps> = ({ type, message, actionLabel, onAction }) => {
  const config = configs[type] || configs.general;
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 animate-fade-in">
      <div className={`p-4 rounded-2xl bg-slate-100 dark:bg-zinc-800/50 mb-4 ${config.color}`}>
        <Icon size={40} strokeWidth={1.5} />
      </div>
      <h3 className="text-lg font-bold text-slate-700 dark:text-slate-200 mb-1 text-center">
        {config.title}
      </h3>
      <p className="text-sm text-slate-400 text-center max-w-[300px] leading-relaxed">
        {message || config.description}
      </p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-4 px-5 py-2 bg-copper hover:bg-copper-dark text-white text-sm font-bold rounded-lg transition shadow-sm shadow-copper/20"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};
