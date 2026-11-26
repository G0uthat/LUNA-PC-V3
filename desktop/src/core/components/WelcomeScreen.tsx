import React from 'react';
import { BookOpen, Cloud, HardDrive } from 'lucide-react';
import { LumaBrandLogo } from '../../components/LumaBrandLogo';
import { featureFlags, LUMA_CORE_CONFIG } from '../config';
import { GoogleSignInAction } from './GoogleSignInAction';

interface WelcomeScreenProps {
  /** Callback para iniciar el login directo con Google Identity Services */
  onSignInGoogle: () => Promise<void>;
  /** Callback cuando el usuario pulsa "Omitir este paso (usar sin conexión)" */
  onSkipOffline: () => void;
}

/**
 * Pantalla de bienvenida multiplataforma (solo en el primer arranque).
 * Flujo directo: al tocar "Continuar con Google" abre el popup oficial de GIS.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onSignInGoogle,
  onSkipOffline,
}) => {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenida a Luma"
      className="fixed inset-0 z-[95] bg-[var(--luma-bg)] text-[var(--luma-ink)] overflow-y-auto flex items-center justify-center p-4 sm:p-6 luma-modal-backdrop"
    >
      <div className="w-full max-w-[520px] rounded-3xl border border-[var(--luma-border)] bg-[var(--luma-surface)] shadow-2xl p-6 sm:p-9 space-y-6 luma-modal-pop">
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

        {/* Inicio de sesión directo con Google y modo sin conexión */}
        <div className="space-y-3 pt-1">
          {featureFlags.google && (
            <GoogleSignInAction
              label="Continuar con Google"
              onSignInGoogle={onSignInGoogle}
              showDriveNote
            />
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
      </div>
    </div>
  );
};
