import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Check,
  Clock,
  Cloud,
  CloudOff,
  RefreshCw,
} from 'lucide-react';
import { LUMA_CORE_CONFIG } from '../config';
import { SyncButtonStatus } from '../types';

interface SyncStatusButtonProps {
  /** true cuando el usuario tiene sesión iniciada en la nube */
  connected: boolean;
  /** Estado actual de sincronización cuando connected === true */
  status: SyncButtonStatus;
  /** Cantidad de cambios pendientes por subir */
  pendingCount?: number;
  /** Variante compacta para barras de lectura o edición de cuadernos */
  compact?: boolean;
  /** Acción al pulsar el botón cuando SÍ hay sesión */
  onSyncNow: () => void;
  /** Acción directa al enlace "Mi cuenta" dentro del aviso cuando NO hay sesión */
  onOpenAccount: () => void;
}

/**
 * Botón unificado de Sincronización compartido entre la barra principal,
 * el lector de documentos y el estudio de cuadernos.
 *
 * Comportamiento sin sesión:
 * - Visualmente tenue/grisáceo y desactivado para sincronizar (SIN icono de X).
 * - Cursor `not-allowed` en PC y aviso discreto "Inicia sesión para sincronizar"
 *   al pasar el ratón (hover) o tocar, con enlace directo a Mi cuenta.
 */
export const SyncStatusButton: React.FC<SyncStatusButtonProps> = ({
  connected,
  status,
  pendingCount = 0,
  compact = false,
  onSyncNow,
  onOpenAccount,
}) => {
  const [tipOpen, setTipOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!tipOpen) return;
    const onOutside = (e: MouseEvent | TouchEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setTipOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutside);
    document.addEventListener('touchstart', onOutside);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      document.removeEventListener('touchstart', onOutside);
    };
  }, [tipOpen]);

  // SIN SESIÓN: tenue/desactivado (sin X), tooltip al hover/tap con enlace a Mi cuenta
  if (!connected) {
    return (
      <div
        ref={wrapRef}
        className="relative inline-flex items-center"
        onMouseEnter={() => setTipOpen(true)}
        onMouseLeave={() => setTipOpen(false)}
      >
        <button
          type="button"
          aria-disabled="true"
          onClick={() => setTipOpen((v) => !v)}
          title={LUMA_CORE_CONFIG.copy.syncDisabledTooltip}
          className={`${
            compact ? 'h-7 px-2 text-[11px]' : 'h-10 md:h-9 px-3 text-xs'
          } rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] opacity-55 cursor-not-allowed inline-flex items-center gap-1.5 font-semibold whitespace-nowrap transition-opacity select-none`}
        >
          <Cloud className="w-3.5 h-3.5 shrink-0" />
          <span className={compact ? 'hidden sm:inline' : ''}>Sincronizar</span>
        </button>

        {tipOpen && (
          <div
            role="tooltip"
            className="absolute right-0 top-full mt-1.5 z-50 w-56 p-2.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xl text-[11px] space-y-1.5 luma-dropdown-reveal"
          >
            <div className="font-medium text-[var(--luma-ink)]">
              {LUMA_CORE_CONFIG.copy.syncDisabledTooltip}
            </div>
            <button
              type="button"
              onClick={() => {
                setTipOpen(false);
                onOpenAccount();
              }}
              className="text-[11px] font-semibold text-[var(--luma-accent)] hover:underline inline-flex items-center gap-1"
            >
              <span>Ir a Mi cuenta →</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  // CON SESIÓN: botón activo con icono y color de estado real
  const isSpinning = status === 'syncing';
  const isError = status === 'error';
  const isOffline = status === 'offline';
  const isPending = status === 'pending' || pendingCount > 0;

  let label = 'Sincronizado';
  let icon = <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
  let toneClass =
    'border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]';

  if (isSpinning) {
    label = 'Sincronizando...';
    icon = <RefreshCw className="w-3.5 h-3.5 animate-spin text-[var(--luma-accent)] shrink-0" />;
    toneClass =
      'border-[var(--luma-accent)]/40 bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]';
  } else if (isError) {
    label = 'Error de sync';
    icon = <AlertCircle className="w-3.5 h-3.5 text-red-500 shrink-0" />;
    toneClass =
      'border-red-500/35 bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/15';
  } else if (isOffline) {
    label = 'Sin red (en cola)';
    icon = <CloudOff className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    toneClass =
      'border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300';
  } else if (isPending) {
    label = pendingCount > 0 ? `Pendiente (${pendingCount})` : 'Pendiente';
    icon = <Clock className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    toneClass =
      'border-[var(--luma-accent)]/35 bg-[var(--luma-surface)] text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]';
  }

  return (
    <button
      type="button"
      onClick={onSyncNow}
      disabled={isSpinning}
      title="Sincronizar biblioteca y cuadernos con tu Google Drive"
      className={`${
        compact ? 'h-7 px-2 text-[11px]' : 'h-10 md:h-9 px-3 text-xs'
      } rounded-lg border font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap luma-press disabled:opacity-75 ${toneClass}`}
    >
      {icon}
      <span className={compact ? 'hidden sm:inline' : ''}>{label}</span>
      {isPending && pendingCount > 0 && compact && (
        <span className="min-w-[16px] h-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
          {pendingCount}
        </span>
      )}
    </button>
  );
};
