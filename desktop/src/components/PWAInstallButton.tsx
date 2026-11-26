import React, { useState } from 'react';
import { Download, Share, WifiOff, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

interface PWAInstallButtonProps {
  compact?: boolean;
  className?: string;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
  className = '',
}) => {
  const { canInstall, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled || (!canInstall && !isIOS)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (canInstall) {
            void install();
          } else if (isIOS) {
            setShowIOSGuide(true);
          }
        }}
        title="Instalar Luma como app en tu dispositivo"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border border-[var(--luma-accent)]/40 bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold hover:opacity-90 transition-opacity ${
          compact ? 'h-8 px-2.5 text-[11px]' : 'h-10 px-3.5 text-xs'
        } ${className}`}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className="truncate">Instalar app</span>
      </button>

      {showIOSGuide && (
        <div
          onClick={() => setShowIOSGuide(false)}
          className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] p-5 shadow-2xl space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold">Instalar Luma en iPhone / iPad</h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-2 text-xs text-[var(--luma-ink-muted)] list-decimal pl-4 leading-relaxed">
              <li>
                Toca el botón <strong className="text-[var(--luma-ink)] inline-flex items-center gap-1"><Share className="w-3 h-3" /> Compartir</strong> en la barra inferior de Safari.
              </li>
              <li>
                Desplázate y elige <strong className="text-[var(--luma-ink)]">«Añadir a pantalla de inicio»</strong>.
              </li>
              <li>
                Pulsa <strong className="text-[var(--luma-ink)]">Añadir</strong> para abrir Luma a pantalla completa y sin conexión.
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      className="fixed bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 z-[80] px-3.5 py-2 rounded-xl bg-amber-600 text-white text-xs font-semibold shadow-xl flex items-center gap-2 whitespace-nowrap"
    >
      <WifiOff className="w-3.5 h-3.5 shrink-0" />
      <span>Sin conexión · Cambios en cola local para sincronizar</span>
    </div>
  );
};
