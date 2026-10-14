import React, { useEffect, useState } from 'react';
import { Undo2, X, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

export interface ToastData {
  id: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'undo';
  onUndo?: () => void;
  duration?: number;
}

interface ToastProviderProps {
  children: React.ReactNode;
}

const ToastContext = React.createContext<{
  showToast: (toast: Omit<ToastData, 'id'>) => void;
}>({ showToast: () => {} });

export const useToast = () => React.useContext(ToastContext);

const ToastItem: React.FC<{ toast: ToastData; onDismiss: (id: string) => void }> = ({ toast, onDismiss }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsExiting(true);
      setTimeout(() => onDismiss(toast.id), 300);
    }, toast.duration || 4000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, onDismiss]);

  const icons = {
    info: <Info size={18} className="text-blue-400" />,
    success: <CheckCircle2 size={18} className="text-green-400" />,
    warning: <AlertTriangle size={18} className="text-amber-400" />,
    undo: <Undo2 size={18} className="text-copper" />,
  };

  return (
    <div className={`${isExiting ? 'animate-toast-out' : 'animate-toast-in'} bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 min-w-[280px] max-w-[380px] border border-slate-700/50`}>
      {icons[toast.type]}
      <span className="flex-1 text-sm font-medium">{toast.message}</span>
      {toast.type === 'undo' && toast.onUndo && (
        <button
          onClick={() => { toast.onUndo!(); setIsExiting(true); setTimeout(() => onDismiss(toast.id), 300); }}
          className="px-3 py-1 bg-copper hover:bg-copper-dark text-white text-xs font-bold rounded-lg transition"
        >
          Deshacer
        </button>
      )}
      <button onClick={() => { setIsExiting(true); setTimeout(() => onDismiss(toast.id), 300); }} className="text-slate-500 hover:text-white transition">
        <X size={14} />
      </button>
    </div>
  );
};

export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const showToast = (toast: Omit<ToastData, 'id'>) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev, { ...toast, id }]);
  };

  const dismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        <div className="flex flex-col items-center gap-2">
          {toasts.map(toast => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
};
