import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  title?: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  toast: (options: { title?: string; message: string; type?: ToastType; duration?: number }) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    ({
      title,
      message,
      type = 'info',
      duration = 4500,
    }: {
      title?: string;
      message: string;
      type?: ToastType;
      duration?: number;
    }) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: Toast = { id, title, message, type, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = (message: string, title?: string) => addToast({ title, message, type: 'success' });
  const error = (message: string, title?: string) => addToast({ title, message, type: 'error', duration: 6000 });
  const warning = (message: string, title?: string) => addToast({ title, message, type: 'warning', duration: 5000 });
  const info = (message: string, title?: string) => addToast({ title, message, type: 'info' });

  return (
    <ToastContext.Provider value={{ toast: addToast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-md w-full pointer-events-none px-4">
        {toasts.map((t) => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
            error: <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
            info: <Info className="w-5 h-5 text-sky-400 shrink-0" />,
          };

          const borders = {
            success: 'border-emerald-500/30 bg-emerald-950/90 text-emerald-100',
            error: 'border-rose-500/30 bg-rose-950/90 text-rose-100',
            warning: 'border-amber-500/30 bg-amber-950/90 text-amber-100',
            info: 'border-sky-500/30 bg-sky-950/90 text-sky-100',
          };

          return (
            <div
              key={t.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-200 animate-in slide-in-from-bottom-2 ${borders[t.type]}`}
            >
              {icons[t.type]}
              <div className="flex-1 text-sm">
                {t.title && <div className="font-semibold mb-0.5">{t.title}</div>}
                <div className="text-slate-200 leading-snug">{t.message}</div>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
