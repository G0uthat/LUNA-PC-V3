import React, { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { LUMA_CORE_CONFIG } from '../config';
import { useGoogleGsi } from '../../drive/googleGsiLoader';
import { UNAVAILABLE_LOGIN_MESSAGE } from '../../drive/googleDriveClient';

interface GoogleSignInActionProps {
  label?: string;
  fullWidth?: boolean;
  onSignInGoogle: () => Promise<void>;
  showDriveNote?: boolean;
  compact?: boolean;
}

let hasLoggedMissingClientId = false;

/**
 * Botón directo de inicio de sesión con Google Identity Services (sin pantallas intermedias).
 * - Carga https://accounts.google.com/gsi/client de forma asíncrona.
 * - Deshabilita el botón con estado de carga visible hasta que GIS está listo.
 * - Lee VITE_GOOGLE_CLIENT_ID desde configuración y maneja todos los errores con mensajes claros.
 */
export const GoogleSignInAction: React.FC<GoogleSignInActionProps> = ({
  label = 'Continuar con Google',
  fullWidth = true,
  onSignInGoogle,
  showDriveNote = true,
  compact = false,
}) => {
  const { status: gsiStatus, ready: gisReady, loading: gisLoading, errorMessage: gisError, retry } =
    useGoogleGsi();
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );

  const clientId = LUMA_CORE_CONFIG.publicGoogleClientId.trim();

  useEffect(() => {
    if (!clientId && !hasLoggedMissingClientId) {
      hasLoggedMissingClientId = true;
      console.error(
        '[Luma Auth] Falta la variable de entorno import.meta.env.VITE_GOOGLE_CLIENT_ID. Configúrala para habilitar el inicio de sesión con Google.'
      );
    }
  }, [clientId]);

  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  const handleClick = async () => {
    if (!navigator.onLine) {
      setAuthError('Sin conexión a internet. Revisa tu red e inténtalo de nuevo.');
      return;
    }

    if (!clientId) {
      console.error(
        '[Luma Auth] No se puede iniciar sesión porque import.meta.env.VITE_GOOGLE_CLIENT_ID no está configurado.'
      );
      setAuthError(UNAVAILABLE_LOGIN_MESSAGE);
      return;
    }

    setBusy(true);
    setAuthError(null);
    try {
      await onSignInGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No se pudo completar el inicio de sesión con Google.'
      );
    } finally {
      setBusy(false);
    }
  };

  const missingClientIdNotice = !clientId ? UNAVAILABLE_LOGIN_MESSAGE : null;
  const displayError = authError || missingClientIdNotice || (!gisReady ? gisError : null);
  const isDisabled = gisLoading || !gisReady || busy;

  return (
    <div className={`space-y-2.5 ${fullWidth ? 'w-full' : 'w-full sm:w-auto flex flex-col items-start'}`}>
      <button
        type="button"
        disabled={isDisabled}
        aria-busy={gisLoading || busy}
        onClick={() => void handleClick()}
        className={`${fullWidth ? 'w-full' : 'w-full sm:w-auto'} ${
          compact ? 'h-10 px-4 text-xs' : 'h-12 px-5 text-sm'
        } rounded-2xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] hover:opacity-95 font-semibold inline-flex items-center justify-center gap-3 shadow-md transition-opacity luma-press disabled:opacity-60 disabled:cursor-not-allowed`}
      >
        {gisLoading || busy ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin shrink-0" />
            <span>{gisLoading ? 'Cargando Google...' : 'Conectando con Google...'}</span>
          </>
        ) : (
          <>
            <span
              className={`${
                compact ? 'w-5 h-5' : 'w-6 h-6'
              } rounded-full bg-white flex items-center justify-center shrink-0`}
            >
              <svg
                className={compact ? 'w-3.5 h-3.5' : 'w-4 h-4'}
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
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
            <span>{label}</span>
          </>
        )}
      </button>

      {showDriveNote && (
        <p className="text-center text-[11px] text-[var(--luma-ink-muted)] leading-relaxed">
          {LUMA_CORE_CONFIG.copy.googleDriveNote}
        </p>
      )}

      {displayError && (
        <div
          role="alert"
          className="p-3 rounded-xl border border-red-500/35 bg-red-500/10 text-xs text-red-600 dark:text-red-400 leading-snug flex items-center justify-between gap-2"
        >
          <span>{displayError}</span>
          {gsiStatus === 'error' && isOnline && clientId && (
            <button
              type="button"
              onClick={retry}
              className="shrink-0 inline-flex items-center gap-1 font-semibold underline hover:opacity-80"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Reintentar</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
