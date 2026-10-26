import React from 'react';
import {
  Package,
  Factory,
  Users,
  Beer,
  Milk,
  Calendar,
  BookOpen,
  TrendingUp,
  ShoppingCart,
  ClipboardList,
  Plus,
} from 'lucide-react';

export interface EmptyStateProps {
  type:
    | 'batches'
    | 'inventory'
    | 'customers'
    | 'kegs'
    | 'bottles'
    | 'sales'
    | 'events'
    | 'recipes'
    | 'shopping'
    | 'general';
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}

const configs: Record<
  EmptyStateProps['type'],
  {
    icon: React.ElementType;
    title: string;
    description: string;
    accentHex: string;
    badgeClass: string;
  }
> = {
  batches: {
    icon: Factory,
    title: 'Sala de cocción en reposo',
    description:
      'Iniciá un lote nuevo para registrar densidades (OG/FG), temperaturas de fermentación y costos por litro.',
    accentHex: '#f59e0b',
    badgeClass: 'text-[#f59e0b] bg-[#d97706]/15 border-[#d97706]/30',
  },
  inventory: {
    icon: Package,
    title: 'Depósito de insumos vacío',
    description:
      'Cargá tus maltas, lúpulos, levaduras y sales para auditar stock y descontar cocciones automáticamente.',
    accentHex: '#0ea5e9',
    badgeClass: 'text-[#38bdf8] bg-[#0ea5e9]/15 border-[#0ea5e9]/30',
  },
  customers: {
    icon: Users,
    title: 'Sin cuentas comerciales',
    description:
      'Registrá bares, distribuidores y clientes para controlar barriles entregados y saldos pendientes.',
    accentHex: '#10b981',
    badgeClass: 'text-[#34d399] bg-[#10b981]/15 border-[#10b981]/30',
  },
  kegs: {
    icon: Beer,
    title: 'Flota de barriles sin registrar',
    description:
      'Agregá tus barriles de 20L, 30L o 50L para seguir su ubicación, llenado en cámara fría y estado CIP.',
    accentHex: '#d97706',
    badgeClass: 'text-[#f59e0b] bg-[#d97706]/15 border-[#d97706]/30',
  },
  bottles: {
    icon: Milk,
    title: 'Sin stock fraccionado',
    description:
      'El inventario de botellas y latas se acredita automáticamente al trasvasar desde un barril o lote terminado.',
    accentHex: '#38bdf8',
    badgeClass: 'text-[#38bdf8] bg-[#0ea5e9]/15 border-[#0ea5e9]/30',
  },
  sales: {
    icon: TrendingUp,
    title: 'Sin despachos ni ventas en pizarra',
    description:
      'Registrá ventas de barriles, botellas o pintas en Taproom para analizar márgenes reales por lote.',
    accentHex: '#10b981',
    badgeClass: 'text-[#34d399] bg-[#10b981]/15 border-[#10b981]/30',
  },
  events: {
    icon: Calendar,
    title: 'Agenda de planta despejada',
    description:
      'Programá cocciones, descansos de diacetilo, purgas de cono, entregas o limpiezas CIP en el calendario.',
    accentHex: '#0ea5e9',
    badgeClass: 'text-[#38bdf8] bg-[#0ea5e9]/15 border-[#0ea5e9]/30',
  },
  recipes: {
    icon: BookOpen,
    title: 'Biblioteca de recetas vacía',
    description:
      'Diseñá tus recetas maestras con objetivos BJCP (OG, FG, IBU, SRM) para escalar lotes con precisión.',
    accentHex: '#f59e0b',
    badgeClass: 'text-[#f59e0b] bg-[#d97706]/15 border-[#d97706]/30',
  },
  shopping: {
    icon: ShoppingCart,
    title: 'Sin compras pendientes',
    description:
      'Todos los insumos requeridos están cubiertos. Agregá recordatorios de reposición cuando lo necesites.',
    accentHex: '#10b981',
    badgeClass: 'text-[#34d399] bg-[#10b981]/15 border-[#10b981]/30',
  },
  general: {
    icon: ClipboardList,
    title: 'Sin registros disponibles',
    description: 'No hay datos cargados en esta vista por el momento.',
    accentHex: '#94a3b8',
    badgeClass: 'text-slate-400 bg-slate-800/60 border-slate-700',
  },
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type,
  message,
  actionLabel,
  onAction,
}) => {
  const config = configs[type] || configs.general;
  const Icon = config.icon;

  return (
    <div className="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in">
      {/* Ilustración Industrial Craft SVG con Halo Ámbar/Pizarra */}
      <div className="relative mb-5 flex items-center justify-center">
        <svg
          width="136"
          height="112"
          viewBox="0 0 136 112"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="opacity-90"
          aria-hidden="true"
        >
          {/* Halo de fondo */}
          <circle
            cx="68"
            cy="56"
            r="46"
            fill={config.accentHex}
            fillOpacity="0.08"
          />
          <circle
            cx="68"
            cy="56"
            r="36"
            stroke={config.accentHex}
            strokeOpacity="0.22"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />
          {/* Silueta técnica de tanque cilindro-cónico / manómetro industrial */}
          <path
            d="M48 34C48 28.4772 52.4772 24 58 24H78C83.5228 24 88 28.4772 88 34V62L68 88L48 62V34Z"
            fill="#1a1d21"
            stroke={config.accentHex}
            strokeOpacity="0.35"
            strokeWidth="1.5"
          />
          {/* Líneas de nivel de líquido */}
          <path
            d="M53 46H83M53 56H83"
            stroke={config.accentHex}
            strokeOpacity="0.25"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
          {/* Patas del tanque */}
          <path
            d="M52 66L46 90M84 66L90 90"
            stroke={config.accentHex}
            strokeOpacity="0.35"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>

        {/* Ícono central elevado */}
        <div
          className={`absolute w-14 h-14 rounded-2xl border backdrop-blur-md flex items-center justify-center shadow-lg animate-float-slow ${config.badgeClass}`}
        >
          <Icon size={28} strokeWidth={1.75} />
        </div>
      </div>

      <h3 className="text-base md:text-lg font-extrabold text-slate-800 dark:text-slate-100 mb-1.5 tracking-tight">
        {config.title}
      </h3>
      <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-[340px] leading-relaxed">
        {message || config.description}
      </p>

      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 min-h-[44px] px-6 py-2.5 bg-[#d97706] hover:bg-[#b45309] active:scale-95 text-white text-xs md:text-sm font-bold uppercase tracking-wider rounded-xl transition-all shadow-copper-glow inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <Plus size={18} />
          <span>{actionLabel}</span>
        </button>
      )}
    </div>
  );
};
