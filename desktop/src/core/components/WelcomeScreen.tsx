import React, { useState } from 'react';
import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  Cloud,
  HardDrive,
  HelpCircle,
  Loader2,
  ShieldCheck,
} from 'lucide-react';
import { LumaBrandLogo } from '../../components/LumaBrandLogo';
import { featureFlags, LUMA_CORE_CONFIG } from '../config';

interface WelcomeScreenProps {
  /** Client ID previamente guardado o configurado en entorno público */
  initialClientId?: string;
  /** Callback para iniciar el login real con Google Drive (OAuth) */
  onSignInGoogle: (clientId: string) => Promise<void>;
  /** Callback cuando el usuario pulsa "Omitir este paso (usar sin conexión)" */
  onSkipOffline: () => void;
  /** Abre la guía paso a paso para crear un Client ID si aún no tiene uno */
  onOpenClientIdGuide?: () => void;
}

/**
 * Pantalla de bienvenida multiplataforma (solo en el primer arranque).
 * Incluye paso explicativo previo de permisos en lenguaje claro y soporte
 * de proveedores secundarios detrás de banderas `featureFlags`.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  initialClientId = '',
  onSignInGoogle,
  onSkipOffline,
  onOpenClientIdGuide,
}) => {
  const [step, setStep] = useState<'welcome' | 'consent'>('welcome');
  const [clientId, setClientId] = useState(
    initialClientId.trim() || LUMA_CORE_CONFIG.publicGoogleClientId
  );
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleConfirmGoogle = async () => {
    const cleanId = clientId.trim();
    if (!cleanId) {
      setErrorMsg(
        'Para conectar directamente con tu Google Drive sin servidores propios, pega tu Client ID de Google OAuth o continúa sin conexión y configúralo luego en Ajustes.'
      );
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await onSignInGoogle(cleanId);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión con Google.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a Luma"
      className="fixed inset-0 z-[95] bg-[var(--luma-bg)] text-[var(--luma-ink)] overflow-y-auto flex items-center justify-center p-4 sm:p-6 luma-modal-backdrop"
    >
      <div className="w-full max-w-[520px] rounded-3xl border border-[var(--luma-border)] bg-[var(--luma-surface)] shadow-2xl p-6 sm:p-9 space-y-6 luma-modal-pop">
        {step === 'welcome' ? (
          <>
            {/* Logo y eslogan */}
            <div className="flex flex-col items-center text-center space-y-3 pt-1">
              <LumaBrandLogo size="lg" />
              <div className="space-y-1.5">
                <p className="text-sm font-semibold text-[var(--luma-ink)]">
                  {LUMA_CORE_CONFIG.copy.slogan}
                </p>
                <p className="text-xs sm:text-sm text-[var(--luma-ink-muted)] max-w-md leading-relaxed">
                  {LUMA_CORE_CONFIG.copy.welcomeSubtitle}
                </p>
              </div>
            </div>

            {/* Ventajas breves */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-left">
              {[
                {
                  icon: <Cloud className="w-4 h-4 text-[var(--luma-accent)]" />,
                  title: 'Tu propia nube',
                  desc: 'Guarda en tu Google Drive sin servidores externos.',
                },
                {
                  icon: <BookOpen className="w-4 h-4 text-[var(--luma-accent)]" />,
                  title: 'Hasta 5 dispositivos',
                  desc: 'Retoma lectura y cuadernos entre PC y móvil.',
                },
                {
                  icon: <HardDrive className="w-4 h-4 text-[var(--luma-accent)]" />,
                  title: '100% sin conexión',
                  desc: 'Úsala localmente aunque no tengas internet.',
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="p-3 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-1"
                >
                  {item.icon}
                  <div className="text-xs font-bold">{item.title}</div>
                  <div className="text-[11px] text-[var(--luma-ink-muted)] leading-snug">
                    {item.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Botones de proveedores y modo sin conexión */}
            <div className="space-y-3 pt-1">
              {featureFlags.google && (
                <button
                  type="button"
                  onClick={() => {
                    setErrorMsg(null);
                    setStep('consent');
                  }}
                  className="w-full h-12 px-5 rounded-2xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] hover:opacity-95 font-semibold text-sm inline-flex items-center justify-center gap-3 shadow-md transition-opacity luma-press"
                >
                  <span className="w-6 h-6 rounded-full bg-white flex items-center justify-center shrink-0">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                      />
                      <path
                        fill="#34A853"
                        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                      />
                    </svg>
                  </span>
                  <span>Continuar con Google</span>
                </button>
              )}

              {/* Microsoft OneDrive — oculto por defecto en Beta (featureFlags.microsoft = false) */}
              {featureFlags.microsoft && (
                <button
                  type="button"
                  disabled
                  className="w-full h-12 px-5 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] text-sm font-semibold inline-flex items-center justify-center gap-3 opacity-80"
                >
                  <span>Continuar con Microsoft (OneDrive)</span>
                </button>
              )}

              {/* Terabox — oculto por defecto en Beta (featureFlags.terabox = false) */}
              {featureFlags.terabox && (
                <button
                  type="button"
                  disabled
                  className="w-full h-12 px-5 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] text-sm font-semibold inline-flex items-center justify-center gap-3 opacity-80"
                >
                  <span>Continuar con Terabox</span>
                </button>
              )}

              <button
                type="button"
                onClick={onSkipOffline}
                className="w-full h-11 px-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-xs sm:text-sm font-semibold text-[var(--luma-ink)] transition-colors luma-press"
              >
                Omitir este paso (usar sin conexión)
              </button>

              <p className="text-center text-[11px] text-[var(--luma-ink-muted)]">
                {LUMA_CORE_CONFIG.copy.offlineNote}
              </p>
            </div>
          </>
        ) : (
          /* Paso explicativo previo en lenguaje simple antes de abrir el login de Google */
          <div className="space-y-5 luma-view-enter">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setStep('welcome')}
                className="h-9 w-9 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center justify-center shrink-0"
                aria-label="Volver"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <h2 className="text-base font-bold">{LUMA_CORE_CONFIG.copy.consentTitle}</h2>
                <p className="text-xs text-[var(--luma-ink-muted)]">
                  Privacidad transparente y sin intermediarios
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl border border-[var(--luma-accent)]/30 bg-[var(--luma-accent-soft)]/50 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--luma-accent)]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>¿Qué permisos usará Luma?</span>
              </div>
              <p className="text-xs sm:text-[13px] leading-relaxed text-[var(--luma-ink)]">
                {LUMA_CORE_CONFIG.copy.consentBody}
              </p>
              <div className="flex items-center gap-2 text-[11px] text-[var(--luma-ink-muted)] pt-1">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span>Tus tokens de acceso permanecen solo en memoria y puedes revocarlos cuando quieras.</span>
              </div>
            </div>

            {/* Client ID directo si aún no se ha configurado */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <label className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                  Client ID de Google OAuth (Web)
                </label>
                {onOpenClientIdGuide && (
                  <button
                    type="button"
                    onClick={onOpenClientIdGuide}
                    className="text-[11px] font-semibold text-[var(--luma-accent)] hover:underline inline-flex items-center gap-1"
                  >
                    <HelpCircle className="w-3 h-3" />
                    <span>¿Cómo obtenerlo?</span>
                  </button>
                )}
              </div>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="xxxxxxxxxxxx-yyyyyyyyyyyy.apps.googleusercontent.com"
                className="w-full h-10 px-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] font-mono text-xs outline-none focus:border-[var(--luma-accent)]"
              />
            </div>

            {errorMsg && (
              <div className="p-3 rounded-xl border border-red-500/35 bg-red-500/10 text-xs text-red-600 dark:text-red-400 leading-snug">
                {errorMsg}
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-1">
              <button
                type="button"
                onClick={onSkipOffline}
                disabled={busy}
                className="sm:w-auto h-11 px-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold"
              >
                Usar sin conexión
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleConfirmGoogle()}
                className="flex-1 h-11 px-5 rounded-2xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] hover:opacity-95 text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 shadow-sm disabled:opacity-60"
              >
                {busy && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{busy ? 'Conectando con Google...' : 'Entendido, continuar'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
