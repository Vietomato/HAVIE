import React from 'react';
import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle2, CircleAlert, X } from 'lucide-react';

const ToastContext = createContext(null);
const MAX_TOASTS = 3;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  // action: { label, to } renders a link, { label, onClick } renders a button.
  const notify = useCallback(
    ({ message, type = 'success', action = null }) => {
      nextId.current += 1;
      const id = nextId.current;
      setToasts((current) => [...current.slice(1 - MAX_TOASTS), { id, message, type, action }]);
      window.setTimeout(() => dismiss(id), action || type === 'error' ? 8000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ notify }), [notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-region" role="status" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = toast.type === 'error' ? CircleAlert : CheckCircle2;
          return (
            <div key={toast.id} className={'toast toast-' + toast.type}>
              <Icon size={20} aria-hidden="true" />
              <p>{toast.message}</p>
              {toast.action?.to && (
                <Link
                  className="toast-action"
                  to={toast.action.to}
                  onClick={() => dismiss(toast.id)}
                >
                  {toast.action.label}
                </Link>
              )}
              {toast.action?.onClick && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    dismiss(toast.id);
                    toast.action.onClick();
                  }}
                >
                  {toast.action.label}
                </button>
              )}
              <button
                type="button"
                className="toast-close"
                aria-label="Đóng thông báo"
                onClick={() => dismiss(toast.id)}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
