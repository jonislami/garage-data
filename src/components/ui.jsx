import { createContext, useCallback, useContext, useState } from 'react';
import { Search, X, CheckCircle2, AlertCircle, Info } from 'lucide-react';

/* ---------------- Page header ---------------- */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="page-header">
      <div className="min-w-0">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2">{children}</div>}
    </div>
  );
}

/* ---------------- Search input ---------------- */
export function SearchInput({ value, onChange, placeholder, className = '', autoFocus = false }) {
  return (
    <div className={`relative ${className}`}>
      <Search size={16} className="input-icon" />
      <input
        type="search"
        autoFocus={autoFocus}
        className="input pl-9 pr-8"
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-gray-400 hover:text-gray-700"
          aria-label="Clear"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

/* ---------------- Empty state ---------------- */
export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="empty-state">
      {Icon && (
        <div className="mx-auto mb-3 h-10 w-10 flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-400">
          <Icon size={20} />
        </div>
      )}
      <p className="font-medium text-gray-900">{title}</p>
      {description && <p className="mt-1 text-gray-500">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* ---------------- Loading skeletons ---------------- */
export function TableSkeleton({ rows = 5, cols = 4 }) {
  return (
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-4 px-4 py-3.5">
          {Array.from({ length: cols }).map((_, c) => (
            <div key={c} className="skeleton h-3.5" style={{ width: c === 0 ? '28%' : `${12 + ((r + c) % 3) * 6}%` }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 6 }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card p-4 space-y-3">
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-1/3" />
          <div className="skeleton h-3 w-1/2" />
        </div>
      ))}
    </>
  );
}

/* ---------------- Job status badge ---------------- */
export function StatusBadge({ status, language }) {
  const al = language === 'al';
  const map = {
    'Pending': { cls: 'badge-amber', label: al ? 'Në pritje' : 'Pending' },
    'In Progress': { cls: 'badge-blue', label: al ? 'Në proces' : 'In progress' },
    'Completed': { cls: 'badge-green', label: al ? 'Përfunduar' : 'Completed' },
  };
  const s = map[status] || { cls: 'badge-gray', label: status || '—' };
  return <span className={`badge ${s.cls}`}>{s.label}</span>;
}

/* ---------------- Toasts (replace browser alert()) ---------------- */
const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback(id => setToasts(t => t.filter(x => x.id !== id)), []);

  const push = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts(t => [...t, { id, type, message }]);
    setTimeout(() => dismiss(id), type === 'error' ? 6000 : 3500);
  }, [dismiss]);

  const api = {
    success: m => push('success', m),
    error: m => push('error', m),
    info: m => push('info', m),
  };

  const icons = { success: CheckCircle2, error: AlertCircle, info: Info };
  const colors = { success: 'text-emerald-600', error: 'text-red-600', info: 'text-blue-600' };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm print:hidden">
        {toasts.map(t => {
          const Icon = icons[t.type];
          return (
            <div key={t.id} className="card shadow-lg px-3.5 py-3 flex items-start gap-2.5 animate-fade-in">
              <Icon size={18} className={`${colors[t.type]} shrink-0 mt-px`} />
              <p className="text-sm text-gray-800 flex-1">{t.message}</p>
              <button onClick={() => dismiss(t.id)} className="text-gray-400 hover:text-gray-700"><X size={14} /></button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  // Fallback so components never crash if used outside the provider
  return ctx || { success: m => window.alert(m), error: m => window.alert(m), info: m => window.alert(m) };
}
